import { expect, test, type Page } from "@playwright/test";
import { convertAsciiMathToLatex } from "mathlive/ssr";
import type { MathfieldElement } from "mathlive";

const graphPath = "/Lycium/tools/graph";

test("scientific graphs label axes, fit independent scales, and export annotations", async ({ page }) => {
  await page.goto(graphPath);
  await openDisclosure(page, ".graph-datasets");
  await page.getByLabel("Choose dataset CSV").setInputFiles({ name: "kinetics.csv", mimeType: "text/csv", buffer: Buffer.from("Time (s),Concentration (M)\n0,1\n10,0.5\n20,0.25\n") });
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
  await openDisclosure(page, ".graph-label-settings");
  await page.getByLabel("Graph title", { exact: true }).fill("Reaction kinetics");
  await page.getByRole("button", { name: "Add annotation" }).click();
  await page.getByLabel("Annotation 1 text").fill("Initial concentration");
  await page.getByLabel("Annotation 1 y").fill("1");
  await page.getByLabel("Annotation 1 y").blur();
  await expect(page.locator(".graph-scientific-labels")).toContainText("Initial concentration");
  await openDisclosure(page, ".graph-file-menu");
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
  await openDisclosure(page, ".graph-datasets");
  await page.getByLabel("Choose dataset CSV").setInputFiles({ name: "measurements.csv", mimeType: "text/csv", buffer: Buffer.from("Time (s),Concentration (M)\n0,1\n1,3\n2,5\n") });
  await expect(page.getByRole("region", { name: "Dataset 1" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "X column label" })).toHaveValue("Time (s)");
  await page.getByRole("checkbox", { name: "Show fit" }).check();
  await expect(page.getByText("y = 2x + 1 · R² = 1")).toBeVisible();
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(4);
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  const previousTicks = await ticks.allTextContents();
  await page.getByRole("button", { name: "Fit data in view" }).click();
  await expect.poll(() => ticks.allTextContents()).not.toEqual(previousTicks);
  await openDisclosure(page, ".graph-file-menu");
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
  await page.goto(graphPath);
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
    expect(gutters.left).toBeGreaterThanOrEqual(16);
    expect(gutters.right).toBeGreaterThanOrEqual(16);
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
  await expect(page.getByRole("heading", { name: "Olivine", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("contentinfo", { name: "Site footer", exact: true })).toHaveCount(0);
  const functions = page.getByRole("complementary", { name: "Functions", exact: true });
  await page.getByRole("button", { name: "Hide functions panel", exact: true }).click();
  await expect(functions).toBeHidden();
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Show functions panel", exact: true }).click();
  await expect(functions).toBeVisible();
  await expect.poll(() => expressionValue(page, 1)).toBe("x^2");
  await page.getByRole("link", { name: "Back to Tools", exact: true }).click();
  await expect(page).toHaveURL(/\/tools$/);
  const mobileNavigation = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await mobileNavigation.isVisible()) await mobileNavigation.click();
  await expect(page.getByRole("navigation", { name: "Primary navigation", exact: true })).toBeVisible();
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

test("functions can be added, hidden, restored, and removed", async ({ page }) => {
  await page.goto("/Lycium/tools");
  await page.getByRole("link", { name: /Olivine/ }).click();
  await expect(page).toHaveURL(new RegExp(`${graphPath}$`));
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Add function", exact: true }).click();
  await enterExpression(page, 3, "y=2*x+1");
  await expectCurves(page, 3);
  await page.getByRole("button", { name: "Hide function 3", exact: true }).click();
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Show function 3", exact: true }).click();
  await expectCurves(page, 3);
  await page.getByRole("button", { name: "Remove function 3", exact: true }).click();
  await expectCurves(page, 2);
  await expect(mathField(page, 3)).toHaveCount(0);
});

test("parameter sliders change rendered curves while retaining the viewport", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await enterExpression(page, 1, "y=a*x^2");
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
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await expectCurves(page, 1);
  await openDisclosure(page, ".graph-settings");
  await expect(page.getByRole("combobox", { name: "Coordinate precision", exact: true })).toHaveValue("auto");
  await openDisclosure(page, ".graph-settings");
  await expect(page.getByRole("checkbox", { name: "Snap x to grid", exact: true })).not.toBeChecked();
  const curve = page.locator(".graph-viewport .graph path").first();
  const originalPath = await curve.getAttribute("d");
  const legend = page.locator(".graph-viewport .top-right-legend");
  await hoverGraph(page, 0.5635);
  await expect(legend).toHaveText(/^-?\d+(?:\.\d{1,2})?, -?\d+(?:\.\d{1,2})?$/);
  const [x, y] = ((await legend.textContent()) ?? "").split(", ").map(Number);
  // A narrow phone viewport may quantize the requested pointer position by a pixel.
  expect(Math.abs(x - 1.27)).toBeLessThan(0.05);
  expect(Math.abs(y - x * x)).toBeLessThan(0.04);
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("combobox", { name: "Coordinate precision", exact: true }).selectOption("0");
  await hoverGraph(page, 0.5635);
  await expect(legend).toHaveText("1, 2");
  expect(await curve.getAttribute("d")).toBe(originalPath);
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("combobox", { name: "Coordinate precision", exact: true }).selectOption("6");
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await hoverGraph(page, 0.5635);
  const step = Number(await page.locator(".graph-custom-grid").getAttribute("data-step"));
  const snappedX = Math.round(x / step) * step;
  await expect(legend).toHaveText(`${snappedX}, ${snappedX * snappedX}`);
  expect(await curve.getAttribute("d")).toBe(originalPath);
});

test("a snapped undefined point clears its trace and tracing recovers at a valid point", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "1/x");
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await expectCurves(page, 1);
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  const legend = page.locator(".graph-viewport .top-right-legend");
  await hoverGraph(page, 0.6);
  await expect(legend).toHaveText("2, 0.5");
  await hoverGraph(page, 0.5);
  await expect(legend).toHaveText("");
  await hoverGraph(page, 0.6);
  await expect(legend).toHaveText("2, 0.5");
});

