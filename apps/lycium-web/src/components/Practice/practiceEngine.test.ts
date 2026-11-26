import { describe, expect, it } from "vitest";
import { checkPracticeAnswer, generateProblem, parsePracticeConfig, practiceCatalog } from "./practiceEngine";

describe("practice generation", () => {
  it("reproduces problems from exported settings and seed", () => {
    for (const skill of practiceCatalog) {
      const restored = parsePracticeConfig(JSON.parse(JSON.stringify(skill)));
      const problems = Array.from({ length: 100 }, (_, seed) => {
        const problem = generateProblem(skill, seed);
        expect(generateProblem(restored, seed)).toEqual(problem);
        expect(problem.given).toBeGreaterThanOrEqual(skill.given.min);
        expect(problem.given).toBeLessThanOrEqual(skill.given.max);
        expect(problem.factor).toBeGreaterThanOrEqual(skill.factor.min);
        expect(problem.factor).toBeLessThanOrEqual(skill.factor.max);
        const expected = skill.version === 2 ? problem.given / 100 * 44 : skill.operation === "divide"
          ? problem.given / problem.factor : problem.given * problem.factor;
        expect(problem.expected).toBe(expected.toFixed(skill.answer.decimals));
        return problem;
      });
      expect(new Set(problems.map(problem => problem.expected)).size).toBeGreaterThan(1);
    }
  });

  it("checks all stoichiometry stages and rejects invalid dependencies", () => {
    const skill = practiceCatalog.find(item => item.version === 2)!;
    const problem = generateProblem(skill, 12);
    expect(problem.steps?.map(step => step.expected)).toEqual([
      (problem.given / 100).toFixed(2),
      (problem.given / 100).toFixed(2),
      (problem.given / 100 * 44).toFixed(2),
    ]);
    const steps = skill.steps!;
    expect(() => parsePracticeConfig({ ...skill, steps: [{ ...steps[0], operands: ["productMass", 1] }, ...steps.slice(1)] })).toThrow("earlier steps");
    expect(() => parsePracticeConfig({ ...skill, steps: [{ ...steps[0], operands: ["given", 0] }, ...steps.slice(1)] })).toThrow("divide by zero");
  });

  it("rejects invalid settings and seeds", () => {
    expect(() => parsePracticeConfig({ ...practiceCatalog[0], factor: { ...practiceCatalog[0].factor, min: 0 } })).toThrow();
    expect(() => generateProblem(practiceCatalog[0], -1)).toThrow();
  });

  it("accepts equivalent numeric notation and distinguishes malformed input", () => {
    expect(checkPracticeAnswer("2.50e-1", "0.25")).toBe("correct");
    expect(checkPracticeAnswer("0.26", "0.25")).toBe("incorrect");
    expect(checkPracticeAnswer("0.25 mol", "0.25")).toBe("invalid");
  });
});
