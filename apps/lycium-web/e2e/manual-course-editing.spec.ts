import { expect, test } from "@playwright/test";

const manualCourseTitle = "Manual E2E Course";
const manualBlockBody = "Manual block body from E2E.";

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

test("manual course editing saves title and added block content as a local draft", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await page.getByRole("button", { name: /^Create Course$/i }).click();
  await expect(page.getByRole("dialog", { name: "Create Course" })).toBeVisible();
  await page.getByRole("tab", { name: "Manual" }).click();
  await page.getByRole("button", { name: "Create blank course" }).click();

  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".course-name")).toHaveText("Untitled course");
  await page.getByRole("button", { name: "Edit course" }).click();

  await page.getByRole("button", { name: "Edit course title" }).click();
  const titleDialog = page.locator("dialog.course-edit-native-dialog");
  await expect(titleDialog).toBeVisible();
  await titleDialog.getByRole("textbox").fill(manualCourseTitle);
  await titleDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".course-name")).toHaveText(manualCourseTitle);

  await page.getByRole("button", { name: /^Add block$/i }).click();
  const addBlockDialog = page.locator("dialog.course-edit-native-dialog");
  await expect(addBlockDialog).toBeVisible();
  await expect(addBlockDialog.getByRole("tab", { name: "Text" })).toHaveAttribute("aria-selected", "true");
  await addBlockDialog.getByRole("textbox").fill(manualBlockBody);
  await addBlockDialog.getByRole("button", { name: "Add block" }).click();
  await expect(page.getByText(manualBlockBody)).toBeVisible();

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
