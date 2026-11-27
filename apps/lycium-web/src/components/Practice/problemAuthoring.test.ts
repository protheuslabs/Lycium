import { describe, expect, it } from "vitest";
import definitions from "./problemTypes.json";
import advancedDefinitions from "./conversionFamilies.json";
import { generateConversionProblem } from "./conversionRuntime";
import { compileProblemType, parseAuthoredProblemType } from "./problemAuthoring";

describe("authored problem types", () => {
  it("compiles a compact definition into the shared runtime", () => {
    const authored = parseAuthoredProblemType(definitions[0]);
    const compiled = compileProblemType(authored);
    expect(compiled.id).toBe("mass-from-density");
    expect(compiled.interactions).toHaveLength(1);
    expect(compiled.interactions[0]).toMatchObject({ type: "numeric", significantFigures: 3 });
  });

  it("reproducibly generates 1,000 valid instances from one authored definition", () => {
    const compiled = compileProblemType(definitions[0]);
    for (let seed = 0; seed < 1000; seed++) {
      const first = generateConversionProblem(compiled, seed);
      const second = generateConversionProblem(compiled, seed);
      expect(first).toEqual(second);
      expect(first.prompt).toContain("Calculate its mass");
      const answer = first.interactions[0];
      expect(answer.type).toBe("numeric");
      if (answer.type === "numeric") {
        expect(answer.expected).toBe(first.values.volume as number * (first.values.density as number));
        expect(answer.precision).toEqual({ type: "significant-figures", digits: 3 });
      }
    }
  });

  it("rejects ambiguous grading precision", () => {
    expect(() => compileProblemType({
      ...definitions[0],
      answer: { ...definitions[0].answer, decimals: 2 },
    })).toThrow("either decimal places or significant figures");
  });

  it("compiles multipart V4 parts, constraints, and metadata into the same runtime", () => {
    const source = advancedDefinitions.find(item => item.id === "limiting-reactant-yield");
    if (!source) throw new Error("Missing multipart fixture.");
    const compiled = compileProblemType({
      version: 4,
      id: source.id,
      subject: "Chemistry",
      topic: "Stoichiometry",
      title: source.title,
      description: source.description,
      difficulty: 3,
      skills: ["moles", "limiting reactants", "theoretical yield"],
      variables: source.variables,
      derived: source.derived,
      constraints: source.constraints,
      prompt: source.presentation.prompt,
      equation: source.presentation.equation,
      parts: source.interactions,
      hints: ["Compare reaction capacity after converting both reactants to moles."],
      workedSolution: "Convert each mass to moles, divide by its coefficient, and use the smaller reaction extent.",
    });
    expect(compiled.interactions).toHaveLength(5);
    expect(compiled.metadata).toMatchObject({ difficulty: 3, skills: ["moles", "limiting reactants", "theoretical yield"] });
    expect(generateConversionProblem(compiled, 42).interactions.map(item => item.type)).toEqual([
      "conversion-chain", "conversion-chain", "choice", "numeric", "numeric",
    ]);
  });
});
