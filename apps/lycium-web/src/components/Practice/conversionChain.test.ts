import { describe, expect, it } from "vitest";
import { carbonateConversion, validateConversionChain } from "./conversionChain";
import { generateProblem, practiceCatalog } from "./practiceEngine";

describe("species-aware conversion chains", () => {
  it("checks 1,000 generated problems against the calculation pipeline", () => {
    const skill = practiceCatalog.find(item => item.id === "calcium-carbonate-decomposition")!;
    for (let seed = 0; seed < 1000; seed++) {
      const problem = generateProblem(skill, seed);
      const { start, target, ratios } = carbonateConversion(problem.given, problem.factor, 44);
      const factors = ratios.map(ratio => ({ numerator: ratio.numerator.id, denominator: ratio.denominator.id }));
      for (const chain of [factors, [...factors].reverse()]) {
        const result = validateConversionChain(start, target, ratios, chain);
        expect(result.status).toBe("correct");
        if (result.status === "correct") expect(result.value.toFixed(2)).toBe(problem.expected);
      }
      const [first, ...rest] = factors;
      expect(validateConversionChain(start, target, ratios, [
        { numerator: first.denominator, denominator: first.numerator }, ...rest,
      ]).status).toBe("uncancelled-units");
      expect(validateConversionChain(start, target, ratios, [
        { numerator: "product-mass", denominator: "reactant-mass" },
      ]).status).toBe("invalid-ratio");
      expect(validateConversionChain(start, target, ratios, []).status).toBe("uncancelled-units");
    }
  });
});
