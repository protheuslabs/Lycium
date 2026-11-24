import { expect, test } from "@playwright/test";

test("area bounds can be dragged and reset restores the view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "This checks desktop pointer dragging.");
  await page.goto("/Lycium/tools/graph");
  await page.locator('math-field[aria-label="Function 1"]').click();
  await page.getByLabel("Graph analysis").click();
  await page.getByText("Area between curves", { exact: true }).click();
  await page.getByLabel("Second function").selectOption({ label: "Function 2" });
  await page.getByRole("button", { name: "Calculate area" }).click();
  await expect(page.getByText(/Approximate area:/)).toBeVisible();
  const before = await page.getByLabel("To x").first().inputValue();
  const handle = page.getByRole("button", { name: "Move end area boundary" });
  const box = await handle.boundingBox();
  if (!box) throw new Error("Area boundary is not visible.");
  await page.mouse.move(box.x + box.width / 2, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + 15, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.getByLabel("To x").first().inputValue()).not.toBe(before);
  await expect(page.getByText(/Approximate area:/)).toBeVisible();
  await page.getByLabel("Reset view").click();
  await expect(page.getByLabel("Cartesian graph of the visible functions")).toBeVisible();
});
