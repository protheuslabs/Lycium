import { describe, expect, it } from "vitest";
import { validateExpression } from "./expressionValidation";

describe("symbolic expression validation", () => {
  it("accepts algebraically equivalent forms", async () => {
    await expect(validateExpression("x^2+6x+9", "(x+3)^2")).resolves.toMatchObject({ status: "correct", credit: 1 });
  });

  it("rejects a non-equivalent expression", async () => {
    await expect(validateExpression("x^2+3", "(x+3)^2")).resolves.toMatchObject({ status: "incorrect", credit: 0 });
  });

  it("separates incomplete notation from an incorrect answer", async () => {
    await expect(validateExpression("\\frac{1}", "x")).resolves.toMatchObject({ status: "invalid", credit: 0 });
  });
});
