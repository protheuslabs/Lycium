import { expect, test } from "@playwright/test";

test("catalog loads, exposes create flow, and opens a course", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible();
  await expect(page.getByRole("button", { name: /create course/i })).toBeVisible();

  await page.getByRole("button", { name: /create course/i }).click();
  await expect(page.getByRole("dialog", { name: "Create Course" })).toBeVisible();
  await expect(page.getByPlaceholder("Describe the course you want to build...")).toBeVisible();
  await page.getByRole("button", { name: /close create course/i }).click();

  const firstCourse = page.locator(".course-card").filter({ hasNotText: "Create Course" }).first();
  await expect(firstCourse).toBeVisible();
  await firstCourse.click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".content-view")).toBeVisible();
});

test("settings modal and course shell survive route changes", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("radio", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page).toHaveURL(/\/Lycium\/catalog$/);

  const firstCourse = page.locator(".course-card").filter({ hasNotText: "Create Course" }).first();
  await firstCourse.click();
  await expect(page.locator(".content-view")).toBeVisible();
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page).toHaveURL(/\/Lycium\/courses\//);
});
