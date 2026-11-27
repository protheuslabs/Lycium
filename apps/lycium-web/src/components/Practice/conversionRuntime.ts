import type { Quantity, Ratio } from "./conversionChain";
import { callDomainFunction, hasDomainFunction } from "./domainFunctions";

type Operation = "add" | "subtract" | "multiply" | "divide" | "min" | "max";
type Expression = number | string | { operation: Operation; operands: [Expression, Expression] } |
  { function: string; arguments: Expression[] };
type Scalar = number | string;
type Generator =
  | { generator: "constant"; value: number }
  | { generator: "integer"; min: number; max: number }
  | { generator: "decimal"; min: number; max: number; step: number }
  | { generator: "categorical"; choices: Scalar[] };
type Constraint = { left: Expression; relation: "==" | "!=" | "<" | "<=" | ">" | ">="; right: Expression };
type QuantityDefinition = { id: string; value: string; unit: string; species: string };
type ConversionChainDefinition = {
  id: string; type: "conversion-chain"; prompt: string;
  start: Omit<QuantityDefinition, "id">;
  target: Omit<QuantityDefinition, "id"> & { decimals: number };
  quantities: QuantityDefinition[];
  ratios: [string, string][];
};
type ChoiceDefinition = {
  id: string; type: "choice"; prompt: string;
  options: { id: string; label: string }[];
  expected: { left: Expression; relation: "<" | "<=" | ">" | ">="; right: Expression; whenTrue: string; whenFalse: string };
};
type NumericDefinition = {
  id: string; type: "numeric"; prompt: string; expected: string; unit: string;
  decimals?: number; significantFigures?: number;
};
type PracticeInteractionDefinition = ConversionChainDefinition | ChoiceDefinition | NumericDefinition;
export type ProblemMetadata = {
  subject: string; topic: string; difficulty: number; skills: string[]; hints: string[]; workedSolution?: string;
};
export type ConversionFamily = {
  version: 3; id: string; category: string; title: string; description: string;
  variables: Record<string, Generator>; derived: Record<string, Expression>;
  constraints: Constraint[];
  presentation: { prompt: string; equation: string };
  interactions: PracticeInteractionDefinition[];
  metadata?: ProblemMetadata;
};
export type GeneratedConversionInteraction = {
  id: string; type: "conversion-chain"; prompt: string; start: Quantity; target: Quantity;
  quantities: Quantity[]; ratios: Ratio[]; decimals: number;
};
export type GeneratedChoiceInteraction = {
  id: string; type: "choice"; prompt: string; options: { id: string; label: string }[]; expected: string;
};
export type GeneratedNumericInteraction = {
  id: string; type: "numeric"; prompt: string; expected: number; unit: string;
  precision: { type: "decimal-places" | "significant-figures"; digits: number };
};
export type GeneratedPracticeInteraction = GeneratedConversionInteraction | GeneratedChoiceInteraction | GeneratedNumericInteraction;
export type ConversionProblem = {
  family: ConversionFamily; seed: number; values: Record<string, Scalar>;
  prompt: string; equation: string;
  interactions: GeneratedPracticeInteraction[];
};

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 240;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);

function parseExpression(value: unknown, known: Set<string>): Expression {
  if (finite(value)) return value;
  if (identifier(value) && known.has(value)) return value;
  if (object(value) && typeof value.function === "string" && hasDomainFunction(value.function) &&
      Array.isArray(value.arguments) && value.arguments.length <= 8) {
    return { function: value.function, arguments: value.arguments.map(argument => parseExpression(argument, known)) };
  }
  if (!object(value) || !["add", "subtract", "multiply", "divide", "min", "max"].includes(String(value.operation)) ||
      !Array.isArray(value.operands) || value.operands.length !== 2) throw new Error("Invalid derived expression.");
  return {
    operation: value.operation as Operation,
    operands: [parseExpression(value.operands[0], known), parseExpression(value.operands[1], known)],
  };
}

