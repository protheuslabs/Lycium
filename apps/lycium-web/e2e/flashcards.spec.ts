import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const path = "/Lycium/tools/flashcards";
async function sample(page: Page) {
  await page.goto(path);
  await page.getByRole("button", { name: "Try a chemistry sample" }).click();
  await expect(page.getByRole("button", { name: "Reveal answer", exact: true })).toBeVisible();
}
async function reveal(page: Page) { await page.getByRole("button", { name: "Reveal answer", exact: true }).click(); }

test("completes, restarts, and reviews only this round's missed cards", async ({ page }) => {
  await sample(page);
  await reveal(page); await page.getByRole("button", { name: "Needs review", exact: false }).click();
  await reveal(page); await page.getByRole("button", { name: "Know it", exact: false }).click();
  await reveal(page); await page.getByRole("button", { name: "Know it", exact: false }).click();
  await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
  await expect(page.locator(".fc-results")).toContainText("67%");
  await expect(page.locator(".fc-results > div").nth(0)).toContainText("3");
  await page.getByRole("button", { name: "Review 1 missed" }).click();
  await expect(page.locator(".fc-round-progress")).toContainText("/ 1");
  await reveal(page); await page.getByRole("button", { name: "Know it", exact: false }).click();
  await expect(page.locator(".fc-results")).toContainText("100%");
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reveal answer", exact: true })).toBeVisible();
  await expect(page.locator(".fc-round-progress")).toContainText(/^0 \/ \d+ graded/);
  await page.reload();
  await expect(page.locator(".fc-round-progress")).toContainText(/^0 \/ \d+ graded/);
  await expect(page.getByLabel("Study cards")).toContainText("Needs review (0)");
});

test("study mode offers one clear reveal action and keeps management in the editor", async ({ page }, testInfo) => {
  await sample(page);
  await expect(page.getByLabel("Deck title", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Deck color", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Needs review", exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Know it", exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reveal answer", exact: true })).toBeInViewport({ ratio: 1 });
  const before = await page.locator(".fc-grade-actions").boundingBox();
  if (testInfo.project.name === "mobile-chrome") {
    const card = await page.locator(".fc-card-stage").boundingBox();
    expect(card?.y).toBeLessThan(300);
    await expect(page.locator(".fc-shortcut-help")).not.toBeVisible();
    await expect(page.getByLabel("Choose deck", { exact: true })).toBeVisible();
    await expect(page.locator(".fc-card-hint .fc-touch-hint").first()).toBeVisible();
  }
  await reveal(page);
  await expect(page.getByRole("button", { name: "Reveal answer", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Know it", exact: false })).toBeVisible();
  expect((await page.locator(".fc-grade-actions").boundingBox())?.height).toBe(before?.height);
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("flashcards-answer.png"), fullPage: true });
});

test("inline editing preserves a pending new card and restores row focus", async ({ page }, testInfo) => {
  await sample(page);
  await page.getByRole("button", { name: "Edit cards" }).click();
  const add = page.getByRole("form", { name: "Add a card", exact: true });
  await add.getByRole("textbox", { name: "Front Question or term" }).fill("Pending question");
  await page.getByRole("button", { name: "Edit card 1", exact: true }).click();
  let inline = page.getByRole("form", { name: "Edit card 1", exact: true });
  await expect(inline.getByRole("textbox", { name: "Front Question or term" })).toBeFocused();
  await inline.getByRole("textbox", { name: "Back Answer or explanation" }).fill("Updated answer");
  await inline.getByRole("textbox", { name: "Back Answer or explanation" }).press("ControlOrMeta+Enter");
  await expect(page.getByRole("button", { name: "Edit card 1", exact: true })).toBeFocused();
  await expect(add.getByRole("textbox", { name: "Front Question or term" })).toHaveValue("Pending question");
  await page.getByRole("button", { name: "Edit card 1", exact: true }).click();
  inline = page.getByRole("form", { name: "Edit card 1", exact: true });
  await inline.getByRole("textbox", { name: "Front Question or term" }).fill("Discard this edit");
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("flashcards-inline-editor.png"), fullPage: true });
  await inline.getByRole("textbox", { name: "Front Question or term" }).press("Escape");
  await expect(page.getByRole("button", { name: "Edit card 1", exact: true })).toBeFocused();
  await expect(page.locator(".fc-card-row").first()).not.toContainText("Discard this edit");
  await add.getByRole("textbox", { name: "Back Answer or explanation" }).fill("Pending answer");
  await add.getByRole("textbox", { name: "Back Answer or explanation" }).press("ControlOrMeta+Enter");
  await expect(add.getByRole("textbox", { name: "Front Question or term" })).toBeEmpty();
  await expect(add.getByRole("textbox", { name: "Front Question or term" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "4 cards in this deck" })).toBeVisible();
});

