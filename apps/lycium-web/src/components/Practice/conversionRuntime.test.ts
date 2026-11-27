import { describe, expect, it } from "vitest";
import { validateConversionChain } from "./conversionChain";
import definitions from "./conversionFamilies.json";
import { generateConversionProblem, parseConversionFamily } from "./conversionRuntime";
import { compileProblemType } from "./problemAuthoring";

const conversionCatalog = definitions.map(compileProblemType);

describe("data-driven conversion families", () => {
  it("generates and validates 1,000 instances of each family without UI knowledge", () => {
    for (const family of conversionCatalog) {
      const restored = parseConversionFamily(JSON.parse(JSON.stringify(family)));
      for (let seed = 0; seed < 1000; seed++) {
        const problem = generateConversionProblem(family, seed);
        expect(generateConversionProblem(restored, seed)).toEqual(problem);
        for (const interaction of problem.interactions) {
          if (interaction.type !== "conversion-chain") continue;
          const factors = interaction.ratios.map(ratio => ({
            numerator: ratio.numerator.id,
            denominator: ratio.denominator.id,
          }));
          expect(validateConversionChain(interaction.start, interaction.target, interaction.ratios, factors).status).toBe("correct");
          expect(validateConversionChain(interaction.start, interaction.target, interaction.ratios, [...factors].reverse()).status).toBe("correct");
          expect(validateConversionChain(interaction.start, interaction.target, interaction.ratios, [
            { numerator: factors[0].denominator, denominator: factors[0].numerator },
            ...factors.slice(1),
          ]).status).toBe("uncancelled-units");
        }
      }
    }
  });

  it("rejects definitions that reference unknown quantities", () => {
    const family = conversionCatalog[0];
    const interaction = family.interactions[0];
    if (interaction.type !== "conversion-chain") throw new Error("Expected conversion fixture.");
    expect(() => parseConversionFamily({
      ...family,
      interactions: [{ ...interaction, ratios: [["missing", interaction.quantities[0].id]] }],
    })).toThrow("unknown quantity");
  });

  it("separates incomplete input, invalid factors, and mathematical correctness", () => {
    const interaction = generateConversionProblem(conversionCatalog[0], 12).interactions[0];
    if (interaction.type !== "conversion-chain") throw new Error("Expected conversion fixture.");
    expect(validateConversionChain(interaction.start, interaction.target, interaction.ratios, [
      { numerator: "", denominator: "" },
    ])).toMatchObject({ status: "incomplete", valid: false, correct: false, factorIndex: 0 });
    expect(validateConversionChain(interaction.start, interaction.target, interaction.ratios, [
      { numerator: interaction.quantities[0].id, denominator: interaction.quantities[0].id },
    ])).toMatchObject({ status: "invalid-ratio", valid: true, correct: false, factorIndex: 0 });
    const factors = interaction.ratios.map(ratio => ({
      numerator: ratio.numerator.id,
      denominator: ratio.denominator.id,
    }));
    expect(validateConversionChain(interaction.start, interaction.target, interaction.ratios, factors))
      .toMatchObject({ status: "correct", valid: true, correct: true, credit: 1 });
  });

  it("supports categorical generation and deterministic constraints", () => {
    const family = conversionCatalog[1];
    const constrained = parseConversionFamily({
      ...family,
      variables: {
        ...family.variables,
        route: { generator: "categorical", choices: [0, 1] },
      },
      constraints: [{ left: "route", relation: "==", right: 1 }],
    });
    for (let seed = 0; seed < 100; seed++) {
      const first = generateConversionProblem(constrained, seed);
      expect(first.values.route).toBe(1);
      expect(generateConversionProblem(constrained, seed)).toEqual(first);
    }
    expect(() => generateConversionProblem(parseConversionFamily({
      ...constrained,
      constraints: [{ left: "route", relation: ">", right: 2 }],
    }), 0)).toThrow("100 attempts");
  });

  it("generates both limiting-reactant outcomes in a five-part mixed problem", () => {
    const family = conversionCatalog.find(item => item.id === "limiting-reactant-yield");
    if (!family) throw new Error("Missing limiting-reactant fixture.");
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const problem = generateConversionProblem(family, seed);
      expect(problem.interactions.map(interaction => interaction.type)).toEqual([
        "conversion-chain", "conversion-chain", "choice", "numeric", "numeric",
      ]);
      const choice = problem.interactions[2];
      if (choice.type !== "choice") throw new Error("Expected choice interaction.");
      outcomes.add(choice.expected);
      expect(problem.interactions).toHaveLength(5);
    }
    expect(outcomes).toEqual(new Set(["aluminum", "chlorine"]));
  });
});
