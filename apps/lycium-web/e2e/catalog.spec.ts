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
