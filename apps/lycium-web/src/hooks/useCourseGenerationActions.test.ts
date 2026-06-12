import { afterEach, describe, expect, it, vi } from "vitest";
import { fileToGenerationPayload } from "./useCourseGenerationActions";

class SuccessfulFileReader {
  result: string | ArrayBuffer | null = "data:text/plain;base64,U3RvaWNoaW9tZXRyeSBub3Rlcw==";
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;

  readAsDataURL(_file: File) {
    this.onload?.();
  }
}

class FailedFileReader {
  result: string | ArrayBuffer | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;

  readAsDataURL(_file: File) {
    this.onerror?.();
  }
}

describe("course generation file payload conversion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts browser files into API-ready base64 payloads", async () => {
    vi.stubGlobal("FileReader", SuccessfulFileReader);

    const payload = await fileToGenerationPayload(
      new File(["Stoichiometry notes"], "chemistry-notes.txt", { type: "text/plain" }),
    );

    expect(payload).toEqual({
      filename: "chemistry-notes.txt",
      mimeType: "text/plain",
      base64: "U3RvaWNoaW9tZXRyeSBub3Rlcw==",
    });
  });

  it("reports file read failures with the filename", async () => {
    vi.stubGlobal("FileReader", FailedFileReader);

    await expect(
      fileToGenerationPayload(new File([""], "broken.pdf", { type: "application/pdf" })),
    ).rejects.toThrow("Could not read broken.pdf.");
  });
});
