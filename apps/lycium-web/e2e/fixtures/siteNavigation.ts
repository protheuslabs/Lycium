import type { Page } from "@playwright/test";

export async function openSiteSettings(page: Page) {
  await page.getByRole("button", { name: "More options", exact: true }).click();
  await page.getByRole("navigation", { name: "Site options", exact: true }).getByRole("link", { name: "Settings", exact: true }).click();
}
