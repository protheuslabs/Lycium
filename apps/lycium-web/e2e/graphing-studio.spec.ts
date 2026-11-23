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
    const gutters = await page.locator(".graphing-layout").evaluate((layout) => {
      const bounds = layout.getBoundingClientRect();
      return { left: bounds.left, right: window.innerWidth - bounds.right };
    });
    expect(gutters.left).toBeGreaterThanOrEqual(16);
    expect(gutters.right).toBeGreaterThanOrEqual(16);
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
  const mobileNavigation = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await mobileNavigation.isVisible()) await mobileNavigation.click();
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

test("parameter sliders change rendered curves while retaining the viewport", async ({ page }) => {
  await page.goto(graphPath);
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("y=a*x^2");
  await expect(page.getByRole("textbox", { name: "Function 1", exact: true })).toHaveAttribute("aria-invalid", "false");
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
  await expect(page.getByRole("textbox", { name: "Function 1", exact: true })).toHaveAttribute("aria-invalid", "true");
  await expectCurves(page, 1);
});

test("invalid slider settings do not corrupt the last valid range", async ({ page }) => {
  await page.goto(graphPath);
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
  const area = await page.locator(".graph-viewport .zoom-and-drag").boundingBox();
  if (!area) throw new Error("The graph interaction surface is missing.");
  await page.mouse.move(area.x + area.width * fraction, area.y + area.height / 2);
}

test("coordinate precision changes display only, while snapping evaluates y at the snapped x", async ({ page }) => {
  await page.goto(graphPath);
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await expectCurves(page, 1);
  await expect(page.getByRole("combobox", { name: "Coordinate precision", exact: true })).toHaveValue("auto");
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
  await page.getByRole("combobox", { name: "Coordinate precision", exact: true }).selectOption("0");
  await hoverGraph(page, 0.5635);
  await expect(legend).toHaveText("1, 2");
  expect(await curve.getAttribute("d")).toBe(originalPath);
  await page.getByRole("combobox", { name: "Coordinate precision", exact: true }).selectOption("6");
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await hoverGraph(page, 0.5635);
  await expect(legend).toHaveText("2, 4");
  expect(await curve.getAttribute("d")).toBe(originalPath);
});

test("a snapped undefined point clears its trace and tracing recovers at a valid point", async ({ page }) => {
  await page.goto(graphPath);
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("1/x");
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await expectCurves(page, 1);
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
  await page.goto(graphPath);
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("a*x^2");
  await page.getByRole("checkbox", { name: "a", exact: true }).check();
  await page.getByRole("slider", { name: "Parameter a" }).fill("2");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const ticks = page.locator(".graph-viewport .x.axis .tick text");
  const exportedTicks = await ticks.allTextContents();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Graph download is unavailable");
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("x");
  await page.getByLabel("Choose graph JSON", { exact: true }).setInputFiles(path);
  await expect(page.getByRole("textbox", { name: "Function 1", exact: true })).toHaveValue("a*x^2");
  await expect(page.getByRole("slider", { name: "Parameter a" })).toHaveValue("2");
  await expect.poll(() => ticks.allTextContents()).toEqual(exportedTicks);
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Function 1", exact: true })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Parameter a" })).toBeVisible();
  await page.getByRole("slider", { name: "Parameter a" }).fill("-1");
  await expect(page.getByRole("slider", { name: "Parameter a" })).toHaveValue("-1");
  await page.getByRole("button", { name: "Edit graph", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Function 1", exact: true })).toHaveValue("a*x^2");
});

test("suggests sliders for undefined parameters without hiding other errors", async ({ page }) => {
  await page.goto(graphPath);
  const first = page.getByRole("textbox", { name: "Function 1", exact: true });
  await first.fill("a*x^2+b");
  await page.getByRole("button", { name: "Add slider a", exact: true }).first().click();
  await page.getByRole("button", { name: "Add slider b", exact: true }).first().click();
  await expect(first).toHaveAttribute("aria-invalid", "false");
  await expectCurves(page, 2);
  await first.fill("foo(x)");
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expectCurves(page, 1);
});

