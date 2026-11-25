import { expect, test, type Page } from "@playwright/test";
import { convertAsciiMathToLatex } from "mathlive/ssr";
import type { MathfieldElement } from "mathlive";

const graphPath = "/Lycium/tools/graph";

test("scientific graphs label axes, fit independent scales, and export annotations", async ({ page }) => {
  await page.goto(graphPath);
  await importDataset(page, "Time (s),Concentration (M)\n0,1\n10,0.5\n20,0.25\n");
  await page.getByRole("button", { name: "Use column labels for axes" }).click();
  await expect(page.locator(".graph-scientific-labels")).toContainText("Time (s)");
  await expect(page.locator(".graph-scientific-labels")).toContainText("Concentration (M)");
  await page.getByRole("checkbox", { name: "Connect points" }).check();
  await page.getByRole("combobox", { name: "Dataset 1 regression model" }).selectOption("exponential");
  await expect(page.getByText(/log-space fit/)).toContainText("R² = 1");
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(5);
  await expect(page.locator(".graph-viewport .graph").nth(3).locator("path")).toHaveAttribute("d", /L/);
  await page.getByRole("button", { name: "Fit data in view" }).click();
  await openDisclosure(page, ".graph-settings");
  await openDisclosure(page, ".graph-axis-settings");
  const xMin = Number(await page.getByLabel("X minimum").inputValue()), xMax = Number(await page.getByLabel("X maximum").inputValue());
  const yMin = Number(await page.getByLabel("Y minimum").inputValue()), yMax = Number(await page.getByLabel("Y maximum").inputValue());
  expect(xMax - xMin).toBeGreaterThan(20); expect(yMax - yMin).toBeLessThan(2);
  await page.getByRole("button", { name: "Fit equal scale" }).click();
  await expect.poll(() => page.locator(".graph-custom-grid").evaluate((grid) => {
    const spacing = (axis: string, attribute: string) => { const lines = grid.querySelectorAll(`line[data-axis="${axis}"]`); return lines.length < 2 ? 0 : Math.abs(Number(lines[1].getAttribute(attribute)) - Number(lines[0].getAttribute(attribute))); };
    const x = spacing("x", "x1"), y = spacing("y", "y1"); return x && y ? Math.abs(x / y - 1) : Infinity;
  })).toBeLessThan(0.02);
  await page.getByRole("button", { name: "Fit data in view" }).click();
  await openDisclosure(page, ".graph-settings");
  await openDisclosure(page, ".graph-label-settings");
  await page.getByLabel("Graph title", { exact: true }).fill("Reaction kinetics");
  await page.getByRole("button", { name: "Add annotation" }).click();
  await page.getByLabel("Annotation 1 text").fill("Initial concentration");
  await page.getByLabel("Annotation 1 y").fill("1");
  await page.getByLabel("Annotation 1 y").blur();
  await expect(page.locator(".graph-scientific-labels")).toContainText("Initial concentration");
  await openDisclosure(page, ".graph-workspace-menu:has([aria-label='Export graph'])");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const file = await (await download).path(); if (!file) throw new Error("SVG unavailable");
  const { readFile } = await import("node:fs/promises");
  const svg = await readFile(file, "utf8"); expect(svg).toContain("Reaction kinetics"); expect(svg).toContain("Initial concentration");
  const graphDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const graphFile = await (await graphDownload).path(); if (!graphFile) throw new Error("Graph JSON unavailable");
  const document = JSON.parse(await readFile(graphFile, "utf8"));
  expect(document.labels.title).toBe("Reaction kinetics"); expect(document.labels.annotations[0].text).toBe("Initial concentration");
  expect(document.datasets[0]).toMatchObject({ fitType: "exponential", connected: true });
});

