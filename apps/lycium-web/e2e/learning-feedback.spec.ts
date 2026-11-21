import { expect, test, type Page } from "@playwright/test";
import { mockLocalUiApi } from "./fixtures/localUiApi";

const title = "Evidence and Reasoning";
const course = {
  key: "feedback", title, source: "local", status: "published",
  data: {
    title, category: "arts-humanities", shortDescription: "Use observations to explain a conclusion and evaluate an argument.",
    metadata: { editPolicy: { editable: false } },
    modules: [{ id: "foundations", title: "Module 1: Evidence and explanation", sections: [
      { id: "observations", title: "Observations and claims", content: [{ type: "text", value: "An observation is a record of what was measured or noticed. A claim is an assertion that may need support." }] },
      { id: "conclusions", title: "Reasoning toward a conclusion", content: [{ type: "text", value: "A conclusion should follow from the evidence and acknowledge relevant uncertainty." }] },
      { id: "assessment", title: "Check your understanding", pageType: "apply", content: [{ type: "quiz", maxAttempts: 3, passPercentage: 75, showAnswers: false, questions: [
        { question: "Which claim has relevant support?", options: ["The claim supported by a relevant observation", "The claim based only on an unrelated opinion"], answer: 0 },
        { question: "Which actions strengthen a conclusion?", options: ["Check whether the evidence is relevant", "Consider plausible alternative explanations", "Ignore observations that disagree"], answers: [0, 1], multiple: true },
      ] }] },
    ] }],
  },
};

test.beforeEach(async ({ page }) => {
  await mockLocalUiApi(page);
  await page.addInitScript((fixture) => {
    if (sessionStorage.getItem("learning-feedback-seeded")) return;
    localStorage.clear();
    localStorage.setItem("lycium-theme-mode", "light");
    localStorage.setItem("lycium-local-course-drafts", JSON.stringify([fixture]));
    localStorage.setItem("lycium-progress-feedback", JSON.stringify({ completedSectionIds: ["observations"], sectionStatuses: { conclusions: "seen" } }));
    sessionStorage.setItem("learning-feedback-seeded", "1");
  }, course);
});

async function openAssessment(page: Page) {
  await page.goto("/Lycium/catalog");
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).click();
  await page.getByRole("button", { name: "1.3 Check your understanding", exact: true }).click();
  await page.getByRole("button", { name: "Begin attempt #1", exact: true }).click();
}

async function answer(page: Page, correct: boolean) {
  await page.getByRole("radio", { name: correct ? "The claim supported by a relevant observation" : "The claim based only on an unrelated opinion", exact: true }).check();
  await page.getByRole("checkbox", { name: "Check whether the evidence is relevant", exact: true }).check();
  await page.getByRole("checkbox", { name: "Consider plausible alternative explanations", exact: true }).check();
}

test("curriculum distinguishes completion, viewing, and activities without manufacturing mastery", async ({ page }, info) => {
  await page.goto("/Lycium/catalog");
  const before = await page.evaluate(() => localStorage.getItem("lycium-progress-feedback"));
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Evidence and explanation sections completed", exact: true })).toHaveAttribute("value", "1");
  await expect(page.locator(".overview-module li[data-state='completed']")).toContainText("Observations and claims");
  await expect(page.locator(".overview-module li[data-state='viewed']")).toContainText("Reasoning toward a conclusion");
  await expect(page.getByRole("button", { name: "1.3 Check your understanding", exact: true })).toHaveAccessibleDescription("Quiz. Not started.");
  expect(await page.evaluate(() => localStorage.getItem("lycium-progress-feedback"))).toBe(before);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("link", { name: "Curriculum", exact: true }).click();
    const header = await page.locator(".top-bar").boundingBox();
    expect(header!.y).toBe(0);
    expect(await page.locator(".learner-page-shell").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width === 390 || width === 1280) await page.screenshot({ path: info.outputPath(`curriculum-${width}.png`) });
  }
  await page.reload();
  await expect(page.locator(".overview-module")).toBeVisible();
  expect((await page.locator(".top-bar").boundingBox())!.y).toBe(0);
});

test("answered progress and past-attempt review preserve grading and answer privacy", async ({ page }) => {
  await openAssessment(page);
  const progress = page.getByRole("progressbar", { name: "Questions answered", exact: true });
  await expect(progress).toHaveAttribute("value", "0");
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: "The claim based only on an unrelated opinion", exact: true }).check();
  await expect(progress).toHaveAttribute("value", "1");
  await page.reload();
  await expect(progress).toHaveAttribute("value", "1");
  await page.getByRole("checkbox", { name: "Check whether the evidence is relevant", exact: true }).check();
  await page.getByRole("checkbox", { name: "Consider plausible alternative explanations", exact: true }).check();
  await expect(progress).toHaveAttribute("value", "2");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("status", { name: "Attempt 1 result", exact: true })).toContainText("Below passing score");
  await expect(page.getByRole("status", { name: "Attempt 1 result", exact: true })).toContainText("50%");
  await expect(page.locator(".quiz-response-feedback")).toHaveCount(0);
  await expect(page.locator(".quiz-option--correct-answer")).toHaveCount(0);
  await page.getByRole("button", { name: "Begin attempt #2", exact: true }).click();
  await expect(progress).toHaveAttribute("value", "0");
  await answer(page, true);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("status", { name: "Attempt 2 result", exact: true })).toContainText("Passing score met");
  await page.locator(".quiz-meta-row--submitted").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status", { name: "Attempt 1 result", exact: true })).toContainText("50%");
  await expect(page.locator(".quiz-response-feedback")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to current attempt", exact: true }).click();
  await expect(page.getByRole("status", { name: "Attempt 2 result", exact: true })).toContainText("100%");
});

test("per-question feedback appears only after allowed submission and reflows", async ({ page }, info) => {
  await page.goto("/Lycium/catalog");
  await page.evaluate(() => {
    const courses = JSON.parse(localStorage.getItem("lycium-local-course-drafts")!);
    courses[0].data.modules[0].sections[2].content[0].showAnswers = true;
    localStorage.setItem("lycium-local-course-drafts", JSON.stringify(courses));
  });
  await openAssessment(page);
  await expect(page.locator(".quiz-response-feedback")).toHaveCount(0);
  const marker = page.getByRole("button", { name: "Mark this question for review", exact: true }).first();
  await marker.click();
  await expect(page.getByRole("button", { name: "Unmark this question for review", exact: true })).toHaveAttribute("aria-pressed", "true");
  await answer(page, false);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator(".quiz-response-feedback[data-correct='false']")).toHaveCount(1);
  await expect(page.locator(".quiz-response-feedback[data-correct='true']")).toHaveCount(1);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((mode) => localStorage.setItem("lycium-theme-mode", mode), theme);
    await page.reload();
    await expect(page.locator(".quiz-option--correct-answer > span:last-child").first()).toHaveCSS("color", theme === "dark" ? "rgb(213, 220, 223)" : "rgb(48, 56, 60)");
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.locator(".course-content-host").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.locator(".quiz-attempt-feedback").scrollIntoViewIfNeeded();
      if (width === 390 || width === 1280) await page.screenshot({ path: info.outputPath(`quiz-result-${theme}-${width}.png`) });
    }
  }
});