test("rejects unsupported vertical equations instead of plotting a misleading function", async ({ page }) => {
  await page.goto(graphPath);
  const first = page.getByRole("textbox", { name: "Function 1", exact: true });
  await first.fill("x=2");
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/equations such as x=2 are not yet supported/)).toBeVisible();
  await expectCurves(page, 1);
});

test("trace skips a shifted asymptote and recovers", async ({ page }) => {
  await page.goto(graphPath);
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("1/(x-2)");
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
  await page.goto(graphPath);
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("sqrt(x)");
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
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

test("formatted math editing preserves loaded expressions until edited and plots the result", async ({ page }) => {
  await page.goto(graphPath);
  await expectCurves(page, 2);
  const field = page.getByRole("textbox", { name: "Function 1", exact: true });
  await field.fill("y=2*x+1");
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: "Use formatted math for Function 1", exact: true }).click();
  const math = page.locator("math-field[aria-label='Function 1']");
  await expect(math).toBeVisible();
  await page.getByRole("button", { name: "Use plain text for Function 1", exact: true }).click();
  await expect(field).toHaveValue("y=2*x+1");
  await page.getByRole("button", { name: "Use formatted math for Function 1", exact: true }).click();
  await expect(math).toBeVisible();
  await math.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText("x^2");
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Use plain text for Function 1", exact: true }).click();
  await expect(field).toHaveValue(/x\^2/);
});

test("multiple slider animations move independently, pause, and preserve their graph", async ({ page }) => {
  await page.goto(graphPath);
  await page.getByRole("button", { name: "Add slider a", exact: true }).click();
  await page.getByRole("button", { name: "Add slider b", exact: true }).click();
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("a*x+b");
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
  await page.goto(graphPath);
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("(x^2-4)/(x-2)");
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
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
  await page.goto(graphPath);
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Add point", exact: true }).click();
  const x = page.getByRole("spinbutton", { name: "Point 1 x", exact: true });
  const y = page.getByRole("spinbutton", { name: "Point 1 y", exact: true });
  await x.fill("2"); await x.blur();
  await y.fill("3"); await y.blur();
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(3);
  const downloadPromise = page.waitForEvent("download");
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
  await page.goto(graphPath);
  await page.getByRole("button", { name: "Hide function 2", exact: true }).click();
  await page.getByRole("checkbox", { name: "Snap x to grid", exact: true }).check();
  await expectCurves(page, 1);
  const area = await page.locator(".graph-viewport .zoom-and-drag").boundingBox();
  if (!area) throw new Error("Graph interaction surface unavailable");
  await page.mouse.move(area.x + area.width * .6, area.y + area.height / 2);
  await expect(page.locator(".top-right-legend")).toHaveText("2, 4");
  await page.mouse.down(); await page.mouse.up();
  await expect(page.getByRole("button", { name: "Clear pinned point 2, 4", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear pinned point 2, 4", exact: true }).click();
  await page.mouse.move(area.x + area.width * .6, area.y + area.height / 2);
  await page.mouse.down(); await page.mouse.move(area.x + area.width * .65, area.y + area.height / 2, { steps: 5 }); await page.mouse.up();
  await expect(page.getByRole("button", { name: /Clear pinned point/ })).toHaveCount(0);
});

test("finds approximate crossings and does not mistake an asymptote for one", async ({ page }) => {
  await page.goto(graphPath);
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("x");
  await page.getByRole("textbox", { name: "Function 2", exact: true }).fill("-x");
  await expectCurves(page, 2);
  await page.getByRole("button", { name: "Find intersections", exact: true }).click();
  await expect(page.getByText("Functions 1 & 2: (0, 0)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add intersection 1 as point", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Point 1 x", exact: true })).toHaveValue("0");
  await page.getByRole("textbox", { name: "Function 1", exact: true }).fill("1/x");
  await page.getByRole("textbox", { name: "Function 2", exact: true }).fill("0");
  await expect(page.locator(".graph-viewport .graph")).toHaveCount(3);
  await page.getByRole("button", { name: "Find intersections", exact: true }).click();
  await expect(page.getByText("No crossings found in this view.", { exact: true })).toBeVisible();
});
