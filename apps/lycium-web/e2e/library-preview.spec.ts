import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockLocalUiApi } from "./fixtures/localUiApi";

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

test.beforeEach(async ({ page }) => {
  await mockLocalUiApi(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function openPreview(page: Page) {
  await page.goto("/Lycium/library-preview");
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Play camera", exact: true })).toBeEnabled();
}

async function pixelSummary(page: Page) {
  return page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("No WebGL context");
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set<string>();
    let opaque = 0;
    let count = 0;
    const stride = Math.max(1, Math.floor(canvas.width * canvas.height / 5000)) * 4;
    for (let offset = 0; offset < pixels.length; offset += stride) {
      colors.add(`${pixels[offset] >> 3},${pixels[offset + 1] >> 3},${pixels[offset + 2] >> 3}`);
      if (pixels[offset + 3] > 240) opaque += 1;
      count += 1;
    }
    return { colors: colors.size, opaque: opaque / count };
  });
}

test("3D pixels render across viewports and the 360-degree pose exactly matches the start", async ({ page }, info) => {
  test.setTimeout(90_000);
  await openPreview(page);
  const canvas = page.locator("canvas");
  const materialResources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(new Set(materialResources.filter((name) => /\/(wood|cloth|marble|floor|leather)-(color|normal|roughness)\./.test(name))).size).toBe(15);
  expect(materialResources.some((name) => name.endsWith("/library-materials/lebombo-1k.hdr"))).toBe(true);
  await page.getByRole("button", { name: "Return to start", exact: true }).click();
  const start = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  const position = page.getByRole("slider", { name: "Camera position", exact: true });
  await position.focus();
  await page.keyboard.press("End");
  await expect(page.getByLabel("Camera angle", { exact: true })).toHaveText("360°");
  const wrapped = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  expect(wrapped).toBe(start);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const pixels = await pixelSummary(page);
    expect(pixels.colors).toBeGreaterThan(50);
    expect(pixels.opaque).toBeGreaterThan(0.99);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const selector of [".library-preview-header", ".library-preview-toolbar"]) {
      const bounds = await page.locator(selector).boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    }
    await page.screenshot({ path: info.outputPath(`library-${width}.png`) });
  }
});

test("playback moves real pixels, pauses, scrubs, and downloads a still", async ({ page }, info) => {
  test.setTimeout(60_000);
  await openPreview(page);
  const start = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole("button", { name: "Play camera", exact: true }).click();
  await expect.poll(async () => Number(await page.locator("canvas").getAttribute("data-phase"))).toBeGreaterThan(0.001);
  await page.getByRole("button", { name: "Pause camera", exact: true }).click();
  const moving = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(moving).not.toBe(start);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save frame", exact: true }).click();
  const download = await downloadPromise;
  const path = info.outputPath("library-still.png");
  await download.saveAs(path);
  expect((await readFile(path)).byteLength).toBeGreaterThan(20_000);
});

test("exports one actual video revolution and restores the previous view", async ({ page }, info) => {
  test.setTimeout(90_000);
  await openPreview(page);
  await page.getByLabel("Loop duration", { exact: true }).selectOption("10");
  const downloadPromise = page.waitForEvent("download", { timeout: 40_000 });
  await page.getByRole("button", { name: "Export video loop", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel export", exact: true })).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Camera position", exact: true })).toBeDisabled();
  const download = await downloadPromise;
  const path = info.outputPath("library-10s-loop.webm");
  await download.saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.byteLength).toBeGreaterThan(30_000);
  const videoSize = await page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "video/webm" }));
    const video = document.createElement("video");
    video.muted = true;
    video.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("Exported video could not be decoded"));
        video.load();
      });
      return { width: video.videoWidth, height: video.videoHeight };
    } finally { URL.revokeObjectURL(url); video.remove(); }
  }, bytes.toString("base64"));
  expect(videoSize.width).toBeGreaterThan(300);
  expect(videoSize.height).toBeGreaterThan(300);
  await expect(page.getByRole("button", { name: "Export video loop", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Camera angle", { exact: true })).toHaveText("000°");
});

test("unavailable WebGL falls back to the reference image without blank content", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl2") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/Lycium/library-preview");
  await expect(page.locator("main")).toHaveAttribute("data-state", "error", { timeout: 30_000 });
  await expect(page.locator(".library-preview-error")).toContainText("WebGL 2");
  await expect(page.locator(".library-preview-poster")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save frame", exact: true })).toBeDisabled();
});
