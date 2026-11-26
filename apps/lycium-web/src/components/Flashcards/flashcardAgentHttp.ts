import { FLASHCARD_AGENT_API_VERSION, createFlashcardDeck, validateFlashcardDeck } from "./flashcardAgent";

export async function handleFlashcardAgentRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") return response({ apiVersion: FLASHCARD_AGENT_API_VERSION, ok: false, error: { code: "method_not_allowed", message: "Use POST." } }, 405);
  try {
    const body = await request.json() as { operation?: string; input?: unknown; deck?: unknown };
    if (body.operation === "create_deck") { const result = createFlashcardDeck(body.input); return response(result.ok ? { apiVersion: FLASHCARD_AGENT_API_VERSION, ok: true, result: { deck: result.deck, importDocument: result.importDocument } } : { apiVersion: FLASHCARD_AGENT_API_VERSION, ok: false, error: result.error }, result.ok ? 200 : 422); }
    if (body.operation === "validate_deck") { const result = validateFlashcardDeck(body.deck); return response(result.ok ? { apiVersion: FLASHCARD_AGENT_API_VERSION, ok: true, result: { deck: result.deck } } : { apiVersion: FLASHCARD_AGENT_API_VERSION, ok: false, error: result.error }, result.ok ? 200 : 422); }
    return response({ apiVersion: FLASHCARD_AGENT_API_VERSION, ok: false, error: { code: "invalid_input", message: "operation must be create_deck or validate_deck." } }, 422);
  } catch (error) { return response({ apiVersion: FLASHCARD_AGENT_API_VERSION, ok: false, error: { code: "invalid_json", message: error instanceof Error ? error.message : "Request body must be valid JSON." } }, 400); }
}

function response(body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
