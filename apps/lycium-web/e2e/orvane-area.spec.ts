import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("area bounds can be dragged and reset restores the view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "This checks desktop pointer dragging.");
  await page.goto("/Lycium/tools/graph");
  await page.locator('math-field[aria-label="Function 1"]').click();
  await expect(page.getByLabel("Adjust function 1")).toBeVisible();
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

test("graph files restore and export the order of functions, tables and points", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "This checks desktop sidebar ordering.");
  await page.goto("/Lycium/tools/graph");
  const document = {
    version: 1,
    expressions: [{ id: "1", expr: "x", color: "#176b55", visible: true }],
    datasets: [{ id: "d", name: "Measurements", xLabel: "x", yLabel: "y", color: "#2563eb", visible: true, regression: false, rows: [{ x: "1", y: "2" }] }],
    points: [{ id: "p", x: 0, y: 0, color: "#c2410c", visible: true }],
    parameters: [], rowOrder: ["point:p", "function:1", "dataset:d"], viewport: null,
    settings: { grid: true, precision: "auto", snapToGrid: true }, presentation: { interactiveParameters: [] },
  };
  await page.getByLabel("Choose graph JSON").setInputFiles({ name: "graph.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.getByLabel("Dataset name")).toHaveValue("Measurements");
  const rowOrder = await page.locator(".graphing-expression-list > [style*='order']").evaluateAll((rows) => rows.map((row) => ({ order: Number((row as HTMLElement).style.order), text: row.textContent ?? "", dataset: row.querySelector('input[aria-label="Dataset name"]')?.getAttribute("value") })).sort((a, b) => a.order - b.order));
  expect(rowOrder).toHaveLength(3);
  expect(rowOrder[0].text).toContain("1");
  expect(rowOrder[2].dataset).toBe("Measurements");
  await page.getByLabel("Export graph").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("Graph export was not downloaded.");
  const exported = JSON.parse(await readFile(path, "utf8"));
  expect(exported.rowOrder).toEqual(document.rowOrder);
});

test("imports a CSV from a data row and fits its measurements", async ({ page }) => {
  await page.goto("/Lycium/tools/graph");
  await page.getByLabel("Add graph element").click();
  await page.getByRole("button", { name: "Data table", exact: true }).click();
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await (await fileChooser).setFiles({ name: "measurements.csv", mimeType: "text/csv", buffer: Buffer.from("Time,Mass\n0,1\n1,3\n2,5\n") });
  const imported = page.getByRole("region", { name: "Dataset 2" });
  await imported.click();
  await expect(imported.getByLabel("X column label")).toHaveValue("Time");
  await imported.getByLabel("Show fit").check();
  await expect(imported.getByText("y = 2x + 1 · R² = 1")).toBeVisible();
});

test("mobile graph and controls remain usable when the panel is collapsed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "This checks the mobile layout.");
  await page.goto("/Lycium/tools/graph");
  const graph = page.getByLabel("Cartesian graph of the visible functions");
  await expect(graph).toBeVisible();
  const initial = await graph.boundingBox();
  expect(initial?.width).toBeGreaterThan(300);
  expect(initial?.height).toBeGreaterThan(200);
  await page.getByLabel("Hide functions panel").click();
  await expect(page.getByLabel("Show functions panel")).toBeVisible();
  await expect.poll(async () => (await graph.boundingBox())?.height ?? 0).toBeGreaterThan(initial!.height);
  expect((await graph.boundingBox())?.width).toBeGreaterThan(300);
  await page.getByLabel("Show functions panel").click();
  await expect(page.getByLabel("Hide functions panel")).toBeVisible();
  await page.getByLabel("Graph analysis").click();
  await expect(page.getByText("Area between curves", { exact: true })).toBeVisible();
});
