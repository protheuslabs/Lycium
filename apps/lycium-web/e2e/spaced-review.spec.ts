import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const path = "/Lycium/tools/flashcards";
const time = new Date("2026-11-23T12:00:00.000Z");
async function openReview(page: Page) {
  await page.clock.setFixedTime(time);
  await page.goto(path);
  await page.getByRole("button", { name: "Try a chemistry sample" }).click();
  await page.getByRole("button", { name: "Daily review", exact: true }).click();
}
async function reveal(page: Page) { await page.getByRole("button", { name: "Reveal answer", exact: true }).click(); }
async function stored(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lycium-flashcards-v1") ?? "{}") as { decks: Array<{ id: string; cards: Array<{ id: string }> }>; history: Record<string, Record<string, { reviewCount: number }>>; schedules: Record<string, Record<string, { memory: { dueAt: string; reps: number }; reviews: Array<{ rating: number }> }>> });
}

test("reviews with all four ratings, persists due dates, and keeps casual study separate", async ({ page }, testInfo) => {
  await openReview(page);
  const review = page.getByRole("region", { name: "Daily review", exact: true });
  await expect(review.locator(".fc-review-counts")).toContainText("3New cards");
  await review.getByRole("button", { name: "Start review", exact: true }).click();
  await page.keyboard.press("3");
  await expect(review.locator(".fc-study-toolbar")).toContainText("0 reviewed");
  await expect(review.getByRole("button", { name: /^Good/ })).toHaveCount(0);
  await reveal(page);
  await expect(review.getByRole("button", { name: /^Again/ })).toBeEnabled();
  await expect(review.getByRole("button", { name: /^Again/ })).toContainText("1 min");
  await expect(review.getByRole("button", { name: /^Good/ })).toContainText("10 min");
  await page.screenshot({ path: testInfo.outputPath("daily-review-ratings.png"), fullPage: true, animations: "disabled" });
  await page.keyboard.press("1");
  await expect(review.locator(".fc-study-toolbar")).toContainText("1 reviewed");
  await reveal(page); await review.getByRole("button", { name: /^Hard/ }).click();
  await reveal(page); await review.getByRole("button", { name: /^Easy/ }).click();
  await expect(review.getByRole("heading", { name: "Review round finished" })).toBeVisible();
  await expect(review.getByRole("button", { name: "Start review", exact: true })).toBeDisabled();
  const state = await stored(page), deck = state.decks[0], first = deck.cards[0].id;
  expect(state.history[deck.id] ?? {}).toEqual({});
  expect(state.schedules[deck.id][first].memory.dueAt).toBe("2026-11-23T12:01:00.000Z");
  expect(state.schedules[deck.id][first].reviews).toEqual([expect.objectContaining({ rating: 1 })]);
  await page.reload();
  await reveal(page); await page.getByRole("button", { name: /^Know it/ }).click();
  const casual = await stored(page);
  expect(casual.schedules).toEqual(state.schedules);
  await page.getByRole("button", { name: "Daily review", exact: true }).click();
  await expect(review.locator(".fc-review-counts")).toContainText("0Due now");
  await page.clock.setFixedTime(new Date("2026-11-23T12:01:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(review.locator(".fc-review-counts")).toContainText("1Due now");
  await review.getByRole("button", { name: "Start review", exact: true }).click();
  await expect(review.locator(".fc-study-toolbar")).toContainText("1 remaining");
  await reveal(page); await review.getByRole("button", { name: /^Good/ }).click();
  await expect(review.getByRole("heading", { name: "Review round finished" })).toBeVisible();
  const updated = await stored(page);
  expect(updated.schedules[deck.id][first].memory.reps).toBe(2);
  expect(updated.history).toEqual(casual.history);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("defaults to twenty new cards and supports a due-only round", async ({ page }) => {
  await page.addInitScript(() => {
    const timestamp = "2026-11-23T12:00:00.000Z";
    const deck = { id: "large-deck", title: "Review limits", description: "", createdAt: timestamp, updatedAt: timestamp, cards: Array.from({ length: 25 }, (_, i) => ({ id: "card-" + i, front: "Question " + i, back: "Answer " + i, createdAt: timestamp, updatedAt: timestamp })) };
    localStorage.setItem("lycium-flashcards-v1", JSON.stringify({ version: 1, decks: [deck], history: {} }));
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Daily review", exact: true }).click();
  await expect(page.getByLabel("New cards per review round")).toHaveValue("20");
  await page.getByLabel("New cards per review round").selectOption("0");
  await expect(page.getByRole("button", { name: "Start review", exact: true })).toBeDisabled();
  await page.getByLabel("New cards per review round").selectOption("20");
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await expect(page.locator(".fc-study-toolbar")).toContainText("20 remaining");
  await reveal(page);
  await page.getByRole("button", { name: "Back to review overview" }).focus();
  await page.keyboard.press("3");
  expect((await stored(page)).schedules).toBeUndefined();
});

test("backs up and restores schedules, stars, and history without silent replacement", async ({ page }) => {
  await openReview(page);
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await page.getByRole("button", { name: "Star card", exact: true }).click();
  await reveal(page); await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.locator(".fc-study-toolbar")).toContainText("1 reviewed");
  const before = await stored(page);
  await page.getByText("File", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up library", exact: true }).click();
  const file = await download, backupPath = await file.path();
  expect(backupPath).toBeTruthy();
  const buffer = await readFile(backupPath!);
  await page.getByLabel("Restore library backup", { exact: true }).setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"wrong":true}') });
  await expect(page.getByRole("status").filter({ hasText: "Choose a Lycium library backup" })).toBeVisible();
  expect((await stored(page)).schedules).toEqual(before.schedules);
  await page.getByRole("button", { name: "Edit cards" }).click();
  await page.getByLabel("Deck actions", { exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete deck", exact: true }).click();
  await expect(page.getByRole("button", { name: "Try a chemistry sample" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Restore library backup", { exact: true }).setInputFiles({ name: "backup.json", mimeType: "application/json", buffer });
  await expect.poll(async () => (await stored(page)).decks.length).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Restore library backup", { exact: true }).setInputFiles({ name: "backup.json", mimeType: "application/json", buffer });
  await expect(page.getByRole("status").filter({ hasText: "Library restored" })).toBeVisible();
  const after = await stored(page);
  expect(after.decks).toEqual(before.decks);
  expect(after.history).toEqual(before.history);
  expect(after.schedules).toEqual(before.schedules);
});
