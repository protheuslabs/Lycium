import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node generate-periodic-data.mjs <pubchem.json> <output.json>");

const rows = JSON.parse(readFileSync(input, "utf8")).Table.Row;
const mainRows = [
  ["H", ...Array(16).fill(null), "He"],
  ["Li", "Be", ...Array(10).fill(null), "B", "C", "N", "O", "F", "Ne"],
  ["Na", "Mg", ...Array(10).fill(null), "Al", "Si", "P", "S", "Cl", "Ar"],
  ["K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr"],
  ["Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe"],
  ["Cs", "Ba", "La", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg", "Tl", "Pb", "Bi", "Po", "At", "Rn"],
  ["Fr", "Ra", "Ac", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og"],
];
const lanthanides = ["Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu"];
const actinides = ["Th", "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr"];
const intervalWeights = {
  H: [1.00784, 1.00811], Li: [6.938, 6.997], B: [10.806, 10.821], C: [12.0096, 12.0116],
  N: [14.00643, 14.00728], O: [15.99903, 15.99977], Mg: [24.304, 24.307], Si: [28.084, 28.086],
  S: [32.059, 32.076], Cl: [35.446, 35.457], Ar: [39.792, 39.963], Br: [79.901, 79.907],
  Tl: [204.382, 204.385], Pb: [206.14, 207.94],
};
const noStandardWeight = new Set(["Tc", "Pm", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og"]);
const nobleCores = { He: "1s2", Ne: "1s2 2s2 2p6", Ar: "1s2 2s2 2p6 3s2 3p6", Kr: "1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6", Xe: "1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6", Rn: "1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6" };
const number = value => value === "" ? null : Number(value);
const position = symbol => {
  for (let period = 0; period < mainRows.length; period += 1) {
    const group = mainRows[period].indexOf(symbol);
    if (group >= 0) return { period: period + 1, group: group + 1, series: "main", row: period + 1, column: group + 1 };
  }
  const lanthanide = lanthanides.indexOf(symbol);
  if (lanthanide >= 0) return { period: 6, group: null, series: "lanthanide", row: 9, column: lanthanide + 3 };
  const actinide = actinides.indexOf(symbol);
  if (actinide >= 0) return { period: 7, group: null, series: "actinide", row: 10, column: actinide + 3 };
  throw new Error(`No position for ${symbol}`);
};
const shells = configuration => {
  const expanded = configuration.replace(/\[([^\]]+)\]/, (_, core) => `${nobleCores[core] ?? ""} `).replace(/\([^)]*\)/g, "");
  const result = [];
  for (const match of expanded.matchAll(/(\d)[spdf](\d+)/g)) result[Number(match[1]) - 1] = (result[Number(match[1]) - 1] ?? 0) + Number(match[2]);
  return result.map(value => value ?? 0);
};
const family = value => {
  const normalized = value.toLowerCase();
  if (normalized.includes("alkali metal")) return "alkali-metal";
  if (normalized.includes("alkaline earth")) return "alkaline-earth";
  if (normalized.includes("post-transition")) return "post-transition-metal";
  if (normalized.includes("transition metal")) return "transition-metal";
  if (normalized.includes("metalloid")) return "metalloid";
  if (normalized.includes("halogen")) return "halogen";
  if (normalized.includes("noble gas")) return "noble-gas";
  if (normalized.includes("lanthanide")) return "lanthanide";
  if (normalized.includes("actinide")) return "actinide";
  return "nonmetal";
};

const elements = rows.map(({ Cell: c }) => {
  const symbol = c[1];
  const reference = /^\[/.test(c[3]) || noStandardWeight.has(symbol);
  const interval = intervalWeights[symbol];
  const weight = interval
    ? { kind: "interval", value: (interval[0] + interval[1]) / 2, minimum: interval[0], maximum: interval[1], display: `[${interval[0]}, ${interval[1]}]` }
    : { kind: reference ? "reference-isotope" : "standard", value: Number(c[3].replace(/[\[\]]/g, "")), display: c[3] };
  return {
    atomicNumber: Number(c[0]), symbol, name: c[2], atomicWeight: weight, cpkColor: c[4] ? `#${c[4]}` : null,
    electronConfiguration: c[5], shells: shells(c[5]), electronegativity: number(c[6]), atomicRadius: number(c[7]),
    firstIonizationEnergy: number(c[8]), electronAffinity: number(c[9]), oxidationStates: c[10] ? c[10].split(",").map(value => value.trim()) : [],
    standardState: c[11] || null, meltingPoint: number(c[12]), boilingPoint: number(c[13]), density: number(c[14]),
    family: family(c[15]), familyLabel: c[15], yearDiscovered: c[16] || null, ...position(symbol),
  };
});

if (elements.length !== 118 || new Set(elements.map(item => item.atomicNumber)).size !== 118) throw new Error("Expected 118 unique elements.");
writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, generatedFrom: "PubChem PUG REST periodic table", elements }, null, 2)}\n`);
