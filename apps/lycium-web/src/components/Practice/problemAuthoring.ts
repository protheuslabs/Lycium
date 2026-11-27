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
  derived: Record<string, unknown>;
  prompt?: string;
  equation?: string;
  presentation?: { prompt: string; equation: string };
  constraints?: unknown[];
  parts?: unknown[];
  interactions?: unknown[];
  answer?: { target: string; interaction: "numeric"; significantFigures?: number; decimals?: number };
  hints?: string[];
  workedSolution?: string;
};

export function parseAuthoredProblemType(value: unknown): AuthoredProblemType {
  if (!record(value) || value.version !== 4 || !id(value.id) || !text(value.subject) || !text(value.topic) ||
      !text(value.title) || !text(value.description) || !Number.isInteger(value.difficulty) ||
      (value.difficulty as number) < 1 || (value.difficulty as number) > 5 || !Array.isArray(value.skills) ||
      !value.skills.every(text) || !record(value.variables) || !record(value.derived) ||
      (!text(value.prompt) && !(record(value.presentation) && text(value.presentation.prompt) && typeof value.presentation.equation === "string")) ||
      (!record(value.answer) && !Array.isArray(value.parts) && !Array.isArray(value.interactions))) {
    throw new Error("Invalid authored problem type metadata.");
  }
  if (value.answer) {
    const answer = value.answer as RecordValue;
    if (!id(answer.target) || answer.interaction !== "numeric") throw new Error("Invalid authored answer target.");
    const decimals = answer.decimals;
    const figures = answer.significantFigures;
    if ((Number.isInteger(decimals) ? 1 : 0) + (Number.isInteger(figures) ? 1 : 0) !== 1) {
      throw new Error("Define either decimal places or significant figures.");
    }
  }
  return value as AuthoredProblemType;
}

export function compileProblemType(input: unknown): ConversionFamily {
  const definition = parseAuthoredProblemType(input);
  const variables = Object.fromEntries(Object.entries(definition.variables).map(([name, raw]) => {
    if (!id(name) || !record(raw)) {
      throw new Error(`Invalid authored variable "${name}".`);
    }
    if (typeof raw.generator === "string") return [name, raw];
    if (!["constant", "integer", "decimal", "categorical"].includes(String(raw.type))) throw new Error(`Invalid authored variable "${name}".`);
    if (raw.type === "constant") return [name, { generator: "constant", value: raw.value }];
    if (raw.type === "categorical") return [name, { generator: "categorical", choices: raw.choices }];
    if (!Array.isArray(raw.range) || raw.range.length !== 2) throw new Error(`Variable "${name}" needs a range.`);
    return [name, { generator: raw.type, min: raw.range[0], max: raw.range[1], ...(raw.type === "decimal" ? { step: raw.step } : {}) }];
  }));
  const derivedUnits: Record<string, string> = {};
  const derived = Object.fromEntries(Object.entries(definition.derived).map(([name, item]) => {
    if (!id(name)) throw new Error(`Invalid derived value "${name}".`);
    if (record(item) && "expression" in item) {
      if (item.unit !== undefined && !text(item.unit)) throw new Error(`Invalid derived unit "${name}".`);
      if (typeof item.unit === "string") derivedUnits[name] = item.unit;
      return [name, item.expression];
    }
    return [name, item];
  }));
  const interactions = definition.parts ?? definition.interactions ?? (() => {
    if (!definition.answer) throw new Error("Define an answer or multipart parts.");
    const unit = derivedUnits[definition.answer.target];
    if (!unit) throw new Error("A simple answer target needs a derived unit.");
    return [{
      id: "answer", type: "numeric", prompt: `Calculate ${definition.answer.target.replace(/-/g, " ")}`,
      expected: definition.answer.target, unit,
      ...(definition.answer.decimals !== undefined
        ? { decimals: definition.answer.decimals }
        : { significantFigures: definition.answer.significantFigures }),
    }];
  })();
  return parseConversionFamily({
    version: 3,
    id: definition.id,
    category: `${definition.subject} · ${definition.topic}`,
    title: definition.title,
    description: definition.description,
    variables,
    derived,
    constraints: definition.constraints ?? [],
    presentation: {
      prompt: definition.prompt ?? definition.presentation!.prompt,
      equation: definition.equation ?? definition.presentation?.equation ?? "",
    },
    interactions,
    metadata: {
      subject: definition.subject, topic: definition.topic, difficulty: definition.difficulty, skills: definition.skills,
      hints: definition.hints ?? [], workedSolution: definition.workedSolution,
    },
  });
}
