import { parseConversionFamily, type ConversionFamily } from "./conversionRuntime";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 500;
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);

export type AuthoredProblemType = {
  version: 4;
  id: string;
  subject: string;
  topic: string;
  title: string;
  description: string;
  difficulty: number;
  skills: string[];
  variables: Record<string, unknown>;
  derived: Record<string, { expression: unknown; unit: string }>;
  prompt: string;
  answer: { target: string; interaction: "numeric"; significantFigures?: number; decimals?: number };
  hints?: string[];
  workedSolution?: string;
};

export function parseAuthoredProblemType(value: unknown): AuthoredProblemType {
  if (!record(value) || value.version !== 4 || !id(value.id) || !text(value.subject) || !text(value.topic) ||
      !text(value.title) || !text(value.description) || !Number.isInteger(value.difficulty) ||
      (value.difficulty as number) < 1 || (value.difficulty as number) > 5 || !Array.isArray(value.skills) ||
      !value.skills.every(text) || !record(value.variables) || !record(value.derived) || !text(value.prompt) || !record(value.answer)) {
    throw new Error("Invalid authored problem type metadata.");
  }
  if (!id(value.answer.target) || value.answer.interaction !== "numeric") throw new Error("Invalid authored answer target.");
  const decimals = value.answer.decimals;
  const figures = value.answer.significantFigures;
  if ((Number.isInteger(decimals) ? 1 : 0) + (Number.isInteger(figures) ? 1 : 0) !== 1) {
    throw new Error("Define either decimal places or significant figures.");
  }
  return value as AuthoredProblemType;
}

export function compileProblemType(input: unknown): ConversionFamily {
  const definition = parseAuthoredProblemType(input);
  const variables = Object.fromEntries(Object.entries(definition.variables).map(([name, raw]) => {
    if (!id(name) || !record(raw) || !["constant", "integer", "decimal", "categorical"].includes(String(raw.type))) {
      throw new Error(`Invalid authored variable "${name}".`);
    }
    if (raw.type === "constant") return [name, { generator: "constant", value: raw.value }];
    if (raw.type === "categorical") return [name, { generator: "categorical", choices: raw.choices }];
    if (!Array.isArray(raw.range) || raw.range.length !== 2) throw new Error(`Variable "${name}" needs a range.`);
    return [name, { generator: raw.type, min: raw.range[0], max: raw.range[1], ...(raw.type === "decimal" ? { step: raw.step } : {}) }];
  }));
  const derived = Object.fromEntries(Object.entries(definition.derived).map(([name, item]) => {
    if (!id(name) || !record(item) || !text(item.unit)) throw new Error(`Invalid derived value "${name}".`);
    return [name, item.expression];
  }));
  const target = definition.derived[definition.answer.target];
  if (!target) throw new Error("The answer target must name a derived value.");
  return parseConversionFamily({
    version: 3,
    id: definition.id,
    category: `${definition.subject} · ${definition.topic}`,
    title: definition.title,
    description: definition.description,
    variables,
    derived,
    constraints: [],
    presentation: { prompt: definition.prompt, equation: "" },
    interactions: [{
      id: "answer", type: "numeric", prompt: `Calculate ${definition.answer.target.replace(/-/g, " ")}`,
      expected: definition.answer.target, unit: target.unit,
      ...(definition.answer.decimals !== undefined
        ? { decimals: definition.answer.decimals }
        : { significantFigures: definition.answer.significantFigures }),
    }],
  });
}
