import { expect, test, type Page } from "@playwright/test";

const manualCourseTitle = "Manual E2E Course";
const manualBlockBody = "Manual block body from E2E.";
const manualSourceUrl = "https://example.edu/manual-source";
const manualQuizQuestion = "What makes a Lycium course trustworthy?";
const manualQuizAnswer = "Traceable source citations";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("lycium-e2e-storage-cleared") === "1") {
      return;
    }
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem("lycium-e2e-storage-cleared", "1");
  });
});

async function createBlankManualCourse(page: Page) {
  await page.goto("/Lycium/catalog");

  await page.getByRole("button", { name: /^Create Course$/i }).click();
  await expect(page.getByRole("dialog", { name: "Create Course" })).toBeVisible();
  await page.getByRole("tab", { name: "Manual" }).click();
  await page.getByRole("button", { name: "Create blank course" }).click();

  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".course-name")).toHaveText("Untitled course");
  await page.getByRole("button", { name: "Edit course" }).click();
}

async function addBlock(page: Page, tabName: string, body: string) {
  await page.getByRole("button", { name: /^Add block$/i }).click();
  const addBlockDialog = page.locator("dialog.course-edit-native-dialog");
  await expect(addBlockDialog).toBeVisible();
  if (tabName !== "Text") {
    await addBlockDialog.getByRole("tab", { name: tabName }).click();
  }
  await expect(addBlockDialog.getByRole("tab", { name: tabName })).toHaveAttribute("aria-selected", "true");
  await addBlockDialog.getByRole("textbox").fill(body);
  await addBlockDialog.getByRole("button", { name: "Add block" }).click();
}

async function addTextBlock(page: Page, body: string) {
  await addBlock(page, "Text", body);
  await expect(page.getByText(body)).toBeVisible();
}

test("manual course editing saves title and added block content as a local draft", async ({ page }) => {
  await createBlankManualCourse(page);
  await page.getByRole("button", { name: "Edit course title" }).click();
  const titleDialog = page.locator("dialog.course-edit-native-dialog");
  await expect(titleDialog).toBeVisible();
  await titleDialog.getByRole("textbox").fill(manualCourseTitle);
  await titleDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".course-name")).toHaveText(manualCourseTitle);

  await addTextBlock(page, manualBlockBody);

  await page.getByRole("button", { name: "Save course edits" }).click();

  const persistedDraft = await page.evaluate(
    ({ title, body }) => {
      const drafts = JSON.parse(window.localStorage.getItem("lycium-local-course-drafts") ?? "[]");
      return drafts.some((draft: unknown) => {
        const draftText = JSON.stringify(draft);
        return draftText.includes(title) && draftText.includes(body);
      });
    },
    { title: manualCourseTitle, body: manualBlockBody },
  );
  expect(persistedDraft).toBe(true);

  await page.goto("/Lycium/catalog");
  await page.getByPlaceholder("Search names, tags, and departments").fill(manualCourseTitle);
  await page.locator(".course-card").filter({ hasText: manualCourseTitle }).first().click();
  await expect(page.locator(".course-name")).toHaveText(manualCourseTitle);
});

test("manual course editing persists URL source attachments on content blocks", async ({ page }) => {
  await createBlankManualCourse(page);
  await addTextBlock(page, "Source-backed manual block.");

  await page.getByRole("button", { name: "Add a source for this block" }).first().click();
  const sourceDialog = page.getByRole("dialog", { name: "Add a source for this course" });
  await expect(sourceDialog).toBeVisible();
  await sourceDialog.getByPlaceholder("https://example.edu/source").fill(manualSourceUrl);
  await sourceDialog.getByRole("button", { name: "Add URL source" }).click();

  await expect(page.getByRole("button", { name: "Open source 1" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Save course edits" }).click();

  const persistedSource = await page.evaluate((url) => {
    const drafts = JSON.parse(window.localStorage.getItem("lycium-local-course-drafts") ?? "[]");
    return drafts.some((draft: unknown) => {
      const candidate = draft as {
        data?: {
          sourceRecords?: Array<{ id?: string; url?: string }>;
          modules?: Array<{ sections?: Array<{ content?: Array<{ sourceIds?: string[] }> }> }>;
        };
      };
      const sourceRecord = candidate.data?.sourceRecords?.find((source) => source.url === url);
      const sourceId = sourceRecord?.id;
      return Boolean(
        sourceId &&
          candidate.data?.modules?.some((module) =>
            module.sections?.some((section) =>
              section.content?.some((block) => Array.isArray(block.sourceIds) && block.sourceIds.includes(sourceId)),
            ),
          ),
      );
    });
  }, manualSourceUrl);

  expect(persistedSource).toBe(true);
});

test("manual course editing persists quiz question and answer edits", async ({ page }) => {
  await createBlankManualCourse(page);
  await addBlock(page, "Quiz", "Manual Quiz E2E");

  await expect(page.getByText("Replace this with the quiz question.")).toBeVisible();
  await page.getByRole("button", { name: "Edit question" }).click();
  const questionDialog = page.locator("dialog.course-edit-native-dialog");
  await expect(questionDialog).toBeVisible();
  await questionDialog.getByRole("textbox").fill(manualQuizQuestion);
  await questionDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(manualQuizQuestion)).toBeVisible();

  await page.getByRole("button", { name: "Edit answer" }).first().click();
  const answerDialog = page.locator("dialog.course-edit-native-dialog");
  await expect(answerDialog).toBeVisible();
  await answerDialog.getByRole("textbox").fill(manualQuizAnswer);
  await answerDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(manualQuizAnswer)).toBeVisible();

  await page.getByRole("button", { name: "Save course edits" }).click();

  const persistedQuiz = await page.evaluate(
    ({ question, answer }) => {
      const drafts = JSON.parse(window.localStorage.getItem("lycium-local-course-drafts") ?? "[]");
      return drafts.some((draft: unknown) => {
        const draftText = JSON.stringify(draft);
        return draftText.includes(question) && draftText.includes(answer);
      });
    },
    { question: manualQuizQuestion, answer: manualQuizAnswer },
  );

  expect(persistedQuiz).toBe(true);
});
