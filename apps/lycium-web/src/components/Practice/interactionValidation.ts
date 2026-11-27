import type { GeneratedNumericInteraction } from "./conversionRuntime";

export type InteractionValidation = {
  status: "correct" | "incorrect" | "invalid";
  correct: boolean;
  credit: 0 | 1;
  message: string;
};

export function validateChoice(response: string, expected: string): InteractionValidation {
  if (!response) return { status: "invalid", correct: false, credit: 0, message: "Choose an answer before checking." };
  return response === expected
    ? { status: "correct", correct: true, credit: 1, message: "Correct." }
    : { status: "incorrect", correct: false, credit: 0, message: "That choice is not correct. Review the established quantities and try again." };
}

function significantFigures(value: string) {
  const coefficient = value.trim().replace(/^[+-]/, "").split(/e/i)[0];
  const digits = coefficient.replace(".", "");
  if (coefficient.includes(".")) return digits.replace(/^0+/, "").length;
  return digits.replace(/^0+/, "").replace(/0+$/, "").length;
}

export function validateNumeric(response: string, interaction: Pick<GeneratedNumericInteraction, "expected" | "precision">): InteractionValidation {
  const source = response.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(source) || !Number.isFinite(Number(source))) {
    return { status: "invalid", correct: false, credit: 0, message: "Enter a valid number." };
  }
  const entered = Number(source);
  const roundedExpected = interaction.precision.type === "decimal-places"
    ? Number(interaction.expected.toFixed(interaction.precision.digits))
    : Number(interaction.expected.toPrecision(interaction.precision.digits));
  const tolerance = Math.max(Number.EPSILON * Math.abs(roundedExpected) * 4,
    interaction.precision.type === "decimal-places" ? .5 * 10 ** -interaction.precision.digits : 0);
  const numericallyCorrect = Math.abs(entered - roundedExpected) <= tolerance;
  const precisionCorrect = interaction.precision.type !== "significant-figures" || significantFigures(source) === interaction.precision.digits;
  if (numericallyCorrect && precisionCorrect) return { status: "correct", correct: true, credit: 1, message: "Correct." };
  const precisionLabel = interaction.precision.type === "decimal-places"
    ? `${interaction.precision.digits} decimal places` : `${interaction.precision.digits} significant figures`;
  return { status: "incorrect", correct: false, credit: 0, message: `Check the calculation and report the result to ${precisionLabel}.` };
}
