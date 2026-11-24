# Flashcards

The standalone workspace lives at `/tools/flashcards`, using the same header dimensions, theme tokens, and `ToolFrame` spacing as Orvane.

Study mode displays read-only deck metadata. The mobile deck title is a compact picker; it does not repeat the desktop sidebar and description. Renaming, color selection, and deletion live in Edit cards. The study action area presents Reveal answer first, then the two grading choices at the same height. The prompt is darker than the answer and both have a bottom accent border.

Existing cards are edited in their own rows. Saving or cancelling returns focus to that row and preserves any pending new-card draft. Cmd/Ctrl+Enter saves and Escape cancels an inline edit. Keyboard help is collapsible on desktop and hidden on touch layouts, which show tap instructions instead.

## Study behavior

- A round captures its card identifiers at the start. Grading, starring, or changing historical review status does not refilter the active round.
- The active selection shows its captured round count; other choices show current deck counts. Options includes a way to start a new round from the current selection when membership has changed.
- Shuffle uses Fisher–Yates. Restart and shuffle operate on the current round, including when a missed-card round has since become fully known.
- Grades belong to the round. Completion reports distinct cards viewed, cards graded, known, needing review, and the percentage of graded cards known. Historical grades do not inflate a new round.
- Casual browsing and autoplay do not invent grades. A skipped card remains available for grading; grading the last ungraded card ends the round.
- Editing cards starts a fresh round when returning to study. Switching decks clears transient editor and session state.
- Stars live in learner history, separately from exported content. Reverse orientation changes presentation, never stored front/back text.
- Space/Enter flips; arrows navigate; 1/2 grade only after revealing. Shortcuts are scoped to the study surface and respect native controls. Touch users can swipe horizontally to navigate.
- Read aloud uses browser speech synthesis, with available voices and speed selection. Autoplay is optional and pauses when the tab is hidden. It does not grade cards.

## Daily review

Daily review is separate from free Flashcards study. It uses the maintained [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) scheduler, pinned to 6.0.1, with FSRS-7, 90% desired retention, fixed learning steps of 1 and 10 minutes, a 10-minute relearning step, and no interval fuzz. Node 24 is required by this dependency and is used by both CI and Pages deployment.

- The overview distinguishes due now, new, and scheduled later. Due means the actual due timestamp has arrived; the clock refreshes every 30 seconds and on window focus. Learning cards can return later the same day.
- A round takes all currently due cards first, ordered oldest first, then up to 20 new cards by default. The per-round new-card limit can be 0, 10, 20, or 50; it is not a global daily quota.
- Reveal the answer before choosing Again, Hard, Good, or Easy. Predicted intervals are displayed. Only an explicit rating writes a schedule; flipping, browsing, and leaving a round do not.
- Space/Enter flips; 1–4 rate a revealed answer. Shortcuts respect focused native controls. Cards cannot be skipped by swiping in scheduled review.
- Each reviewed card stores versioned FSRS memory, its next due timestamp, and its actual rating log. A future card cannot be reviewed early in Daily review; free Flashcards study remains available.
- Existing Known/Needs review records and stars are preserved. No ratings or schedules are inferred from casual grades, and casual study never reschedules a card.
- Removing cards or decks removes their scheduling records. Edits and reordering preserve the remaining cards’ memory. Scheduling commits merge into the latest library and reject a stale review of the same card.

## Persistence and compatibility

The existing `lycium-flashcards-v1` localStorage key and version are preserved. Missing optional deck metadata from early JSON imports is normalized without changing identifiers. Invalid records are left intact and can be downloaded as an original-data backup.

The storage adapter reads after hydration and writes only after user changes. Write failures keep current work in memory and show an export warning. An optimistic raw-data comparison refuses to overwrite another tab's changes. There is no automatic tab merge or account synchronization; reload after exporting unsaved work to load another tab's version.

## Portability

JSON format: `{ "format": "lycium-flashcard-deck-v1", "deck": { ... } }`. It contains deck metadata, color, and card content, without learner history. Imported decks always get fresh identifiers; existing decks remain intact.

