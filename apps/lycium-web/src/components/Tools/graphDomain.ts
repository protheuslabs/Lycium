/** A finite, explicitly bounded interval on the x-axis. */
export type GraphDomain = { min: number; max: number; includeMin: boolean; includeMax: boolean };

/** Read a trailing restriction such as {0<=x<3}. */
export function parseGraphDomain(expression: string): { expression: string; domain: GraphDomain | null } {
  const start = expression.indexOf("{");
  if (start === -1 && !expression.includes("}")) return { expression, domain: null };
  const match = expression.match(/^([^{}]+)\{\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(<=|<|≤)\s*x\s*(<=|<|≤)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\}\s*$/i);
  if (!match) throw new Error("Use a restriction such as {0<=x<3} with finite numeric bounds.");
  const min = Number(match[2]);
  const max = Number(match[5]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) throw new Error("Domain bounds must be finite and increasing.");
  return { expression: match[1].trim(), domain: { min, max, includeMin: match[3] !== "<", includeMax: match[4] !== "<" } };
}

export function domainContains(domain: GraphDomain | null, x: number): boolean {
  return !domain || (domain.includeMin ? x >= domain.min : x > domain.min) && (domain.includeMax ? x <= domain.max : x < domain.max);
}
