import { getElement } from "./elements";

export interface FormulaComposition { formula: string; counts: ReadonlyMap<string, number>; molarMass: number }

class FormulaParser {
  private index = 0;
  private readonly input: string;
  constructor(input: string) { this.input = input; }

  parse(): Map<string, number> {
    const counts = this.parseSequence();
    if (this.index !== this.input.length) throw new Error(`Unexpected token at position ${this.index + 1}.`);
    return counts;
  }

  private parseSequence(close?: string): Map<string, number> {
    const counts = new Map<string, number>();
    while (this.index < this.input.length) {
      const token = this.input[this.index];
      if (close && token === close) { this.index += 1; return counts; }
      if (token === "(" || token === "[") {
        this.index += 1;
        const nested = this.parseSequence(token === "(" ? ")" : "]");
        this.merge(counts, nested, this.readNumber());
        continue;
      }
      if (!token || !/[A-Z]/.test(token)) throw new Error(`Expected an element at position ${this.index + 1}.`);
      const symbol = token + (/[a-z]/.test(this.input[this.index + 1] ?? "") ? this.input[++this.index] : "");
      this.index += 1;
      if (!getElement(symbol)) throw new Error(`Unknown element symbol “${symbol}”.`);
      counts.set(symbol, (counts.get(symbol) ?? 0) + this.readNumber());
    }
    if (close) throw new Error(`Missing closing “${close}”.`);
    return counts;
  }

  private readNumber() {
    const start = this.index;
    while (/\d/.test(this.input[this.index] ?? "")) this.index += 1;
    return start === this.index ? 1 : Number(this.input.slice(start, this.index));
  }

  private merge(target: Map<string, number>, source: Map<string, number>, multiplier: number) {
    source.forEach((count, symbol) => target.set(symbol, (target.get(symbol) ?? 0) + count * multiplier));
  }
}

export function parseFormula(formula: string): FormulaComposition {
  const normalized = formula.replace(/\s+/g, "").replace(/·/g, ".");
  if (!normalized) throw new Error("Enter a chemical formula.");
  const total = new Map<string, number>();
  for (const section of normalized.split(".")) {
    if (!section) throw new Error("Hydrate sections cannot be empty.");
    const match = section.match(/^(\d+)(.*)$/);
    const multiplier = match ? Number(match[1]) : 1;
    const body = match ? match[2] : section;
    const parsed = new FormulaParser(body).parse();
    parsed.forEach((count, symbol) => total.set(symbol, (total.get(symbol) ?? 0) + count * multiplier));
  }
  const molarMass = [...total].reduce((sum, [symbol, count]) => sum + (getElement(symbol)?.atomicWeight.value ?? 0) * count, 0);
  return { formula, counts: total, molarMass };
}