function parseGenerator(value: unknown): Generator {
  if (!object(value)) throw new Error("Invalid variable generator.");
  if (value.generator === "constant" && finite(value.value)) return { generator: "constant", value: value.value };
  if (value.generator === "categorical" && Array.isArray(value.choices) && value.choices.length >= 2 &&
      value.choices.length <= 100 && value.choices.every(choice => finite(choice) || text(choice))) {
    return { generator: "categorical", choices: value.choices as Scalar[] };
  }
  if ((value.generator === "integer" || value.generator === "decimal") && finite(value.min) && finite(value.max) && value.min <= value.max) {
    if (value.generator === "integer" && Number.isInteger(value.min) && Number.isInteger(value.max)) {
      return { generator: "integer", min: value.min, max: value.max };
    }
    if (value.generator === "decimal" && finite(value.step) && value.step > 0) {
      return { generator: "decimal", min: value.min, max: value.max, step: value.step };
    }
  }
  throw new Error("Invalid variable generator.");
}

function parseQuantity(value: unknown, known: Set<string>, requireId: boolean) {
  if (!object(value) || (requireId && !identifier(value.id)) || !identifier(value.value) || !known.has(value.value) ||
      !text(value.unit) || !text(value.species)) throw new Error("Invalid interaction quantity.");
  return { ...(requireId ? { id: value.id as string } : {}), value: value.value, unit: value.unit, species: value.species };
}

