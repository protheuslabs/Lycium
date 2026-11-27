import { expect, test } from "@playwright/test";

test("renders all elements and supports inspection, search, trends, and comparison", async ({ page }, testInfo) => {
  await page.goto("/Lycium/tools/periodic-table");
  await expect(page.getByRole("heading", { name: "Periodic Table" })).toBeVisible();
  await expect(page.locator(".periodic-element-cell")).toHaveCount(118);
  await page.getByLabel("Search elements").fill("oxygen");
  await page.locator(".periodic-search-results").getByRole("button", { name: /Oxygen/ }).click();
  await expect(page.locator(".periodic-element-identity").getByRole("heading", { name: "Oxygen" })).toBeVisible();
  await page.getByRole("button", { name: "Electrons" }).click();
  await expect(page.getByText("Shell distribution")).toBeVisible();
  await page.getByRole("button", { name: "Trends" }).click();
  await expect(page.getByText("Color by")).toBeVisible();
  await page.getByRole("gridcell", { name: "Hydrogen, atomic number 1" }).click();
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.locator(".periodic-compare-panel article")).toHaveCount(1);
  if (testInfo.project.name === "chromium") await page.screenshot({ path: "/private/tmp/lycium-periodic-table-desktop.png", fullPage: true });
});

test("uses the same periodic table as the Molecule Studio element picker", async ({ page }, testInfo) => {
  await page.goto("/Lycium/tools/molecule");
  await page.getByRole("button", { name: /Periodic table/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose an element" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".periodic-element-cell")).toHaveCount(118);
  await dialog.getByLabel("Search elements").fill("chlorine");
  await dialog.locator(".periodic-search-results").getByRole("button", { name: /Chlorine/ }).click();
  await expect(dialog).toBeHidden();
  if (testInfo.project.name === "chromium") {
    await page.getByRole("button", { name: /Periodic table/ }).click();
    await page.screenshot({ path: "/private/tmp/lycium-element-picker.png", fullPage: true });
  }
});