test("imports measurements, fits a line, and preserves the table in graph files", async ({ page }) => {
  await page.goto(graphPath);
  await importDataset(page, "Time (s),Concentration (M)\n0,1\n1,3\n2,5\n");
  await expect(page.getByRole("region", { name: "Dataset 1" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "X column label" })).toHaveValue("Time (s)");
  await page.getByRole("checkbox", { name: "Show fit" }).check();
  await expect(page.getByText("y = 2x + 1 · R² = 1")).toBeVisible();
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(4);
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  const previousTicks = await ticks.allTextContents();
  await page.getByRole("button", { name: "Fit data in view" }).click();
  await expect.poll(() => ticks.allTextContents()).not.toEqual(previousTicks);
  await openDisclosure(page, ".graph-workspace-menu:has([aria-label='Export graph'])");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const file = await (await downloadPromise).path();
  if (!file) throw new Error("Graph download unavailable");
  await page.getByRole("button", { name: "Remove Dataset 1", exact: true }).click();
  await page.getByLabel("Choose graph JSON").setInputFiles(file);
  await expect(page.getByRole("spinbutton", { name: "Dataset 1 row 3 y" })).toHaveValue("5");
  await expect(page.getByText("y = 2x + 1 · R² = 1")).toBeVisible();
});

test("functions panel resizes by drag and keyboard without losing the graph", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "The mobile layout stacks the panel below the graph.");
  await page.goto(graphPath);
  await expectCurves(page, 2);
  const panel = page.getByRole("complementary", { name: "Functions" });
  const divider = page.getByRole("separator", { name: "Resize functions panel" });
  const before = await panel.boundingBox();
  const grip = await divider.boundingBox();
  if (!before || !grip) throw new Error("Panel resize handle is unavailable");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 50, grip.y + grip.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())?.width ?? 0).toBeGreaterThan(before.width + 40);
  await divider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(divider).toHaveAttribute("aria-valuenow", "390");
  await expectCurves(page, 2);
});

test("formatted input is the default and can create multiple parameter sliders", async ({ page }) => {
  await page.goto(graphPath, { waitUntil: "domcontentloaded" });
  const math = page.locator("math-field[aria-label='Function 1']");
  await expect(math).toBeVisible();
  await enterExpression(page, 1, "a*x^2+b*x+c");
  await page.getByRole("button", { name: "Add sliders a, b, c", exact: true }).click();
  for (const name of ["a", "b", "c"]) await expect(page.getByRole("slider", { name: `Parameter ${name}`, exact: true })).toBeVisible();
  await expectCurves(page, 2);
});

async function openDisclosure(page: Page, selector: string) {
  const details = page.locator(selector);
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await details.locator(":scope > summary").click();
}

async function importDataset(page: Page, csv: string) {
  await page.getByLabel("Add graph element").click();
  await page.getByRole("button", { name: "Data table", exact: true }).click();
  await page.getByLabel("Choose dataset CSV").setInputFiles({ name: "measurements.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  const imported = page.getByRole("region", { name: "Dataset 2" });
  await expect(imported).toBeAttached();
  await page.getByRole("button", { name: "Remove Dataset 1", exact: true }).click();
  await imported.click();
  await imported.getByLabel("Dataset name").fill("Dataset 1");
}

async function gotoGraph(page: Page) {
  await page.goto(graphPath);
}

function mathField(page: Page, index: number) {
  return page.locator(`math-field[aria-label="Function ${index}"]`);
}

async function enterExpression(page: Page, index: number, expression: string) {
  const field = mathField(page, index);
  await expect(field).toBeVisible();
  await field.evaluate((element, latex) => {
    (element as MathfieldElement).setValue(latex);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, convertAsciiMathToLatex(expression));
}

async function expressionValue(page: Page, index: number) {
  return mathField(page, index).evaluate((element) => (element as MathfieldElement).getValue("ascii-math").replace(/\s/g, ""));
}

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
  await gotoGraph(page);
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
    const gutters = await page.locator(".graphing-layout").evaluate((layout) => {
      const bounds = layout.getBoundingClientRect();
      return { left: bounds.left, right: window.innerWidth - bounds.right };
    });
    expect(Math.abs(gutters.left)).toBeLessThan(2);
    expect(Math.abs(gutters.right)).toBeLessThan(2);
  }
});