test("flips both ways, scopes keyboard shortcuts, and prevents hidden-answer grading", async ({ page }) => {
  await sample(page);
  const trigger = page.locator("[data-study-card]");
  await trigger.focus(); await page.keyboard.press("2");
  await expect(page.locator(".fc-round-progress")).toContainText(/^0 \/ \d+ graded/);
  const before = await trigger.boundingBox();
  await page.keyboard.press("Space");
  await expect(page.locator(".fc-card-inner")).toHaveClass(/is-flipped/);
  await expect(page.locator(".fc-card-back")).toHaveAttribute("aria-hidden", "false");
  await page.keyboard.press("Space");
  await expect(page.locator(".fc-card-inner")).not.toHaveClass(/is-flipped/);
  expect((await trigger.boundingBox())?.height).toBe(before?.height);
  await page.keyboard.press("Enter"); await page.keyboard.press("2");
  await expect(page.locator(".fc-round-progress")).toContainText(/^1 \/ \d+ graded/);
  await page.getByRole("button", { name: "Restart session", exact: true }).focus(); await page.keyboard.press("2");
  await expect(page.locator(".fc-round-progress")).toContainText(/^1 \/ \d+ graded/);
  await page.getByRole("button", { name: "Edit cards" }).click();
  await page.getByRole("textbox", { name: "Front Question or term" }).fill("Typed prompt");
  await page.keyboard.press("Space");
  await expect(page.getByRole("textbox", { name: "Front Question or term" })).toHaveValue("Typed prompt ");
});

test("supports stars, reverse sides, deck colors, focus mode and reduced motion", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await sample(page);
  await page.getByRole("button", { name: "Edit cards" }).click();
  await page.getByLabel("Deck color", { exact: true }).click();
  await page.getByRole("button", { name: "Violet deck color" }).click();
  await page.getByLabel("Deck color", { exact: true }).click();
  await expect(page.locator(".flashcards-app")).toHaveAttribute("style", /#8060b5/);
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await page.getByRole("button", { name: "Star card", exact: true }).click();
  await page.getByLabel("Study cards").selectOption("starred");
  await expect(page.locator(".fc-round-progress")).toContainText("/ 1");
  await page.getByRole("button", { name: "Unstar card", exact: true }).click();
  await expect(page.locator(".fc-round-progress")).toContainText("/ 1");
  await expect(page.getByLabel("Study cards").locator("option:checked")).toHaveText("Starred round (1)");
  await page.getByLabel("Study settings", { exact: true }).click();
  await page.getByLabel("Start with back side").check();
  await page.getByLabel("Tint cards with deck color").check();
  await expect(page.locator(".fc-card-front")).toContainText("The number of protons");
  await page.getByLabel("Study settings", { exact: true }).click();
  const duration = await page.locator(".fc-card-inner").evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(duration).toBe("0s");
  await page.getByRole("button", { name: "Focus mode", exact: true }).click();
  await expect(page.locator(".flashcards-sidebar")).not.toBeVisible();
  await page.getByRole("button", { name: "Exit focus mode" }).click();
  if (testInfo.project.name === "chromium") await expect(page.getByRole("button", { name: "Next card", exact: true })).toBeInViewport({ ratio: 1 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("flashcards-color.png"), fullPage: true });
});

