import { analyzeGraph, createGraph, createGraphDocument, GRAPH_AGENT_API_VERSION } from "./graphAgent";
import type { GraphDocument } from "./graphDocument";

export type GraphAgentHttpResponse = {
  apiVersion: typeof GRAPH_AGENT_API_VERSION;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
};

/**
 * Framework-neutral POST handler for a future API or MCP adapter.
 * GitHub Pages cannot execute this itself, but a hosting adapter can pass its
 * Request directly to this function without duplicating graph logic.
 */
export async function handleGraphAgentRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ apiVersion: GRAPH_AGENT_API_VERSION, ok: false, error: { code: "method_not_allowed", message: "Use POST." } }, 405);
  try {
    const body = await request.json() as { operation?: string; input?: unknown; document?: unknown; format?: string };
    let response: GraphAgentHttpResponse;
    if (body.operation === "create_graph") {
      const result = createGraph(body.input);
      response = result.ok ? { apiVersion: GRAPH_AGENT_API_VERSION, ok: true, result: { document: result.document } } : { apiVersion: GRAPH_AGENT_API_VERSION, ok: false, error: result.error };
    } else if (body.operation === "analyze_graph") {
      const result = analyzeGraph(body.input);
      response = result.ok ? { apiVersion: GRAPH_AGENT_API_VERSION, ok: true, result: { operation: result.operation, result: result.result, limitations: result.limitations } } : { apiVersion: GRAPH_AGENT_API_VERSION, ok: false, error: result.error };
    } else if (body.operation === "export_graph") {
      response = exportGraph(body.document, body.format);
    } else {
      response = { apiVersion: GRAPH_AGENT_API_VERSION, ok: false, error: { code: "invalid_input", message: "operation must be create_graph, analyze_graph, or export_graph." } };
    }
    return jsonResponse(response, response.ok ? 200 : 422);
  } catch (error) {
    return jsonResponse({ apiVersion: GRAPH_AGENT_API_VERSION, ok: false, error: { code: "invalid_json", message: error instanceof Error ? error.message : "Request body must be valid JSON." } }, 400);
  }
}

function exportGraph(value: unknown, format: string | undefined): GraphAgentHttpResponse {
  if (format !== "json") return { apiVersion: GRAPH_AGENT_API_VERSION, ok: false, error: { code: "unsupported_format", message: "The server contract currently supports JSON export. SVG export remains browser-only because the existing renderer requires a live graph canvas." } };
  const result = createGraphDocument(value);
  if (!result.ok) return { apiVersion: GRAPH_AGENT_API_VERSION, ok: false, error: result.error };
  const document = result.document as GraphDocument;
  return { apiVersion: GRAPH_AGENT_API_VERSION, ok: true, result: { format: "json", filename: "orvane-graph.json", mediaType: "application/json", content: JSON.stringify(document, null, 2) } };
}

function jsonResponse(body: GraphAgentHttpResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
