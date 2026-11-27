export type ElementFamily = "nonmetal" | "alkali-metal" | "alkaline-earth" | "transition-metal" | "post-transition-metal" | "metalloid" | "halogen" | "noble-gas" | "lanthanide" | "actinide";
export type AtomicWeight = { kind: "standard" | "reference-isotope" | "interval"; value: number; display: string; minimum?: number; maximum?: number };

export interface ChemicalElement {
  atomicNumber: number;
  symbol: string;
  name: string;
  atomicWeight: AtomicWeight;
  cpkColor: string | null;
  electronConfiguration: string;
  shells: number[];
  electronegativity: number | null;
  atomicRadius: number | null;
  firstIonizationEnergy: number | null;
  electronAffinity: number | null;
  oxidationStates: string[];
  standardState: string | null;
  meltingPoint: number | null;
  boilingPoint: number | null;
  density: number | null;
  family: ElementFamily;
  familyLabel: string;
  yearDiscovered: string | null;
  period: number;
  group: number | null;
  series: "main" | "lanthanide" | "actinide";
  row: number;
  column: number;
}

export type ElementPropertyKey = "atomicWeight" | "electronegativity" | "atomicRadius" | "firstIonizationEnergy" | "electronAffinity" | "density" | "meltingPoint" | "boilingPoint";

