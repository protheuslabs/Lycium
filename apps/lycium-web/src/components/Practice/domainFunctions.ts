export type DomainScalar = number | string;

const atomicMasses: Record<string, number> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Na: 22.990, Mg: 24.305,
  Al: 26.982, P: 30.974, S: 32.06, Cl: 35.45, K: 39.098, Ca: 40.078, Fe: 55.845,
};

function number(value: DomainScalar, name: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} requires finite numerical arguments.`);
  return value;
}

function molarMass(formula: DomainScalar) {
  if (typeof formula !== "string" || !formula) throw new Error("chemistry.molarMass requires a chemical formula.");
  const tokens = [...formula.matchAll(/([A-Z][a-z]?)(\d*)/g)];
  if (!tokens.length || tokens.map(token => token[0]).join("") !== formula) throw new Error(`Unsupported chemical formula "${formula}".`);
  return tokens.reduce((total, [, symbol, count]) => {
    const mass = atomicMasses[symbol];
    if (!mass) throw new Error(`Unknown element "${symbol}".`);
    return total + mass * (count ? Number(count) : 1);
  }, 0);
}

const registry: Record<string, (args: DomainScalar[]) => DomainScalar> = {
  "chemistry.molarMass": args => molarMass(args[0]),
  "math.pow": args => Math.pow(number(args[0], "math.pow"), number(args[1], "math.pow")),
  "math.sqrt": args => Math.sqrt(number(args[0], "math.sqrt")),
  "math.abs": args => Math.abs(number(args[0], "math.abs")),
  "math.log": args => Math.log(number(args[0], "math.log")),
  "math.exp": args => Math.exp(number(args[0], "math.exp")),
};

export const hasDomainFunction = (name: string) => Object.hasOwn(registry, name);
export function callDomainFunction(name: string, args: DomainScalar[]) {
  const implementation = registry[name];
  if (!implementation) throw new Error(`Unknown domain function "${name}".`);
  const result = implementation(args);
  if (typeof result === "number" && !Number.isFinite(result)) throw new Error(`Domain function "${name}" returned a non-finite result.`);
  return result;
}