test("bulk imports 100 cards, searches, edits, cancels, reorders, duplicates, and persists", async ({ page }) => {
  await page.goto(path);
  await page.getByRole("button", { name: "Create a deck", exact: true }).click();
  await page.getByLabel("Deck title", { exact: true }).fill("Lab revision");
  await page.getByRole("button", { name: "Import in bulk" }).click();
  await page.getByLabel("Term and definition pairs").fill(Array.from({ length: 100 }, (_, i) => "Term " + i + "\tDefinition " + i).join("\n"));
  await page.getByRole("button", { name: "Preview cards" }).click();
  await expect(page.getByRole("heading", { name: "100 cards ready" })).toBeVisible();
  await page.getByRole("button", { name: "Import 100 cards" }).click();
  await expect(page.getByRole("heading", { name: "100 cards in this deck" })).toBeVisible();
  await page.getByLabel("Search cards").fill("Term 98");
  await expect(page.locator(".fc-card-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit card 99", exact: true }).click();
  await page.getByRole("form", { name: "Edit card 99", exact: true }).getByRole("textbox", { name: "Back Answer or explanation" }).fill("Updated explanation");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Edit card 99", exact: true })).toBeFocused();
  await expect(page.locator(".fc-card-row")).toContainText("Updated explanation");
  await page.getByRole("button", { name: "Edit card 99", exact: true }).click();
  await page.getByRole("form", { name: "Edit card 99", exact: true }).getByRole("textbox", { name: "Front Question or term" }).fill("Unsaved");
  await page.getByRole("button", { name: "Cancel edit" }).click();
  await expect(page.locator(".fc-card-row")).toContainText("Term 98");
  await page.getByLabel("More actions for card 99", { exact: true }).click();
  await page.getByRole("button", { name: "Move up", exact: true }).click();
  await expect(page.getByLabel("More actions for card 98", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByRole("heading", { name: "101 cards in this deck" })).toBeVisible();
  await page.reload();
  await expect(page.locator(".fc-deck-summary h2")).toHaveText("Lab revision");
  await page.getByRole("button", { name: "Edit cards" }).click();
  await expect(page.getByLabel("Deck title", { exact: true })).toHaveValue("Lab revision");
  await expect(page.getByRole("heading", { name: "101 cards in this deck" })).toBeVisible();
});

test("exports and reimports JSON and CSV without replacing existing decks", async ({ page }) => {
  await sample(page);
  await page.locator(".fc-file-menu > summary").click();
  const jsonPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export deck JSON" }).click();
  const jsonPath = await (await jsonPromise).path();
  if (!jsonPath) throw new Error("JSON download missing");
  await page.getByRole("button", { name: "Import cards…" }).click();
  await page.getByLabel("Import deck file").setInputFiles({ name: "deck.json", mimeType: "application/json", buffer: await readFile(jsonPath) });
  await page.getByRole("button", { name: "Import 3 cards" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("lycium-flashcards-v1") ?? "{}"));
  expect(saved.decks).toHaveLength(2); expect(saved.decks[0].id).not.toBe(saved.decks[1].id);
  const csvPromise = page.waitForEvent("download");
  await page.locator(".fc-file-menu > summary").click();
  await page.getByRole("button", { name: "Export cards CSV" }).click();
  const csvPath = await (await csvPromise).path();
  if (!csvPath) throw new Error("CSV download missing");
  await page.getByRole("button", { name: "Import cards…" }).click();
  await page.getByLabel("Import deck file").setInputFiles({ name: "deck.csv", mimeType: "text/csv", buffer: await readFile(csvPath) });
  await expect(page.getByRole("heading", { name: "3 cards ready" })).toBeVisible();
});

test("autoplay reveals both sides, pauses, and completes without invented grades", async ({ page }) => {
  await sample(page);
  await page.getByLabel("Study settings", { exact: true }).click();
  await page.getByLabel("Seconds per side").selectOption("2");
  await page.getByLabel("Study settings", { exact: true }).click();
  await page.getByRole("button", { name: "Start autoplay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Flip card to prompt", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause autoplay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start autoplay", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  await page.getByRole("button", { name: "Start autoplay", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Round complete" })).toBeVisible({ timeout: 7000 });
  await expect(page.locator(".fc-complete")).toContainText("0 of 3 cards graded");
});

