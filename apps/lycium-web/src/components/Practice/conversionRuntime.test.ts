import { describe, expect, it } from "vitest";
import { validateConversionChain } from "./conversionChain";
import { conversionCatalog, generateConversionProblem, parseConversionFamily } from "./conversionRuntime";

describe("data-driven conversion families", () => {
  it("generates and validates 1,000 instances of each family without UI knowledge", () => {
    for (const family of conversionCatalog) {
      const restored = parseConversionFamily(JSON.parse(JSON.stringify(family)));
      for (let seed = 0; seed < 1000; seed++) {
        const problem = generateConversionProblem(family, seed);
        expect(generateConversionProblem(restored, seed)).toEqual(problem);
        for (const interaction of problem.interactions) {
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
    expect(() => parseConversionFamily({
      ...family,
      interactions: [{ ...interaction, ratios: [["missing", interaction.quantities[0].id]] }],
    })).toThrow("unknown quantity");
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
});
