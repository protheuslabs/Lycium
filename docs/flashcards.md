# Flashcards

The standalone workspace lives at `/tools/flashcards`, using the same header dimensions, theme tokens, and `ToolFrame` spacing as Graphing Studio.

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

## Persistence and compatibility

The existing `lycium-flashcards-v1` localStorage key and version are preserved. Missing optional deck metadata from early JSON imports is normalized without changing identifiers. Invalid records are left intact and can be downloaded as an original-data backup.

The storage adapter reads after hydration and writes only after user changes. Write failures keep current work in memory and show an export warning. An optimistic raw-data comparison refuses to overwrite another tab's changes. There is no automatic tab merge or account synchronization; reload after exporting unsaved work to load another tab's version.

## Portability

JSON format: `{ "format": "lycium-flashcard-deck-v1", "deck": { ... } }`. It contains deck metadata, color, and card content, without learner history. Imported decks always get fresh identifiers; existing decks remain intact.

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
- `FlashcardEditor.tsx` / `FlashcardImportDialog.tsx`: authoring and import preview.

## Comparison and remaining scope

Quizlet's public feature page and [official Flashcards guide](https://help.quizlet.com/hc/en-ca/articles/360030988091-Studying-with-Flashcards) informed the card-centered layout, shuffle, audio, autoplay, orientation, and starred-card sessions. The live public deck was blocked by human verification; it was not inspected behind that gate.

This pass covers core authoring and everyday flashcard study. Spaced repetition, rich LaTeX/image content, written recall, Quick Test mode, public sharing, and account synchronization remain separate milestones. No AI or new package is required for this workflow.

## Verification

`corepack pnpm --filter @lycium/web typecheck`

`corepack pnpm --filter @lycium/web test`

`corepack pnpm --filter @lycium/web exec eslint src/components/Flashcards e2e/flashcards.spec.ts --max-warnings 0`

`corepack pnpm --filter @lycium/web exec playwright test e2e/flashcards.spec.ts`

`corepack pnpm --filter @lycium/web build`
