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
  await page.locator(".molecule-bond line:not(.molecule-bond-hit)").first().click();
  await page.getByRole("button", { name: "Delete selected atom or bond" }).click();
  await expect(page.locator(".molecule-bond")).toHaveCount(1);
  await expect(page.locator(".molecule-atom")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".molecule-bond")).toHaveCount(2);
});

test("drags from an atom to create one bonded atom", async ({ page }) => {
  await page.goto(moleculePath);
  await page.getByRole("button", { name: "C", exact: true }).first().click();
  const canvas = page.getByRole("application", { name: "Molecule construction canvas" });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Molecule canvas is unavailable.");
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.getByRole("button", { name: "O", exact: true }).first().click();
  await page.getByRole("button", { name: "Single bond" }).click();
  const carbon = page.locator(".molecule-atom").first();
  const carbonBox = await carbon.boundingBox();
  if (!carbonBox) throw new Error("Carbon atom is unavailable.");
  await page.mouse.move(carbonBox.x + carbonBox.width / 2, carbonBox.y + carbonBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(carbonBox.x + carbonBox.width / 2 + 110, carbonBox.y + carbonBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".molecule-atom")).toHaveCount(2);
  await expect(page.locator(".molecule-bond")).toHaveCount(1);
  await expect(page.locator(".molecule-properties dd").filter({ hasText: /^CO$/ })).toBeVisible();
});

test("connects existing atoms directly from selection handles", async ({ page }) => {
  await page.goto(moleculePath);
  const canvas = page.getByRole("application", { name: "Molecule construction canvas" });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Molecule canvas is unavailable.");
  await page.getByRole("button", { name: "C", exact: true }).first().click();
  await page.mouse.click(canvasBox.x + canvasBox.width / 2 - 70, canvasBox.y + canvasBox.height / 2);
  await page.getByRole("button", { name: "O", exact: true }).first().click();
  await page.mouse.click(canvasBox.x + canvasBox.width / 2 + 70, canvasBox.y + canvasBox.height / 2);
  const atoms = page.locator(".molecule-atom");
  const carbonBox = await atoms.nth(0).boundingBox();
  const handleBox = await page.locator(".molecule-connection-handle").first().boundingBox();
  if (!carbonBox || !handleBox) throw new Error("Connection controls are unavailable.");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(carbonBox.x + carbonBox.width / 2, carbonBox.y + carbonBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".molecule-bond")).toHaveCount(1);
  await expect(page.locator(".molecule-atom")).toHaveCount(2);
});
