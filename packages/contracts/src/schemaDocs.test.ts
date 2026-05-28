import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("schema documentation", () => {
  it("is generated from the checked-in JSON schemas", () => {
    expect(() => {
      execFileSync("node", ["scripts/generate-schema-docs.mjs", "--check"], {
        cwd: new URL("..", import.meta.url),
        stdio: "pipe",
      });
    }).not.toThrow();
  });
});