test("graph documents round-trip and presentation locks editing while exposing selected sliders", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await enterExpression(page, 1, "a*x^2");
  await page.getByRole("checkbox", { name: "a", exact: true }).check();
  await page.getByRole("slider", { name: "Parameter a" }).fill("2");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  const exportedTicks = await ticks.allTextContents();
  const downloadPromise = page.waitForEvent("download");
  await openDisclosure(page, ".graph-file-menu");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Graph download is unavailable");
  await enterExpression(page, 1, "x");
  await page.getByLabel("Choose graph JSON", { exact: true }).setInputFiles(path);
  await expect.poll(() => expressionValue(page, 1)).toBe("a*x^2");
  await expect(page.getByRole("slider", { name: "Parameter a" })).toHaveValue("2");
  await expect.poll(() => ticks.allTextContents()).toEqual(exportedTicks);
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await expect(mathField(page, 1)).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Parameter a" })).toBeVisible();
  await page.getByRole("slider", { name: "Parameter a" }).fill("-1");
  await expect(page.getByRole("slider", { name: "Parameter a" })).toHaveValue("-1");
  await page.getByRole("button", { name: "Edit graph", exact: true }).click();
  await expect.poll(() => expressionValue(page, 1)).toBe("a*x^2");
});

test("suggests sliders for undefined parameters without hiding other errors", async ({ page }) => {
  await gotoGraph(page);
  const first = mathField(page, 1);
  await enterExpression(page, 1, "a*x^2+b");
  await page.getByRole("button", { name: "Add slider a", exact: true }).first().click();
  await page.getByRole("button", { name: "Add slider b", exact: true }).first().click();
  await expect(first).toHaveAttribute("aria-invalid", "false");
  await expectCurves(page, 2);
  await enterExpression(page, 1, "foo(x)");
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expectCurves(page, 1);
});

test("rejects unsupported vertical equations instead of plotting a misleading function", async ({ page }) => {
  await gotoGraph(page);
  const first = mathField(page, 1);
  await enterExpression(page, 1, "x=2");
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/equations such as x=2 are not yet supported/)).toBeVisible();
  await expectCurves(page, 1);
});

test("trace skips a shifted asymptote and recovers", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "1/(x-2)");
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await expectCurves(page, 1);
  const legend = page.locator(".graph-viewport .top-right-legend");
  await hoverGraph(page, 0.7);
  await expect(legend).toHaveText("4, 0.5");
  await hoverGraph(page, 0.6);
  await expect(legend).toHaveText("");
  await hoverGraph(page, 0.4);
  await expect(legend).toHaveText("-2, -0.25");
});

test("square root traces only its defined domain", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "sqrt(x)");
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await expectCurves(page, 1);
  const legend = page.locator(".graph-viewport .top-right-legend");
  await hoverGraph(page, 0.7);
  await expect(legend).toHaveText("4, 2");
  await hoverGraph(page, 0.4);
  await expect(legend).toHaveText("");
  await hoverGraph(page, 0.5);
  await expect(legend).toHaveText("0, 0");
});

