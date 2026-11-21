import { expect, test, type Page } from "@playwright/test";
import { mockLocalUiApi } from "./fixtures/localUiApi";
import { openSiteSettings } from "./fixtures/siteNavigation";

const title = "Reading, Practice, and Evidence: A Course With a Deliberately Long Catalog Title";
const lessonTitle = "Distinguishing completion from understanding through practice and evidence";
const correctAnswer = "A completed reading is not a passing assessment.";
const course = {
  key: "e2e-reader-overhaul",
  title,
  source: "local",
  status: "published",
  data: {
    title,
    shortDescription:
      "A small course fixture for responsive navigation, citations, and assessment persistence.",
    sourceIds: ["used", "unused"],
    sourceRecords: [
      {
        id: "used",
        type: "article",
        title: "The source used in this lesson",
        url: "https://example.edu/used",
      },
      {
        id: "unused",
        type: "article",
        title: "An unrelated course source",
        url: "https://example.edu/unused",
      },
    ],
    metadata: { editPolicy: { editable: false } },
    modules: [
      {
        id: "module-1",
        title: "Module 1: Reading and evidence",
        sections: [
          {
            id: "lesson-1",
            title: lessonTitle,
            pageType: "learn",
            sectionType: "lesson",
            sourceIds: ["used"],
            content: [
              {
                type: "text",
                heading: "Learning and evidence",
                value:
                  "Reading introduces an idea. Practice provides an opportunity to apply it. An assessment gathers evidence of understanding.",
                sourceIds: ["used"],
              },
              {
                type: "equation",
                equations: [
                  "observed_completion + practice + assessment_evidence = distinct_records_that_should_not_be_collapsed_into_one_unexplained_progress_percentage",
                ],
              },
              {
                type: "conceptCard",
                title: "Assessment evidence",
                description: "Information collected by asking a learner to apply an idea.",
              },
            ],
          },
          {
            id: "lesson-2",
            title: "Evidence in practice",
            pageType: "learn",
            sectionType: "lesson",
            content: [
              {
                type: "text",
                value: "A result should be interpreted against the task and its criteria.",
              },
            ],
          },
          {
            id: "quiz-1",
            title: "Knowledge check",
            pageType: "apply",
            sectionType: "assessment",
            sourceIds: ["used"],
            content: [
              {
                type: "quiz",
                id: "shared-quiz-id",
                title: "Learning check",
                questions: [
                  {
                    question: "Which statement separates activity from assessment?",
                    options: [correctAnswer, "Opening a page proves understanding."],
                    answers: [0],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

test.beforeEach(async ({ page }) => {
  await mockLocalUiApi(page);
  await page.addInitScript((fixture) => {
    if (sessionStorage.getItem("reader-fixture-seeded")) return;
    localStorage.clear();
    localStorage.setItem("lycium-theme-mode", "light");
    localStorage.setItem(
      "lycium-local-course-drafts",
      JSON.stringify([
        fixture,
        {
          ...fixture,
          key: "e2e-reader-overhaul-second",
          title: "Second course",
          data: { ...fixture.data, title: "Second course" },
        },
      ]),
    );
    sessionStorage.setItem("reader-fixture-seeded", "1");
  }, course);
  await page.goto("/Lycium/catalog");
  await expect(page.getByRole("button", { name: `Open ${title}`, exact: true })).toBeVisible();
});

async function openCourse(page: Page, name = title) {
  await page.getByRole("button", { name: `Open ${name}`, exact: true }).click();
  await page.getByRole("button", { name: /^(Start|Resume|Review) course$/, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: lessonTitle })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Course breadcrumb", exact: true })).toContainText(name);
  await expect(page.getByRole("navigation", { name: "Course breadcrumb", exact: true })).toContainText("Module 1: Reading and evidence");
  await expect(page.getByRole("link", { name: name, exact: true })).toHaveAttribute("href", /\/courses\/.+/);
  await expect(page.locator(".module-header-progress").first()).toHaveText("0/3 complete");
  await expect(page.locator(".sidebar-item.active .sidebar-section-button")).toHaveCSS("border-left-width", "0px");
  await expect(page.locator(".equation-block code")).toContainText("observed_completion");
}

async function selectSection(page: Page, name: RegExp) {
  if ((await page.locator(".sidebar-section-list:visible").count()) === 0) {
    await page.getByRole("button", { name: "Course outline", exact: true }).click();
  }
  await page.getByRole("button", { name }).click();
}

test("course overview exposes attached materials and resource types before starting", async ({ page }) => {
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Course materials", level: 2 })).toBeVisible();
  await expect(page.locator(".overview-materials")).toContainText("The source used in this lesson");
  await expect(page.locator(".overview-materials")).toContainText("An unrelated course source");
  await expect(page.locator(".overview-facts")).toContainText("2 lessons");
  await expect(page.getByRole("link", { name: "Materials", exact: true })).toHaveAttribute("href", "#materials");
  await expect(page.locator(".overview-materials a").first()).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "Start course", exact: true }).click();
  if ((await page.locator(".sidebar-section-list:visible").count()) === 0) {
    await page.getByRole("button", { name: "Course outline", exact: true }).click();
  }
  await page.locator(".sidebar-source-tab").click();
  await expect(page.getByRole("heading", { name: "Sources", level: 1 })).toBeVisible();
  await expect(page.locator(".course-sources-page").getByRole("link", { name: title, exact: true })).toHaveAttribute("href", /\/courses\/.+/);
});

test("catalog controls and the reader reflow at phone, tablet, and desktop widths", async ({
  page,
}, info) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("searchbox", { name: "Search courses" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const search = await page.getByRole("searchbox", { name: "Search courses" }).boundingBox();
    expect(search!.x + search!.width).toBeLessThanOrEqual(width);
  }
  await page.getByRole("button", { name: `More info about ${title}` }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/catalog$/);
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Start course", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: lessonTitle })).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.querySelector(".course-content-host")!.scrollWidth <=
          document.querySelector(".course-content-host")!.clientWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("reader-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("reader-mobile.png"), fullPage: true });
});

test("mobile outline traps focus, closes on Escape/outside click, and navigates without a rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openCourse(page);
  const trigger = page.getByRole("button", { name: "Course outline", exact: true });
  const dialog = page.getByRole("dialog", { name: "Course outline", exact: true });
  await trigger.click();
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest("dialog.sidebar-drawer"))),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(374, 200);
  await expect(dialog).not.toBeVisible();
  await selectSection(page, /1\.2 Evidence in practice/);
  await expect(page.getByRole("heading", { level: 1, name: "Evidence in practice" })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("dialog.sidebar-drawer")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toBeVisible();
});

test("reader citations remain section-scoped and editing markers stay out of reading mode", async ({
  page,
}) => {
  await openCourse(page);
  await expect(page.getByRole("button", { name: "Add a source for this block" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open source 1", exact: true }).first().click();
  await expect(page.locator(".source-reference-list")).toContainText(
    "The source used in this lesson",
  );
  await expect(page.locator(".source-reference-list")).not.toContainText(
    "An unrelated course source",
  );
  await selectSection(page, /1\.3 Knowledge check/);
  await expect(page.locator(".source-reference-list")).toHaveCount(0);
  await expect(page.locator(".course-source-notice")).toHaveCount(0);
});

test("quiz selections survive reload and remain isolated between courses", async ({ page }) => {
  await openCourse(page);
  await selectSection(page, /1\.3 Knowledge check/);
  await page.getByRole("button", { name: "Begin attempt #1", exact: true }).click();
  await page.getByRole("radio", { name: correctAnswer, exact: true }).check();
  await page.reload();
  await expect(page.getByRole("radio", { name: correctAnswer, exact: true })).toBeChecked();
  const navigation = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await navigation.isVisible()) await navigation.click();
  await page.getByRole("link", { name: "Course catalog", exact: true }).click();
  await openCourse(page, "Second course");
  await selectSection(page, /1\.3 Knowledge check/);
  await page.getByRole("button", { name: "Begin attempt #1", exact: true }).click();
  await expect(page.getByRole("radio", { name: correctAnswer, exact: true })).not.toBeChecked();
});

test("light and dark themes keep the catalog, reader, and assessment on semantic surfaces", async ({
  page,
}, info) => {
  for (const mode of ["dark", "light"] as const) {
    await openSiteSettings(page);
    await page.getByRole("button", { name: "AI provider", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
    await page.getByRole("radio", { name: `${mode === "dark" ? "Dark" : "Light"} mode` }).click();
    await page.getByRole("button", { name: "Close Settings", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
    await page.screenshot({ path: info.outputPath(`catalog-${mode}.png`), fullPage: true });
    await openCourse(page);
    const surface = await page
      .locator(".app-root")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(surface).toBe(mode === "dark" ? "rgb(27, 29, 31)" : "rgb(255, 255, 255)");
    await page.screenshot({ path: info.outputPath(`reader-${mode}.png`), fullPage: true });
    await selectSection(page, /1\.3 Knowledge check/);
    await expect(page.getByRole("button", { name: "Begin attempt #1", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`assessment-${mode}.png`), fullPage: true });
    await selectSection(page, /1\.1 Distinguishing completion/);
    const navigation = page.getByRole("button", { name: "Open navigation", exact: true });
    if (await navigation.isVisible()) await navigation.click();
    await page.getByRole("link", { name: "Course catalog", exact: true }).click();
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(page.getByRole("heading", { name: "Catalog", level: 1 })).toBeVisible();
  }
});
