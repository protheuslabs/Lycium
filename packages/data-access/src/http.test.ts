import { afterEach, describe, expect, it, vi } from "vitest";
import { createLyciumLocalApi } from "./http";

describe("Lycium local API file input extraction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts browser file payloads to the input artifact reader endpoint", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          contractVersion: "lycium-file-reader-v1",
          provider: "lycium-local",
          replaceableBy: "external-source-extractor",
          artifactCount: 1,
          extractedArtifactCount: 1,
          normalizedDocuments: [
            {
              contractVersion: "normalized-document-v1",
              documentId: "file-abc123",
              status: "extracted",
            },
          ],
          sourceRegistrationCandidates: [
            {
              contractVersion: "source-registration-candidate-v1",
              documentId: "file-abc123",
            },
          ],
          artifacts: [
            {
              id: "file-abc123",
              kind: "text",
              filename: "chemistry-notes.txt",
              title: "chemistry-notes.txt",
              mimeType: "text/plain",
              sourceUrl: "",
              sourceDocumentUrl: "artifact://file-abc123",
              extractedText: "Stoichiometry and titration notes.",
              extractionStatus: "extracted",
              extractionWarnings: [],
              textLength: 34,
              contentHash: "abc123",
              reader: { contractVersion: "lycium-file-reader-v1", adapter: "lycium-local" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = createLyciumLocalApi("http://127.0.0.1:8000/");
    const result = await api.readGenerationInputFiles([
      {
        filename: "chemistry-notes.txt",
        mimeType: "text/plain",
        base64: "U3RvaWNoaW9tZXRyeQ==",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/v1/input-artifacts/read");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      files: [
        {
          filename: "chemistry-notes.txt",
          mimeType: "text/plain",
          base64: "U3RvaWNoaW9tZXRyeQ==",
        },
      ],
    });
    expect(result.artifacts[0]?.sourceDocumentUrl).toBe("artifact://file-abc123");
    expect(result.normalizedDocuments?.[0]?.contractVersion).toBe("normalized-document-v1");
    expect(result.extractedArtifactCount).toBe(1);
  });
});