test("formatted equation editing uses the math keyboard and plots the result", async ({ page }) => {
  await gotoGraph(page);
  const field = mathField(page, 1);
  await expect(field).toBeVisible();
  await enterExpression(page, 1, "x^2");
  await expectCurves(page, 2);
  await expect.poll(() => expressionValue(page, 1)).toContain("x^2");
  await expect(page.getByRole("button", { name: /Use plain text for Function/ })).toHaveCount(0);
  const keyboard = field.getByRole("button", { name: /Toggle Virtual Keyboard/ });
  await expect(keyboard).toBeVisible();
  await field.click();
  if (!(await page.evaluate(() => window.mathVirtualKeyboard.visible))) await keyboard.click();
  await expect.poll(() => page.evaluate(() => window.mathVirtualKeyboard.visible)).toBe(true);
});

test("multiple slider animations move independently, pause, and preserve their graph", async ({ page }) => {
  await gotoGraph(page);
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await page.getByRole("button", { name: "Add slider b", exact: true }).click();
  await enterExpression(page, 1, "a*x+b");
  await expectCurves(page, 2);
  const a = page.getByRole("slider", { name: "Parameter a", exact: true });
  const b = page.getByRole("slider", { name: "Parameter b", exact: true });
  await page.getByRole("button", { name: "Play slider a", exact: true }).click();
  await page.getByRole("button", { name: "Play slider b", exact: true }).click();
  await expect.poll(() => a.inputValue()).not.toBe("1");
  await expect.poll(() => b.inputValue()).not.toBe("1");
  await page.getByRole("button", { name: "Pause slider a", exact: true }).click();
  const paused = await a.inputValue();
  const bBefore = await b.inputValue();
  await expect.poll(() => b.inputValue()).not.toBe(bBefore);
  await expect(a).toHaveValue(paused);
  await page.getByRole("button", { name: "Pause slider b", exact: true }).click();
  await expectCurves(page, 2);
});

test("trace skips a removable discontinuity and recovers", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "(x^2-4)/(x-2)");
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await expectCurves(page, 1);
  const legend = page.locator(".graph-viewport .top-right-legend");
  await hoverGraph(page, 0.7);
  await expect(legend).toHaveText("4, 6");
  await hoverGraph(page, 0.6);
  await expect(legend).toHaveText("");
  await hoverGraph(page, 0.4);
  await expect(legend).toHaveText("-2, 0");
});

test("explicit points are plotted, edited, and saved in graph documents", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await openDisclosure(page, ".graph-points");
  await page.getByRole("button", { name: "Add point", exact: true }).click();
  const x = page.getByRole("spinbutton", { name: "Point 1 x", exact: true });
  const y = page.getByRole("spinbutton", { name: "Point 1 y", exact: true });
  await x.fill("2"); await x.blur();
  await y.fill("3"); await y.blur();
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(3);
  const downloadPromise = page.waitForEvent("download");
  await openDisclosure(page, ".graph-file-menu");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("Graph download unavailable");
  await page.getByRole("button", { name: "Remove point 1", exact: true }).click();
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(2);
  await page.getByLabel("Choose graph JSON", { exact: true }).setInputFiles(path);
  await expect(page.getByRole("spinbutton", { name: "Point 1 x", exact: true })).toHaveValue("2");
  await expect(page.getByRole("spinbutton", { name: "Point 1 y", exact: true })).toHaveValue("3");
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(3);
});

