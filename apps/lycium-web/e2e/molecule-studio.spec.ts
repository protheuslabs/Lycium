import { expect, test } from "@playwright/test";

const moleculePath = "/Lycium/tools/molecule";

test("builds, edits, and restores a Lewis structure", async ({ page }) => {
  await page.goto(moleculePath);
  await expect(page.getByRole("heading", { name: "Molecule Studio" })).toBeVisible();
  await page.getByLabel("Example").selectOption("water");
  await expect(page.getByText("H2O", { exact: true })).toBeVisible();
  await expect(page.getByText("18.015 g/mol", { exact: true })).toBeVisible();
  await expect(page.getByText("Electron counts are consistent.")).toBeVisible();
  await page.getByRole("button", { name: "Clear molecule" }).click();
  await expect(page.getByText("Add atoms to begin.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("H2O", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByText("Add atoms to begin.")).toBeVisible();
});

test("places an explicit atom and exposes the educational editing tools", async ({ page }) => {
  await page.goto(moleculePath);
  await page.getByRole("button", { name: "O", exact: true }).first().click();
  const canvas = page.getByRole("application", { name: "Molecule construction canvas" });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Molecule canvas is unavailable.");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2 + 80, box.y + box.height / 2);
  await expect(page.locator(".molecule-atom")).toHaveCount(1);
  await expect(page.getByText("O", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("15.999 g/mol", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add lone electron pair" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Increase formal charge" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Double bond" })).toBeVisible();
});

test("selects and deletes one bond without deleting its atoms", async ({ page }) => {
  await page.goto(moleculePath);
  await page.getByLabel("Example").selectOption("water");
  await expect(page.locator(".molecule-bond")).toHaveCount(2);
  await page.locator(".molecule-bond").first().click({ position: { x: 20, y: 4 } });
  await page.getByRole("button", { name: "Delete selected atom or bond" }).click();
  await expect(page.locator(".molecule-bond")).toHaveCount(1);
  await expect(page.locator(".molecule-atom")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".molecule-bond")).toHaveCount(2);
});
