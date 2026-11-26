import catalog from "./basicChemistry.json";
import { conversionCatalog, generateConversionProblem, parseConversionFamily, type ConversionFamily, type ConversionProblem } from "./conversionRuntime";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const label = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 180;
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const range = (value: unknown) =>
  record(value) && label(value.label) && label(value.unit) &&
  integer(value.min, 1, 10_000) && integer(value.max, value.min, 10_000)
    ? { label: value.label, unit: value.unit, min: value.min, max: value.max }
    : null;

type Calculation = {
  id: string; label: string; unit: string; decimals: number;
  operation: "multiply" | "divide" | "add" | "subtract";
  operands: [string | number, string | number];
};

function parseCalculations(value: unknown): Calculation[] {
  if (!Array.isArray(value) || !value.length || value.length > 30) throw new Error("Define 1–30 calculation steps.");
  const known = new Set(["given", "factor"]);
  return value.map((step: unknown) => {
    if (!record(step) || !label(step.id) || known.has(step.id) || !label(step.label) || !label(step.unit) ||
      !integer(step.decimals, 0, 6) ||
      (step.operation !== "multiply" && step.operation !== "divide" && step.operation !== "add" && step.operation !== "subtract") ||
      !Array.isArray(step.operands) || step.operands.length !== 2) throw new Error("Invalid calculation step.");
    function operand(value: unknown): string | number {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && known.has(value)) return value;
      throw new Error("Operands must be constants, given values, or earlier steps.");
    }
    const operands: Calculation["operands"] = [operand(step.operands[0]), operand(step.operands[1])];
    known.add(step.id);
    return { id: step.id, label: step.label, unit: step.unit, decimals: step.decimals, operation: step.operation, operands };
  });
}

function parseLegacyPracticeConfig(value: unknown) {
  if (!record(value) || (value.version !== 1 && value.version !== 2) || !label(value.id) ||
    !label(value.category) || !label(value.title) || !label(value.hint) ||
    (value.operation !== "multiply" && value.operation !== "divide") ||
    !record(value.answer) || !label(value.answer.label) || !label(value.answer.unit) ||
    !integer(value.answer.decimals, 0, 6)) {
    throw new Error("Expected a version 1 skill with an ID, category, title, hint, operation and answer specification.");
  }
  const given = range(value.given);
  const factor = range(value.factor);
  if (!given || !factor) throw new Error("Both inputs need labels, units and ordered integer bounds between 1 and 10,000.");
  const steps = value.version === 2 ? parseCalculations(value.steps) : undefined;
  const final = steps?.at(-1);
  if (final && (final.unit !== value.answer.unit || final.decimals !== value.answer.decimals)) {
    throw new Error("The final step must match the answer unit and precision.");
  }
  const bounds = new Map<string, number[]>([["given", [given.min, given.max]], ["factor", [factor.min, factor.max]]]);
  for (const step of steps ?? []) {
    const [left, right] = step.operands.map(item => typeof item === "number" ? [item] : bounds.get(item)!);
    if (step.operation === "divide" && Math.min(...right) <= 0 && Math.max(...right) >= 0) {
      throw new Error(`Calculation "${step.id}" can divide by zero.`);
    }
    const endpoints = left.flatMap(a => right.map(b => calculate(step.operation, a, b)));
    if (endpoints.some(result => !Number.isFinite(result) || Math.abs(result) >= 1e21)) {
      throw new Error(`Calculation "${step.id}" is out of range.`);
    }
    bounds.set(step.id, [Math.min(...endpoints), Math.max(...endpoints)]);
  }
  return {
    version: value.version as 1 | 2, id: value.id, category: value.category, title: value.title,
    steps,
    hint: value.hint, operation: value.operation, given, factor,
    answer: { label: value.answer.label, unit: value.answer.unit, decimals: value.answer.decimals },
    symbols: record(value.symbols) && label(value.symbols.first) && label(value.symbols.second) && label(value.symbols.result)
      ? { first: value.symbols.first, second: value.symbols.second, result: value.symbols.result }
      : { first: "a", second: "b", result: "r" },
  };
}

function calculate(operation: Calculation["operation"], a: number, b: number) {
  switch (operation) {
    case "multiply": return a * b;
    case "divide": return a / b;
    case "add": return a + b;
    case "subtract": return a - b;
  }
}

export type LegacyPracticeConfig = ReturnType<typeof parseLegacyPracticeConfig>;
export type PracticeConfig = LegacyPracticeConfig | ConversionFamily;
export function parsePracticeConfig(value: unknown): PracticeConfig {
  return record(value) && value.version === 3 ? parseConversionFamily(value) : parseLegacyPracticeConfig(value);
}
export const practiceCatalog: PracticeConfig[] = [...catalog.map(parseLegacyPracticeConfig), ...conversionCatalog];

export type LegacyProblem = {
  given: number; factor: number; expected: string;
  steps: Array<Calculation & { expected: string; explanation: string }> | undefined;
  symbol: string;
};
export function generateProblem(config: ConversionFamily, seed: number): ConversionProblem;
export function generateProblem(config: LegacyPracticeConfig, seed: number): LegacyProblem;
export function generateProblem(config: PracticeConfig, seed: number): ConversionProblem | LegacyProblem;
export function generateProblem(config: PracticeConfig, seed: number): ConversionProblem | LegacyProblem {
  if (config.version === 3) return generateConversionProblem(config, seed);
  if (!integer(seed, 0, 0xffffffff)) throw new Error("Seed must be an integer from 0 to 4,294,967,295.");
  let state = seed;
  function sample(input: LegacyPracticeConfig["given"]) {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    const fraction = ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
    return input.min + Math.floor(fraction * (input.max - input.min + 1));
  }
  const given = sample(config.given);
  const factor = sample(config.factor);
  const divide = config.operation === "divide";
  const values = new Map([["given", given], ["factor", factor]]);
  const steps = config.steps?.map(step => {
    const [a, b] = step.operands.map(operand => typeof operand === "number" ? operand : values.get(operand)!);
    const result = calculate(step.operation, a, b);
    if (!Number.isFinite(result) || Math.abs(result) >= 1e21) throw new Error(`Calculation "${step.id}" is out of range.`);
    values.set(step.id, result);
    const symbol = { multiply: "×", divide: "÷", add: "+", subtract: "−" }[step.operation];
    return { ...step, expected: result.toFixed(step.decimals), explanation: `${a.toPrecision(8)} ${symbol} ${b.toPrecision(8)}` };
  });
  const expected = steps?.at(-1)?.expected ?? (divide ? given / factor : given * factor).toFixed(config.answer.decimals);
  return { given, factor, expected, steps, symbol: divide ? "÷" : "×" };
}

export function checkPracticeAnswer(input: string, expected: string) {
  const value = input.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
    !Number.isFinite(Number(value))) return "invalid";
  return Number(value) === Number(expected) ? "correct" : "incorrect";
}