test("click pins a traced coordinate, pan does not, and the label can be cleared", async ({ page }) => {
  await gotoGraph(page);
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await expectCurves(page, 1);
  const area = await page.locator(".graph-viewport .zoom-and-drag").boundingBox();
  if (!area) throw new Error("Graph interaction surface unavailable");
  await hoverGraph(page, .6);
  await expect(page.locator(".top-right-legend")).toHaveText("2, 4");
  await page.mouse.down(); await page.mouse.up();
  await expect(page.getByRole("button", { name: "Clear pinned point 2, 4", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear pinned point 2, 4", exact: true }).click();
  await page.mouse.move(area.x + area.width * .6, area.y + area.height / 2);
  await page.mouse.down(); await page.mouse.move(area.x + area.width * .65, area.y + area.height / 2, { steps: 5 }); await page.mouse.up();
  await expect(page.getByRole("button", { name: /Clear pinned point/ })).toHaveCount(0);
});

test("finds approximate crossings and does not mistake an asymptote for one", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "x");
  await enterExpression(page, 2, "-x");
  await expectCurves(page, 2);
  await openDisclosure(page, ".graph-analysis");
  await page.getByRole("button", { name: "Find intersections", exact: true }).click();
  await expect(page.getByText("Functions 1 & 2: (0, 0)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add intersection 1 as point", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Point 1 x", exact: true })).toHaveValue("0");
  await enterExpression(page, 1, "1/x");
  await enterExpression(page, 2, "0");
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(3);
  await openDisclosure(page, ".graph-analysis");
  await page.getByRole("button", { name: "Find intersections", exact: true }).click();
  await expect(page.getByText("No crossings found in this view.", { exact: true })).toBeVisible();
});

test("points can be dragged and moved with the keyboard without panning", async ({ page }) => {
  await gotoGraph(page);
  await openDisclosure(page, ".graph-points");
  await page.getByRole("button", { name: "Add point", exact: true }).click();
  const handle = page.getByRole("button", { name: "Move point 1", exact: true });
  await expect(handle).toBeVisible();
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  const oldTicks = await ticks.allTextContents();
  const box = await handle.boundingBox();
  if (!box) throw new Error("Point handle unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 - 40, { steps: 6 });
  await page.mouse.up();
  const x = page.getByRole("spinbutton", { name: "Point 1 x", exact: true });
  await expect.poll(() => x.inputValue()).not.toBe("0");
  expect(await ticks.allTextContents()).toEqual(oldTicks);
  const moved = Number(await x.inputValue());
  await handle.focus(); await page.keyboard.press("ArrowRight");
  await expect.poll(async () => Number(await x.inputValue())).toBeGreaterThan(moved);
});

test("finds visible axis intercepts and can add one as a point", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "x-1");
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await expectCurves(page, 1);
  await openDisclosure(page, ".graph-analysis");
  await page.getByRole("button", { name: "Find intercepts", exact: true }).click();
  await expect(page.getByText("Function 1, x-axis: (1, 0)", { exact: true })).toBeVisible();
  await expect(page.getByText("Function 1, y-axis: (0, -1)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add intercept 1 as point", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Point 1 x", exact: true })).toHaveValue(/0\.999|1/);
});

test("exports the graph as SVG and PNG images", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  const svgDownload = page.waitForEvent("download");
  await openDisclosure(page, ".graph-file-menu");
  await page.getByRole("button", { name: "Export SVG", exact: true }).click();
  const svg = await svgDownload;
  expect(svg.suggestedFilename()).toBe("lycium-graph.svg");
  const svgPath = await svg.path();
  if (!svgPath) throw new Error("SVG download unavailable");
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(svgPath, "utf8");
  expect(content).toContain("<svg");
  expect(content).toContain("class=\"graph\"");
  expect(content).not.toContain("zoom-and-drag");
  const pngDownload = page.waitForEvent("download");
  await openDisclosure(page, ".graph-file-menu");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toBe("lycium-graph.png");
  const pngPath = await png.path();
  if (!pngPath) throw new Error("PNG download unavailable");
  const bytes = await readFile(pngPath);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});

test("axis bounds apply and invalid ranges leave the graph unchanged", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await openDisclosure(page, ".graph-settings");
  await page.getByText("Axis bounds", { exact: true }).click();
  await page.getByRole("spinbutton", { name: "X minimum", exact: true }).fill("-3");
  await page.getByRole("spinbutton", { name: "X maximum", exact: true }).fill("3");
  await page.getByRole("spinbutton", { name: "Y minimum", exact: true }).fill("-2");
  await page.getByRole("spinbutton", { name: "Y maximum", exact: true }).fill("4");
  await page.getByRole("button", { name: "Apply bounds", exact: true }).click();
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  await expect.poll(() => ticks.allTextContents()).toContain("3");
  const oldTicks = await ticks.allTextContents();
  await page.getByRole("spinbutton", { name: "X minimum", exact: true }).fill("7");
  await page.getByRole("button", { name: "Apply bounds", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "increasing" })).toBeVisible();
  expect(await ticks.allTextContents()).toEqual(oldTicks);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect.poll(() => ticks.allTextContents()).not.toEqual(oldTicks);
});

test("teacher can prepare an animated quadratic, analyze it, and export it", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  const expression = mathField(page, 1);
  await enterExpression(page, 1, "y=a*x^2+b*x+c");
  for (const name of ["a", "b", "c"]) {
    await page.locator(".graphing-suggest-slider").getByText(`Add slider ${name}`, { exact: true }).click();
    await expect(page.getByRole("slider", { name: `Parameter ${name}`, exact: true })).toBeVisible();
  }
  await expect(expression).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: "Play slider a", exact: true }).click();
  await expect.poll(() => page.getByRole("slider", { name: "Parameter a", exact: true }).inputValue()).not.toBe("1");
  await page.getByRole("button", { name: "Pause slider a", exact: true }).click();
  await openDisclosure(page, ".graph-analysis");
  await page.getByRole("button", { name: "Find intersections", exact: true }).click();
  await expect(page.locator(".graph-analysis [role=status]")).toBeVisible();
  await openDisclosure(page, ".graph-file-menu");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("lycium-graph.png");
});
