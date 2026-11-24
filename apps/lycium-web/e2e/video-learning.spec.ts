import { expect, test } from "@playwright/test";
import { mockLocalUiApi } from "./fixtures/localUiApi";

test.beforeEach(async ({ page }) => {
  await mockLocalUiApi(page);
});

test("native video resumes with transcripts, captions, and course-scoped notes", async ({ page }, info) => {
  await page.goto("/Lycium/");
  const videoUrl = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    recorder.start();
    const started = Date.now();
    const draw = () => {
      context.fillStyle = `rgb(${(Date.now() - started) % 255}, 80, 120)`;
      context.fillRect(0, 0, 64, 64);
      if (Date.now() - started < 1300) requestAnimationFrame(draw);
      else recorder.stop();
    };
    draw();
    await stopped;
    const buffer = await new Blob(chunks, { type: "video/webm" }).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:video/webm;base64,${btoa(binary)}`;
  });
  await page.route("**/captions.vtt", (route) => route.fulfill({ contentType: "text/vtt", body: "WEBVTT\n\n00:00.000 --> 00:01.000\nA test caption.\n" }));
  await page.evaluate((url) => {
    localStorage.setItem("lycium-local-course-drafts", JSON.stringify([{
      key: "video-course", title: "Video learning", source: "local", status: "published",
      data: {
        title: "Video learning", metadata: { editPolicy: { editable: false } },
        modules: [{ id: "module", title: "Module 1", sections: [
          { id: "video-lesson", title: "A video lesson", content: [{ type: "video", url, title: "Native lesson video", clip: { startSeconds: 0, endSeconds: 1 }, transcript: "A readable lesson transcript.", transcriptUrl: "https://example.edu/transcript", captionTracks: [{ src: "/captions.vtt", label: "English", language: "en", default: true }] }] },
          { id: "next-lesson", title: "Next lesson", content: [{ type: "text", value: "Continue here." }] },
        ] }],
      },
    }]));
  }, "/test-video.webm");
  await page.route("**/test-video.webm", (route) => route.fulfill({ contentType: "video/webm", body: Buffer.from(videoUrl.split(",")[1], "base64") }));
  await page.goto("/Lycium/catalog");
  await page.getByRole("button", { name: "Open Video learning", exact: true }).click();
  await page.getByRole("button", { name: "Start course", exact: true }).click();
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect(video.locator("track[kind='captions']")).toHaveAttribute("label", "English");
  await expect(page.locator("iframe")).toHaveCount(0);
  await video.evaluate((element) => {
    element.currentTime = 0.4;
    element.dispatchEvent(new Event("timeupdate"));
  });
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("lycium-video-progress-video-course-video-lesson-video-0") ?? "{}").positionSeconds ?? 0)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Resume from" })).toBeVisible();
  expect(await page.locator("video").evaluate((element) => element.currentTime)).toBeGreaterThan(0);
  await page.getByText("Transcript", { exact: true }).click();
  await expect(page.getByText("A readable lesson transcript.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open transcript", exact: true })).toHaveAttribute("href", "https://example.edu/transcript");
  await page.getByText("Notes", { exact: true }).click();
  await page.getByRole("textbox", { name: "Lesson notes", exact: true }).fill("Remember this idea");
  await page.reload();
  await page.getByText("Notes", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Lesson notes", exact: true })).toHaveValue("Remember this idea");
  await page.screenshot({ path: info.outputPath("video-learning.png") });
});