export function parseConversionFamily(value: unknown): ConversionFamily {
  if (!object(value) || value.version !== 3 || !identifier(value.id) || !text(value.category) || !text(value.title) ||
      !text(value.description) || !object(value.variables) || !object(value.derived) || !object(value.presentation) ||
      !text(value.presentation.prompt) || typeof value.presentation.equation !== "string" || !Array.isArray(value.interactions) ||
      value.interactions.length < 1 || value.interactions.length > 20) throw new Error("Invalid version 3 conversion family.");
  const variables = Object.fromEntries(Object.entries(value.variables).map(([id, generator]) => {
    if (!identifier(id)) throw new Error("Invalid variable identifier.");
    return [id, parseGenerator(generator)];
  }));
  const known = new Set(Object.keys(variables));
  const derived: Record<string, Expression> = {};
  for (const [id, expression] of Object.entries(value.derived)) {
    if (!identifier(id) || known.has(id)) throw new Error("Invalid derived identifier.");
    derived[id] = parseExpression(expression, known);
    known.add(id);
  }
  const interactions = value.interactions.map(raw => {
    if (!object(raw) || !identifier(raw.id) || !text(raw.prompt)) throw new Error("Invalid practice interaction.");
    if (raw.type === "choice") {
      if (!Array.isArray(raw.options) || raw.options.length < 2 || !raw.options.every(option => object(option) && identifier(option.id) && text(option.label)) ||
          !object(raw.expected) || !["<", "<=", ">", ">="].includes(String(raw.expected.relation)) ||
          !identifier(raw.expected.whenTrue) || !identifier(raw.expected.whenFalse)) throw new Error("Invalid choice interaction.");
      const optionIds = new Set(raw.options.map(option => (option as { id: string }).id));
      if (!optionIds.has(raw.expected.whenTrue as string) || !optionIds.has(raw.expected.whenFalse as string)) throw new Error("Choice answer is not an option.");
      return {
        id: raw.id, type: "choice" as const, prompt: raw.prompt,
        options: raw.options as { id: string; label: string }[],
        expected: {
          left: parseExpression(raw.expected.left, known), relation: raw.expected.relation as ChoiceDefinition["expected"]["relation"],
          right: parseExpression(raw.expected.right, known), whenTrue: raw.expected.whenTrue as string, whenFalse: raw.expected.whenFalse as string,
        },
      };
    }
    if (raw.type === "numeric") {
      const decimals = raw.decimals;
      const significantFigures = raw.significantFigures;
      const validDecimals = Number.isInteger(decimals) && (decimals as number) >= 0 && (decimals as number) <= 8;
      const validFigures = Number.isInteger(significantFigures) && (significantFigures as number) >= 1 && (significantFigures as number) <= 10;
      if (!identifier(raw.expected) || !known.has(raw.expected) || !text(raw.unit) || validDecimals === validFigures) {
        throw new Error("Numeric interactions need exactly one valid precision policy.");
      }
      return {
        id: raw.id, type: "numeric" as const, prompt: raw.prompt, expected: raw.expected, unit: raw.unit,
        ...(validDecimals ? { decimals: decimals as number } : { significantFigures: significantFigures as number }),
      };
    }
    if (raw.type !== "conversion-chain" || !Array.isArray(raw.quantities) || !Array.isArray(raw.ratios) || !object(raw.target)) {
      throw new Error("Invalid conversion interaction.");
    }
    const quantities = raw.quantities.map(item => parseQuantity(item, known, true) as QuantityDefinition);
    const quantityIds = new Set(quantities.map(item => item.id));
    const ratios = raw.ratios.map(ratio => {
      if (!Array.isArray(ratio) || ratio.length !== 2 || !ratio.every(item => identifier(item) && quantityIds.has(item))) {
        throw new Error("Ratio references an unknown quantity.");
      }
      return ratio as [string, string];
    });
    const target = parseQuantity(raw.target, known, false);
    const decimals = raw.target.decimals;
    if (!Number.isInteger(decimals) || (decimals as number) < 0 || (decimals as number) > 8) {
      throw new Error("Invalid target precision.");
    }
    return {
      id: raw.id, type: "conversion-chain" as const, prompt: raw.prompt,
      start: parseQuantity(raw.start, known, false),
      target: { ...target, decimals: decimals as number },
      quantities, ratios,
    };
  });
  const constraints = value.constraints === undefined ? [] : (() => {
    if (!Array.isArray(value.constraints) || value.constraints.length > 30) throw new Error("Invalid generation constraints.");
    return value.constraints.map(raw => {
      if (!object(raw) || !["==", "!=", "<", "<=", ">", ">="].includes(String(raw.relation))) {
        throw new Error("Invalid generation constraint.");
      }
      return {
        left: parseExpression(raw.left, known),
        relation: raw.relation as Constraint["relation"],
        right: parseExpression(raw.right, known),
      };
    });
  })();
  const metadata = value.metadata === undefined ? undefined : (() => {
    if (!object(value.metadata) || !text(value.metadata.subject) || !text(value.metadata.topic) ||
        !Number.isInteger(value.metadata.difficulty) || (value.metadata.difficulty as number) < 1 ||
        (value.metadata.difficulty as number) > 5 || !Array.isArray(value.metadata.skills) ||
        !value.metadata.skills.every(text) || !Array.isArray(value.metadata.hints) || !value.metadata.hints.every(text) ||
        (value.metadata.workedSolution !== undefined && !text(value.metadata.workedSolution))) {
      throw new Error("Invalid problem metadata.");
    }
    return value.metadata as ProblemMetadata;
  })();
  return {
    version: 3, id: value.id, category: value.category, title: value.title, description: value.description,
    variables, derived, constraints, presentation: { prompt: value.presentation.prompt, equation: value.presentation.equation }, interactions, metadata,
  };
}

function evaluate(expression: Expression, values: Record<string, Scalar>): Scalar {
  if (typeof expression === "number") return expression;
  if (typeof expression === "string") return values[expression];
  if ("function" in expression) return callDomainFunction(expression.function, expression.arguments.map(argument => evaluate(argument, values)));
  const operands = expression.operands.map(operand => evaluate(operand, values));
  if (operands.some(value => typeof value !== "number")) throw new Error("Arithmetic expressions require numerical values.");
  const [left, right] = operands as [number, number];
  switch (expression.operation) {
    case "add": return left + right;
    case "subtract": return left - right;
    case "multiply": return left * right;
    case "divide": return left / right;
    case "min": return Math.min(left, right);
    case "max": return Math.max(left, right);
  }
}