test("preserves invalid saved data and explains unavailable persistence", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("lycium-flashcards-v1", "original unreadable content"));
  await page.goto(path);
  await expect(page.locator(".fc-storage-warning")).toContainText("original data has been preserved");
  await page.getByRole("button", { name: "Create a deck", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("lycium-flashcards-v1"))).toBe("original unreadable content");
});

test("reads either side aloud with the selected voice and speed", async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: Array<{ text: string; rate: number; voice: string | undefined }> = [];
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: class {
      text: string;
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;
      constructor(text: string) { this.text = text; }
    } });
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => [{ voiceURI: "test-english", name: "Test English", lang: "en-US" }],
      addEventListener: () => {}, removeEventListener: () => {}, cancel: () => {},
      speak: (utterance: SpeechSynthesisUtterance) => spoken.push({ text: utterance.text, rate: utterance.rate, voice: utterance.voice?.voiceURI }),
    } });
    Object.defineProperty(window, "testSpoken", { value: spoken });
  });
  await sample(page);
  await page.getByLabel("Study settings", { exact: true }).click();
  await page.getByLabel("Voice and language").selectOption("test-english");
  await page.getByLabel("Reading speed").selectOption("1.25");
  await page.getByLabel("Study settings", { exact: true }).click();
  await page.getByRole("button", { name: "Read current side aloud", exact: true }).click();
  await reveal(page);
  await page.getByRole("button", { name: "Read current side aloud", exact: true }).click();
  const spoken = await page.evaluate(() => (window as Window & { testSpoken: Array<{ text: string; rate: number; voice: string }> }).testSpoken);
  expect(spoken).toHaveLength(2);
  expect(spoken[0]).toMatchObject({ rate: 1.25, voice: "test-english" });
  expect(spoken[1].text).toContain("number of protons");
});

test("switching decks resets transient editing and supports dark theme", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("lycium-theme-mode", "dark"));
  await sample(page);
  await page.getByRole("button", { name: "Edit cards" }).click();
  await page.getByRole("button", { name: "Edit card 1", exact: true }).click();
  await page.getByRole("button", { name: "New deck", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add a card", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Front Question or term" })).toBeEmpty();
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your first card starts here" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (testInfo.project.name === "mobile-chrome") await page.getByLabel("Choose deck", { exact: true }).click();
  await page.getByRole("button", { name: "Chemistry fundamentals 3 cards", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reveal answer", exact: true })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("flashcards-dark.png"), fullPage: true });
});

test("deleting cards and decks removes their review records", async ({ page }) => {
  await sample(page);
  await reveal(page); await page.getByRole("button", { name: "Know it", exact: false }).click();
  await page.getByRole("button", { name: "Edit cards" }).click();
  await page.getByLabel("More actions for card 1", { exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete card", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2 cards in this deck" })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("lycium-flashcards-v1") ?? "{}"));
  expect(Object.keys(saved.history[saved.decks[0].id])).toHaveLength(0);
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await expect(page.locator(".fc-card-front")).toContainText("pH");
  await page.getByRole("button", { name: "Edit cards" }).click();
  await page.getByLabel("Deck actions", { exact: true }).click();
  await page.getByRole("button", { name: "Delete deck", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Learn it. Recall it. Keep it." })).toBeVisible();
});

test("touch swipes navigate without flipping or grading", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Touch gestures are exercised on the mobile device.");
  await sample(page);
  await page.locator(".fc-card-trigger").scrollIntoViewIfNeeded();
  const rect = await page.locator(".fc-card-trigger").boundingBox();
  if (!rect) throw new Error("Study card missing");
  const client = await page.context().newCDPSession(page);
  const x = rect.x + rect.width * .75, y = rect.y + rect.height * .5;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 100, y }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".fc-player-navigation")).toContainText("2 / 3");
  await expect(page.locator(".fc-round-progress")).toContainText(/^0 \/ \d+ graded/);
  await expect(page.getByRole("button", { name: "Reveal answer", exact: true })).toBeVisible();
});