File → Back up library exports `{ "format": "lycium-flashcards-backup-v1", "store": { ... } }`, preserving all deck/card identifiers, stars, casual history, FSRS memory, and review logs. Restore library validates the entire backup before asking to replace this browser’s library. Cancellation and invalid files leave existing data unchanged. Backups are bounded to 32 MB. Restore does not merge libraries or bypass unavailable browser storage; the storage warning remains visible if the restored library can only be held in memory.

CSV uses two columns, `Front,Back`, quoted with doubled internal quotes. It supports embedded commas and line breaks. TSV paste and semicolon-separated text are also supported. Recognized `Front/Back`, `Term/Definition`, and `Question/Answer` headers are skipped automatically; other headers can be skipped explicitly. Preview is required before confirmation. Duplicate text pairs are reported and retained.

CSV preserves literal content, including formulas. When opening untrusted CSV files in spreadsheet software, import the columns as text. JSON is the lossless backup format for deck metadata.

Limits: 100 decks, 5,000 cards per deck, 20,000 characters per side, 8 MB per imported file. Browser storage quota may be lower; export work if storage reports a failure.

## Module boundaries

- `flashcardDomain.ts`: content, validation, learner history, reordering and deletion cleanup.
- `flashcardSession.ts`: explicit study transitions and round statistics.
- `flashcardStorage.ts` / `useFlashcardStore.ts`: persistence and hydration.
- `flashcardImport.ts`: bounded parsing, document creation, JSON/CSV exports.
- `StudyCard.tsx`: two-sided renderer, independent of scheduling.
- `FlashcardStudy.tsx`: study controls, audio, autoplay and keyboard adapter.
- `spacedReview.ts` / `spacedReviewData.ts`: scheduler adapter, due selection, serialized memory and validation.
- `SpacedReviewPanel.tsx`: lazily loaded scheduled-study UI, independent of casual grading.
- `flashcardBackup.ts` / `FlashcardBackupActions.tsx`: full personal library backup and restore.
- `FlashcardEditor.tsx` / `FlashcardImportDialog.tsx`: authoring and import preview.

## Comparison and remaining scope

Quizlet's public feature page and [official Flashcards guide](https://help.quizlet.com/hc/en-ca/articles/360030988091-Studying-with-Flashcards) informed the card-centered layout, shuffle, audio, autoplay, orientation, and starred-card sessions. The live public deck was blocked by human verification; it was not inspected behind that gate.

Core authoring, everyday study, and local FSRS review are available. Written recall and short deterministic tests are the next milestone, followed by rich LaTeX/image content, account synchronization/sharing, and course integration. No AI is used for scheduling. All review data currently stays in this browser unless explicitly exported.

## Deployment reliability

The root layout no longer imports a stylesheet belonging to the unfinished, untracked Notes feature. Notes imports its own stylesheet locally. `robots.ts` and `sitemap.ts` explicitly use static metadata routes so the real Pages export mode succeeds. Pages and CI both use Node 24.

The line-count guard remains enforced as an independent CI job. Existing oversized frontend and backend files still fail that job; separating it lets web validation run without weakening its budgets. This pass does not claim that unrelated repository-wide CI debt is resolved.

## Verification

`corepack pnpm --filter @lycium/web typecheck`

`corepack pnpm --filter @lycium/web test`

`corepack pnpm --filter @lycium/web exec eslint src/components/Flashcards e2e/flashcards.spec.ts e2e/spaced-review.spec.ts --max-warnings 0`

`corepack pnpm --filter @lycium/web exec playwright test e2e/flashcards.spec.ts e2e/spaced-review.spec.ts`

`NEXT_OUTPUT=export NEXT_PUBLIC_LYCIUM_BASE_PATH=/Lycium NEXT_PUBLIC_LYCIUM_RUNTIME=static corepack pnpm --filter @lycium/web build`

`corepack pnpm verify:pages-export`

`corepack pnpm check:web-export-budget`