function satisfies(constraint: Constraint, values: Record<string, Scalar>) {
  const left = evaluate(constraint.left, values);
  const right = evaluate(constraint.right, values);
  const comparable = typeof left === typeof right;
  const order = !comparable ? NaN : typeof left === "number" && typeof right === "number"
    ? left - right : String(left).localeCompare(String(right));
  switch (constraint.relation) {
    case "==": return left === right;
    case "!=": return left !== right;
    case "<": return order < 0;
    case "<=": return order <= 0;
    case ">": return order > 0;
    case ">=": return order >= 0;
  }
}

export function generateConversionProblem(family: ConversionFamily, seed: number): ConversionProblem {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Invalid generation seed.");
  let state = seed;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  };
  let values: Record<string, Scalar> | undefined;
  for (let attempt = 0; attempt < 100 && !values; attempt++) {
    const candidate: Record<string, Scalar> = {};
    for (const [id, generator] of Object.entries(family.variables)) {
      if (generator.generator === "constant") candidate[id] = generator.value;
      else if (generator.generator === "integer") candidate[id] = generator.min + Math.floor(random() * (generator.max - generator.min + 1));
      else if (generator.generator === "categorical") candidate[id] = generator.choices[Math.floor(random() * generator.choices.length)];
      else {
        const count = Math.floor((generator.max - generator.min) / generator.step);
        candidate[id] = Number((generator.min + Math.floor(random() * (count + 1)) * generator.step).toPrecision(12));
      }
    }
    for (const [id, expression] of Object.entries(family.derived)) {
      candidate[id] = evaluate(expression, candidate);
      if (typeof candidate[id] !== "number" || !Number.isFinite(candidate[id])) throw new Error(`Derived value "${id}" is not finite.`);
    }
    if (family.constraints.every(constraint => satisfies(constraint, candidate))) values = candidate;
  }
  if (!values) throw new Error("Could not satisfy generation constraints after 100 attempts.");
  const render = (template: string) => template.replace(/\{([A-Za-z][A-Za-z0-9_-]*)\}/g, (_, id: string) => String(values[id]));
  const interactions: GeneratedPracticeInteraction[] = family.interactions.map(interaction => {
    if (interaction.type === "choice") {
      const left = evaluate(interaction.expected.left, values);
      const right = evaluate(interaction.expected.right, values);
      if (typeof left !== "number" || typeof right !== "number") throw new Error("Choice comparison must be numerical.");
      const matches = interaction.expected.relation === "<" ? left < right : interaction.expected.relation === "<=" ? left <= right :
        interaction.expected.relation === ">" ? left > right : left >= right;
      return { id: interaction.id, type: interaction.type, prompt: interaction.prompt, options: interaction.options,
        expected: matches ? interaction.expected.whenTrue : interaction.expected.whenFalse };
    }
    if (interaction.type === "numeric") {
      const expected = values[interaction.expected];
      if (typeof expected !== "number") throw new Error("Numeric answer must resolve to a number.");
      return {
        id: interaction.id, type: interaction.type, prompt: interaction.prompt, expected, unit: interaction.unit,
        precision: interaction.decimals !== undefined
          ? { type: "decimal-places", digits: interaction.decimals }
          : { type: "significant-figures", digits: interaction.significantFigures! },
      };
    }
    const quantity = (item: Omit<QuantityDefinition, "id"> & { id?: string }): Quantity => ({
      id: item.id ?? interaction.id, value: (() => {
        const resolved = values[item.value];
        if (typeof resolved !== "number") throw new Error(`Quantity "${item.value}" must resolve to a number.`);
        return resolved;
      })(), unit: item.unit, species: item.species,
    });
    const quantities = interaction.quantities.map(quantity);
    const byId = new Map(quantities.map(item => [item.id, item]));
    return {
      id: interaction.id, type: interaction.type, prompt: interaction.prompt,
      start: quantity(interaction.start), target: quantity(interaction.target), quantities,
      ratios: interaction.ratios.map(([numerator, denominator]) => ({
        numerator: byId.get(numerator)!, denominator: byId.get(denominator)!,
      })),
      decimals: interaction.target.decimals,
    };
  });
  return { family, seed, values, prompt: render(family.presentation.prompt), equation: family.presentation.equation, interactions };
}
