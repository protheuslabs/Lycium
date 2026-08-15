import { describe, expect, it } from "vitest";
import { createBlockTemplate } from "./courseEditPrimitives";

describe("createBlockTemplate", () => {
  it("creates a standalone equation block", () => {
    const block = createBlockTemplate("equation", "F_net = m a\nW = F d");

    expect(block).toMatchObject({
      type: "equation",
      title: "Equation",
      equations: ["F_net = m a", "W = F d"],
      notation: "ascii",
    });
  });

  it("creates a structured worked example block", () => {
    const block = createBlockTemplate("workedExample", "Find the resultant force.");

    expect(block).toMatchObject({
      type: "workedExample",
      problem: "Find the resultant force.",
      given: expect.any(Array),
      find: expect.any(Array),
      workedAnswer: expect.any(String),
      check: expect.any(String),
    });
    expect(block.steps?.[0]?.equation).toBeTruthy();
  });
});
