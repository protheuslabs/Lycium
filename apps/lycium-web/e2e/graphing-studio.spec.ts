import { expect, test, type Page } from "@playwright/test";

const graphPath = "/Lycium/tools/graph";

async function expectCurves(page: Page, count: number) {
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(count);
  for (const curve of await page.locator(".graph-viewport .graph path").all()) {
    await expect(curve).not.toHaveAttribute("d", "");
  }
}

async function observeHeight(page: Page) {
  return page.locator(".graph-surface").evaluate(async (surface) => {
    const heights: number[] = [];
    for (let i = 0; i < 60; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      heights.push(surface.getBoundingClientRect().height);
    }
    return { min: Math.min(...heights), max: Math.max(...heights), svgHeight: surface.querySelector("svg")?.getBoundingClientRect().height };
  });
}

test("graph height stays bounded over repeated renders and resizes", async ({ page }) => {
  await page.goto(graphPath);
  await expectCurves(page, 2);
  for (const size of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 1000, height: 700 }]) {
    await page.setViewportSize(size);
    await expect.poll(async () => {
      const measured = await observeHeight(page);
      return Math.abs((measured.svgHeight ?? 0) - measured.max);
    }).toBeLessThan(2);
    const measured = await observeHeight(page);
    expect(measured.max).toBeLessThan(size.height);
    expect(measured.max - measured.min).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  }
});

test("standalone workspace is focused and the functions panel can collapse", async ({ page }) => {
  await page.goto(graphPath);
  await expectCurves(page, 2);
  await expect(page.getByRole("heading", { name: "Graphing Studio", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("contentinfo", { name: "Site footer", exact: true })).toHaveCount(0);
  const functions = page.getByRole("complementary", { name: "Functions", exact: true });
  await page.getByRole("button", { name: "Hide functions panel", exact: true }).click();
  await expect(functions).toBeHidden();
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Show functions panel", exact: true }).click();
  await expect(functions).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Function 1", exact: true })).toHaveValue("x^2");
  await page.getByRole("link", { name: "Back to Tools", exact: true }).click();
  await expect(page).toHaveURL(/\/tools$/);
  await expect(page.getByRole("navigation", { name: "Primary navigation", exact: true })).toBeVisible();
});

test("editing preserves zoom and invalid functions do not break valid curves", async ({ page }) => {
  await page.goto(graphPath);
  await expectCurves(page, 2);
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  const originalTicks = await ticks.allTextContents();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(() => ticks.allTextContents()).not.toEqual(originalTicks);
  const zoomedTicks = await ticks.allTextContents();
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("y=1/x");
  await page.getByRole("textbox", { name: "Function 2", exact: true }).fill("sin(");
  await expect(page.getByRole("textbox", { name: "Function 2", exact: true })).toHaveAttribute("aria-invalid", "true");
  await expectCurves(page, 1);
  expect(await ticks.allTextContents()).toEqual(zoomedTicks);
  await page.getByRole("textbox", { name: "Function 2", exact: true }).fill("sqrt(x)");
  await expectCurves(page, 2);
  await expect(page.locator(".graphing-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect.poll(() => ticks.allTextContents()).toEqual(originalTicks);
  await expect(page.getByRole("textbox", { name: "Function 1", exact: true })).toHaveValue("y=1/x");
});

test("functions can be added, hidden, restored, and removed", async ({ page }) => {
  await page.goto("/Lycium/tools");
  await page.getByRole("link", { name: /Graphing Studio/ }).click();
  await expect(page).toHaveURL(new RegExp(`${graphPath}$`));
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Add function", exact: true }).click();
  await page.getByRole("textbox", { name: "Function 3", exact: true }).fill("y=2*x+1");
  await expectCurves(page, 3);
  await page.getByRole("button", { name: "Hide function 3", exact: true }).click();
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Show function 3", exact: true }).click();
  await expectCurves(page, 3);
  await page.getByRole("button", { name: "Remove function 3", exact: true }).click();
  await expectCurves(page, 2);
  await expect(page.getByRole("textbox", { name: "Function 3", exact: true })).toHaveCount(0);
});
