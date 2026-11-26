import catalog from "./basicChemistry.json";

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

export function parsePracticeConfig(value: unknown) {
  if (!record(value) || value.version !== 1 || !label(value.id) ||
    !label(value.category) || !label(value.title) || !label(value.hint) ||
    (value.operation !== "multiply" && value.operation !== "divide") ||
    !record(value.answer) || !label(value.answer.label) || !label(value.answer.unit) ||
    !integer(value.answer.decimals, 0, 6)) {
    throw new Error("Expected a version 1 skill with an ID, category, title, hint, operation and answer specification.");
  }
  const given = range(value.given);
  const factor = range(value.factor);
  if (!given || !factor) throw new Error("Both inputs need labels, units and ordered integer bounds between 1 and 10,000.");
  return {
    version: 1 as const, id: value.id, category: value.category, title: value.title,
    hint: value.hint, operation: value.operation, given, factor,
    answer: { label: value.answer.label, unit: value.answer.unit, decimals: value.answer.decimals },
    symbols: record(value.symbols) && label(value.symbols.first) && label(value.symbols.second) && label(value.symbols.result)
      ? { first: value.symbols.first, second: value.symbols.second, result: value.symbols.result }
      : { first: "a", second: "b", result: "r" },
  };
}

export type PracticeConfig = ReturnType<typeof parsePracticeConfig>;
export const practiceCatalog = catalog.map(parsePracticeConfig);

export function generateProblem(config: PracticeConfig, seed: number) {
  if (!integer(seed, 0, 0xffffffff)) throw new Error("Seed must be an integer from 0 to 4,294,967,295.");
  let state = seed;
  function sample(input: PracticeConfig["given"]) {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    const fraction = ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
    return input.min + Math.floor(fraction * (input.max - input.min + 1));
  }
  const given = sample(config.given);
  const factor = sample(config.factor);
  const divide = config.operation === "divide";
  const expected = (divide ? given / factor : given * factor).toFixed(config.answer.decimals);
  return { given, factor, expected, symbol: divide ? "÷" : "×" };
}

export function checkPracticeAnswer(input: string, expected: string) {
  const value = input.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
    !Number.isFinite(Number(value))) return "invalid";
  return Number(value) === Number(expected) ? "correct" : "incorrect";
}
