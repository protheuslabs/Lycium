import { describe, expect, it } from "vitest";
import { createFlashcardDeck } from "./flashcardAgent";
import { handleFlashcardAgentRequest } from "./flashcardAgentHttp";

describe("flashcard agent interface", () => {
  it("creates a valid editable deck import document", () => {
    const result = createFlashcardDeck({ title: "Atomic structure", cards: [{ front: "What is atomic number?", back: "The number of protons." }] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.importDocument).toMatchObject({ format: "lycium-flashcard-deck-v1", deck: { title: "Atomic structure", cards: [{ id: "agent-card-1" }] } });
  });
  it("rejects incomplete cards", () => {
    expect(createFlashcardDeck({ title: "Broken", cards: [{ front: "Question", back: "" }] })).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });
  it("handles course-ready deck generation over HTTP", async () => {
    const response = await handleFlashcardAgentRequest(new Request("https://lycium.local/flashcards", { method: "POST", body: JSON.stringify({ operation: "create_deck", input: { title: "Chemistry", cards: [{ front: "H2O?", back: "Water." }] } }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ apiVersion: "v1", ok: true, result: { importDocument: { format: "lycium-flashcard-deck-v1" } } });
  });
});
