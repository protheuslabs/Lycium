import { expect, test, type Page } from "@playwright/test";

async function chooseDropdownOption(page: Page, label: string, optionName: string | RegExp) {
  const trigger = page.getByLabel(label);
  const currentText = (await trigger.textContent()) ?? "";
  if (typeof optionName === "string" && currentText.includes(optionName)) {
    return;
  }
  await trigger.click();
  await page.getByRole("listbox", { name: label }).getByRole("option", { name: optionName }).first().click({ force: true });
}

function firstUsableCourseCard(page: Page) {
  return page
    .locator(".course-card:not(.create-course-card):not(.course-card--empty):not(.course-card--generating):not(.course-card--locked)")
    .first();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("catalog loads, exposes create flow, and opens a course", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await expect(page.getByRole("button", { name: /create course/i })).toBeVisible();

  await page.getByRole("button", { name: /create course/i }).click();
  await expect(page.getByRole("dialog", { name: "Create Course" })).toBeVisible();
  await expect(page.getByPlaceholder("Describe the course you want to build...")).toBeVisible();
  await page.getByRole("button", { name: /close create course/i }).click();

  const firstCourse = firstUsableCourseCard(page);
  await expect(firstCourse).toBeVisible();
  await firstCourse.click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".content-view")).toBeVisible();
});

test("catalog program and cluster navigation is data-driven", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await chooseDropdownOption(page, "Select catalog view level", "Programs");
  const firstProgram = page.locator(".program-showcase-card").first();
  await expect(firstProgram).toBeVisible();
  const programTitle = (await firstProgram.locator("h3").innerText()).trim();
  expect(programTitle.length).toBeGreaterThan(0);

  await firstProgram.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/Lycium\/catalog\/[^/]+$/);
  await expect(page.getByLabel("Select catalog view level")).toContainText("Clusters");

  const firstCluster = page.locator(".program-showcase-card").first();
  await expect(firstCluster).toBeVisible();
  const clusterTitle = (await firstCluster.locator("h3").innerText()).trim();
  expect(clusterTitle.length).toBeGreaterThan(0);

  await firstCluster.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/Lycium\/catalog\/[^/]+\/[^/]+$/);
  await expect(page.getByLabel("Select catalog view level")).toContainText("Courses");
  await expect(page.locator(".course-card").first()).toBeVisible();
});

test("catalog search, filters, sort, and locked card behavior are generic", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  const firstCourse = firstUsableCourseCard(page);
  await expect(firstCourse).toBeVisible();
  const firstCourseTitle = (await firstCourse.locator("h3").innerText()).trim();
  const searchToken = firstCourseTitle.split(/\s+/).find((token) => token.length > 2) ?? firstCourseTitle;

  await page.getByPlaceholder("Search names, tags, and departments").fill(searchToken);
  await expect(page.locator(".course-card").filter({ hasText: firstCourseTitle }).first()).toBeVisible();

  await chooseDropdownOption(page, "Sort courses", /Sort by Completion/);
  await expect(page.getByLabel("Sort courses")).toContainText("Completion");

  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("dialog", { name: "Catalog filters" })).toBeVisible();
  await expect(page.getByLabel("Filter by college")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();

  const lockedCourse = page.locator(".course-card--locked").first();
  if (await lockedCourse.count()) {
    const currentUrl = page.url();
    await lockedCourse.click();
    await expect(page).toHaveURL(currentUrl);
  }
});

test("settings modal and course shell survive route changes", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("radio", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page).toHaveURL(/\/Lycium\/catalog$/);

  const firstCourse = firstUsableCourseCard(page);
  await firstCourse.click();
  await expect(page.locator(".content-view")).toBeVisible();
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page).toHaveURL(/\/Lycium\/courses\//);
});
