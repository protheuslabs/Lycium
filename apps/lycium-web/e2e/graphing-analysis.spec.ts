import { expect, test, type Page } from "@playwright/test";
import { convertAsciiMathToLatex } from "mathlive/ssr";
import type { MathfieldElement } from "mathlive";

const graphPath = "/Lycium/tools/graph";

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

async function hoverGraph(page: Page, fraction: number) {
  const settings = page.locator(".graph-settings");
  if (await settings.evaluate((element) => (element as HTMLDetailsElement).open)) await settings.locator(":scope > summary").click();
  const area = await page.locator(".graph-viewport .zoom-and-drag").boundingBox();
  if (!area) throw new Error("The graph interaction surface is missing.");
  await page.mouse.move(area.x + area.width * fraction, area.y + area.height / 2);
}

test("graph documents round-trip expressions, sliders, and viewport", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await enterExpression(page, 1, "a*x^2");
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await page.getByRole("slider", { name: "Parameter a" }).fill("2");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  const exportedTicks = await ticks.allTextContents();
  const downloadPromise = page.waitForEvent("download");
  await page.getByLabel("Export graph").click();
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Graph download is unavailable");
  await enterExpression(page, 1, "x");
  await page.getByLabel("Choose graph JSON", { exact: true }).setInputFiles(path);
  await expect.poll(() => expressionValue(page, 1)).toBe("a*x^2");
  await expect(page.getByRole("slider", { name: "Parameter a" })).toHaveValue("2");
  await expect.poll(() => ticks.allTextContents()).toEqual(exportedTicks);
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
  await page.getByRole("button", { name: "Remove function 2", exact: true }).click();
  await expectCurves(page, 1);
  const legend = page.locator(".graph-viewport .tip text");
  await hoverGraph(page, 0.7);
  await expect(legend).toHaveText("(4, 0.5)");
  await hoverGraph(page, 0.6);
  await expect(page.locator(".graph-viewport .tip")).toBeHidden();
  await hoverGraph(page, 0.4);
  await expect(legend).toHaveText("(-2, -0.25)");
});

test("square root traces only its defined domain", async ({ page }) => {
  await gotoGraph(page);
  await enterExpression(page, 1, "sqrt(x)");
  await page.getByRole("button", { name: "Remove function 2", exact: true }).click();
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await expectCurves(page, 1);
  const legend = page.locator(".graph-viewport .tip text");
  await hoverGraph(page, 0.7);
  await expect(legend).toHaveText("(4, 2)");
  await hoverGraph(page, 0.4);
  await expect(page.locator(".graph-viewport .tip")).toBeHidden();
  await hoverGraph(page, 0.5);
  await expect(legend).toHaveText("(0, 0)");
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
  await enterExpression(page, 1, "a*x+b");
  await page.getByRole("button", { name: "Add sliders a, b", exact: true }).click();
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
  await page.getByRole("button", { name: "Remove function 2", exact: true }).click();
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await expectCurves(page, 1);
  const legend = page.locator(".graph-viewport .tip text");
  await hoverGraph(page, 0.7);
  await expect(legend).toHaveText("(4, 6)");
  await hoverGraph(page, 0.6);
  await expect(page.locator(".graph-viewport .tip")).toBeHidden();
  await hoverGraph(page, 0.4);
  await expect(legend).toHaveText("(-2, 0)");
});

test("explicit points are plotted, edited, and saved in graph documents", async ({ page }) => {
  await gotoGraph(page);
  await expectCurves(page, 2);
  await page.getByLabel("Add graph element").click();
  await page.getByRole("button", { name: "Point", exact: true }).click();
  const x = page.getByRole("spinbutton", { name: "Point 1 x", exact: true });
  const y = page.getByRole("spinbutton", { name: "Point 1 y", exact: true });
  await x.fill("2"); await x.blur();
  await y.fill("3"); await y.blur();
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(3);
  const downloadPromise = page.waitForEvent("download");
  await openDisclosure(page, ".graph-workspace-menu:has([aria-label='Export graph'])");
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
  await page.getByRole("button", { name: "Remove function 2", exact: true }).click();
  await openDisclosure(page, ".graph-settings");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await expectCurves(page, 1);
  const area = await page.locator(".graph-viewport .zoom-and-drag").boundingBox();
  if (!area) throw new Error("Graph interaction surface unavailable");
  await hoverGraph(page, .6);
  await expect(page.locator(".graph-viewport .tip text")).toHaveText("(2, 4)");
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
  await openDisclosure(page, ".graph-analysis-menu");
  await page.getByText("Intersections and intercepts", { exact: true }).click();
  await page.getByRole("button", { name: "Find intersections", exact: true }).click();
  await expect(page.getByText("Functions 1 & 2: (0, 0)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add intersection 1 as point", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Point 1 x", exact: true })).toHaveValue("0");
  await enterExpression(page, 1, "1/x");
  await enterExpression(page, 2, "0");
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(3);
  await openDisclosure(page, ".graph-analysis-menu");
  await page.getByRole("button", { name: "Find intersections", exact: true }).click();
  await expect(page.getByText("No crossings found in this view.", { exact: true })).toBeVisible();
});

test("points can be dragged and moved with the keyboard without panning", async ({ page }) => {
  await gotoGraph(page);
  await page.getByLabel("Add graph element").click();
  await page.getByRole("button", { name: "Point", exact: true }).click();
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
  await page.getByRole("button", { name: "Remove function 2", exact: true }).click();
  await expectCurves(page, 1);
  await openDisclosure(page, ".graph-analysis-menu");
  await page.getByText("Intersections and intercepts", { exact: true }).click();
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
  await openDisclosure(page, ".graph-workspace-menu:has([aria-label='Export graph'])");
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
  await openDisclosure(page, ".graph-workspace-menu:has([aria-label='Export graph'])");
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
  await openDisclosure(page, ".graph-analysis-menu");
  await page.getByText("Intersections and intercepts", { exact: true }).click();
  await page.getByRole("button", { name: "Find intersections", exact: true }).click();
  await expect(page.locator(".graph-analysis-popover [role=status]")).toBeVisible();
  await openDisclosure(page, ".graph-workspace-menu:has([aria-label='Export graph'])");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("lycium-graph.png");
});