test("default axes retain equal scales when the graph is resized", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  for (const size of [{ width: 1280, height: 900 }, { width: 900, height: 700 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await expect.poll(async () => page.locator(".graph-viewport").evaluate((graph) => {
      const pixelsPerUnit = (selector: string, coordinate: "x" | "y") => {
        const ticks = Array.from(graph.querySelectorAll(`${selector} .tick`)).map((tick) => {
          const value = Number(tick.textContent?.trim().replace("−", "-"));
          const transform = (tick as SVGGraphicsElement).getScreenCTM();
          return { value, position: coordinate === "x" ? transform?.e ?? 0 : transform?.f ?? 0 };
        }).filter((tick) => Number.isFinite(tick.value));
        if (ticks.length < 2 || ticks[0].value === ticks[1].value) return 0;
        return Math.abs((ticks[1].position - ticks[0].position) / (ticks[1].value - ticks[0].value));
      };
      const x = pixelsPerUnit(".x.axis", "x");
      const y = pixelsPerUnit(".y.axis", "y");
      return x && y ? Math.abs(x / y - 1) : Infinity;
    })).toBeLessThan(0.02);
    await expect.poll(async () => page.locator(".graph-custom-grid").evaluate((grid) => {
      const spacing = (axis: string, attribute: string) => {
        const lines = Array.from(grid.querySelectorAll(`line[data-axis="${axis}"]`));
        return lines.length < 2 ? 0 : Math.abs(Number(lines[1].getAttribute(attribute)) - Number(lines[0].getAttribute(attribute)));
      };
      const x = spacing("x", "x1"), y = spacing("y", "y1");
      return x && y ? Math.abs(x / y - 1) : Infinity;
    })).toBeLessThan(0.02);
  }
});

test("standalone workspace is focused and the functions panel can collapse", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await expect(page.getByRole("heading", { name: "Orvane", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("contentinfo", { name: "Site footer", exact: true })).toHaveCount(0);
  const functions = page.getByRole("complementary", { name: "Functions", exact: true });
  await page.getByRole("button", { name: "Hide functions panel", exact: true }).click();
  await expect(functions).toBeHidden();
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Show functions panel", exact: true }).click();
  await expect(functions).toBeVisible();
  await expect.poll(() => expressionValue(page, 1)).toBe("x^2");
  await expect(page.getByRole("link", { name: "Lycium Tools", exact: true })).toHaveAttribute("href", /\/tools\/?$/);
});

test("editing preserves zoom and invalid functions do not break valid curves", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  const originalTicks = await ticks.allTextContents();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(() => ticks.allTextContents()).not.toEqual(originalTicks);
  const zoomedTicks = await ticks.allTextContents();
  await enterExpression(page, 1, "y=1/x");
  await enterExpression(page, 2, "sin(");
  await expect(mathField(page, 2)).toHaveAttribute("aria-invalid", "true");
  await expectCurves(page, 1);
  expect(await ticks.allTextContents()).toEqual(zoomedTicks);
  await enterExpression(page, 2, "sqrt(x)");
  await expectCurves(page, 2);
  await expect(page.locator(".graphing-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect.poll(() => ticks.allTextContents()).toEqual(originalTicks);
  await expect.poll(() => expressionValue(page, 1)).toBe("y=(1)/(x)");
});

test("functions can be added, edited, and removed", async ({ page }) => {
  await page.goto("/Lycium/tools");
  await page.getByRole("link", { name: /Orvane/ }).click();
  await expect(page).toHaveURL(new RegExp(`${graphPath}$`));
  await expectCurves(page, 2);
  await page.getByLabel("Add graph element").click();
  await page.getByRole("button", { name: "Function", exact: true }).click();
  await enterExpression(page, 3, "y=2*x+1");
  await expectCurves(page, 3);
  await page.getByRole("button", { name: "Remove function 3", exact: true }).click();
  await expectCurves(page, 2);
  await expect(mathField(page, 3)).toHaveCount(0);
});

test("parameter sliders change rendered curves while retaining the viewport", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await enterExpression(page, 1, "y=a*x^2");
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await expect(mathField(page, 1)).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const ticks = await page.locator(".graph-viewport .x.axis .tick text").allTextContents();
  const curve = page.locator(".graph-viewport .graph path").first();
  const before = await curve.getAttribute("d");
  const slider = page.getByRole("slider", { name: "Parameter a", exact: true });
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("1.1");
  await expect.poll(() => curve.getAttribute("d")).not.toBe(before);
  expect(await page.locator(".graph-viewport .x.axis .tick text").allTextContents()).toEqual(ticks);
  await page.getByRole("button", { name: "Hide functions panel", exact: true }).click();
  await page.getByRole("button", { name: "Show functions panel", exact: true }).click();
  await expect(slider).toHaveValue("1.1");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(slider).toHaveValue("1.1");
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Remove slider a", exact: true }).click();
  await expect(mathField(page, 1)).toHaveAttribute("aria-invalid", "true");
  await expectCurves(page, 1);
});

test("invalid slider settings do not corrupt the last valid range", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "a*x");
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await page.getByText("Range and step", { exact: true }).click();
  await page.getByRole("spinbutton", { name: "Step for a", exact: true }).fill("0");
  await page.getByRole("button", { name: "Apply range for a", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Step must be positive" })).toBeVisible();
  const slider = page.getByRole("slider", { name: "Parameter a", exact: true });
  await expect(slider).toHaveAttribute("step", "0.1");
  await page.getByRole("spinbutton", { name: "Minimum for a", exact: true }).fill("-2");
  await page.getByRole("spinbutton", { name: "Maximum for a", exact: true }).fill("-1");
  await page.getByRole("spinbutton", { name: "Step for a", exact: true }).fill("0.25");
  await page.getByRole("button", { name: "Apply range for a", exact: true }).click();
  await expect(slider).toHaveValue("-1");
  await expect(slider).toHaveAttribute("min", "-2");
  await expect(slider).toHaveAttribute("max", "-1");
  await expect(slider).toHaveAttribute("step", "0.25");
});

async function hoverGraph(page: Page, fraction: number) {
  const settings = page.locator(".graph-settings");
  if (await settings.evaluate((element) => (element as HTMLDetailsElement).open)) await settings.locator(":scope > summary").click();
  const area = await page.locator(".graph-viewport .zoom-and-drag").boundingBox();
  if (!area) throw new Error("The graph interaction surface is missing.");
  await page.mouse.move(area.x + area.width * fraction, area.y + area.height / 2);
}

test("coordinate precision changes display only, while snapping evaluates y at the snapped x", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Remove function 2", exact: true }).click();
  await expectCurves(page, 1);
  await openDisclosure(page, ".graph-settings");
  await expect(page.getByRole("combobox", { name: "Coordinate precision", exact: true })).toHaveValue("auto");
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).uncheck();
  const curve = page.locator(".graph-viewport .graph path").first();
  const originalPath = await curve.getAttribute("d");
  const legend = page.locator(".graph-viewport .tip text");
  await hoverGraph(page, 0.5635);
  await expect(legend).toHaveText(/^\(-?\d+(?:\.\d{1,2})?, -?\d+(?:\.\d{1,2})?\)$/);
  const [x, y] = ((await legend.textContent()) ?? "").replace(/[()]/g, "").split(", ").map(Number);
  // A narrow phone viewport may quantize the requested pointer position by a pixel.
  expect(Math.abs(x - 1.27)).toBeLessThan(0.05);
  expect(Math.abs(y - x * x)).toBeLessThan(0.04);
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("combobox", { name: "Coordinate precision", exact: true }).selectOption("0");
  await hoverGraph(page, 0.5635);
  await expect(legend).toHaveText("(1, 2)");
  expect(await curve.getAttribute("d")).toBe(originalPath);
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("combobox", { name: "Coordinate precision", exact: true }).selectOption("6");
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await hoverGraph(page, 0.5635);
  const step = Number(await page.locator(".graph-custom-grid").getAttribute("data-step"));
  const snappedX = Math.round(x / (step / 5)) * (step / 5);
  await expect(legend).toHaveText(`(${Number(snappedX.toPrecision(8))}, ${Number((snappedX * snappedX).toPrecision(8))})`);
  expect(await curve.getAttribute("d")).toBe(originalPath);
});

test("a snapped undefined point clears its trace and tracing recovers at a valid point", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "1/x");
  await page.getByRole("button", { name: "Remove function 2", exact: true }).click();
  await expectCurves(page, 1);
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  const legend = page.locator(".graph-viewport .tip text");
  await hoverGraph(page, 0.6);
  await expect(legend).toHaveText("(2, 0.5)");
  await hoverGraph(page, 0.5);
  await expect(page.locator(".graph-viewport .tip")).toBeHidden();
  await hoverGraph(page, 0.6);
  await expect(legend).toHaveText("(2, 0.5)");
});
