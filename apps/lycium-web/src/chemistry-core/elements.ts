import elementData from "./data/elements.json";
import type { ChemicalElement, ElementFamily, ElementPropertyKey } from "./types";

export const ELEMENT_DATA_VERSION = 1;
export const ELEMENT_SOURCES = [
  { name: "PubChem Periodic Table", url: "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON", scope: "Element identities, electron configurations, and physical properties" },
  { name: "CIAAW Standard Atomic Weights 2024", url: "https://www.ciaaw.org/atomic-weights.htm", scope: "Standard-weight intervals and radioactive-element semantics" },
] as const;

export const elements = elementData.elements as ChemicalElement[];
const bySymbol = new Map(elements.map(element => [element.symbol.toLowerCase(), element]));
const byName = new Map(elements.map(element => [element.name.toLowerCase(), element]));
const byNumber = new Map(elements.map(element => [element.atomicNumber, element]));

export function getElement(query: string | number) {
  if (typeof query === "number") return byNumber.get(query) ?? null;
  const normalized = query.trim().toLowerCase();
  const numeric = Number(normalized);
  return bySymbol.get(normalized) ?? byName.get(normalized) ?? (Number.isInteger(numeric) ? byNumber.get(numeric) : null) ?? null;
}

export function searchElements(query: string, allowedSymbols?: readonly string[]) {
  const normalized = query.trim().toLowerCase();
  const allowed = allowedSymbols ? new Set(allowedSymbols) : null;
  return elements.filter(element => (!allowed || allowed.has(element.symbol)) && (!normalized || element.name.toLowerCase().includes(normalized) || element.symbol.toLowerCase().includes(normalized) || String(element.atomicNumber) === normalized));
}

export function filterElements(options: { families?: readonly ElementFamily[]; periods?: readonly number[]; groups?: readonly number[] } = {}) {
  return elements.filter(element => (!options.families || options.families.includes(element.family)) && (!options.periods || options.periods.includes(element.period)) && (!options.groups || (element.group !== null && options.groups.includes(element.group))));
}

export function elementProperty(element: ChemicalElement, property: ElementPropertyKey): number | null {
  return property === "atomicWeight" ? element.atomicWeight.value : element[property];
}

