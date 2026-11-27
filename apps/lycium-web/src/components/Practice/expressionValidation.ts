import type { InteractionValidation } from "./interactionValidation";

export async function validateExpression(response: string, expected: string): Promise<InteractionValidation> {
  if (!response.trim()) return { status: "invalid", correct: false, credit: 0, message: "Enter an expression before checking." };
  try {
    const { ComputeEngine } = await import("@cortex-js/compute-engine");
    const engine = new ComputeEngine();
    const entered = engine.parse(response);
    const answer = engine.parse(expected);
    if (entered.errors.length || answer.errors.length) {
      return { status: "invalid", correct: false, credit: 0, message: "Complete the mathematical expression before checking." };
    }
    const difference = engine.box(["Subtract", entered, answer]).simplify();
    return difference.is(0)
      ? { status: "correct", correct: true, credit: 1, message: "Correct." }
      : { status: "incorrect", correct: false, credit: 0, message: "That expression is not equivalent. Check each operation and try again." };
  } catch {
    return { status: "invalid", correct: false, credit: 0, message: "This expression could not be interpreted. Check the notation and try again." };
  }
}
