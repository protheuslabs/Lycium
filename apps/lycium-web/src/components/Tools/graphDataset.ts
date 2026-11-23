/** A reusable two-column dataset. Blank cells are kept for editing and never plotted. */
export interface DatasetRow { x: string; y: string }
export interface GraphDataset {
  id: string;
  name: string;
  xLabel: string;
  yLabel: string;
  color: string;
  visible: boolean;
  regression: boolean;
  rows: DatasetRow[];
}

export function numericPoints(rows: readonly DatasetRow[]): Array<[number, number]> {
  return rows.flatMap(({ x, y }) => {
    if (!x.trim() || !y.trim()) return [];
    const point: [number, number] = [Number(x), Number(y)];
    return point.every(Number.isFinite) ? [point] : [];
  });
}

export function linearRegression(points: readonly [number, number][]) {
  if (points.length < 2) return null;
  const meanX = points.reduce((sum, [x]) => sum + x / points.length, 0);
  const meanY = points.reduce((sum, [, y]) => sum + y / points.length, 0);
  let xx = 0, xy = 0, yy = 0;
  for (const [x, y] of points) { const dx = x - meanX, dy = y - meanY; xx += dx * dx; xy += dx * dy; yy += dy * dy; }
  if (!(xx > 0) || ![xx, xy, yy].every(Number.isFinite)) return null;
  const slope = xy / xx, intercept = meanY - slope * meanX;
  const rSquared = yy === 0 ? 1 : Math.min(1, Math.max(0, (xy / Math.sqrt(xx) / Math.sqrt(yy)) ** 2));
  return [slope, intercept, rSquared].every(Number.isFinite) ? { slope, intercept, rSquared } : null;
}

/** Parse standard comma-separated rows, including quoted headers and CRLF. */
export function parseDatasetCsv(text: string): { xLabel: string; yLabel: string; rows: DatasetRow[] } {
  const records: string[][] = []; let record: string[] = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') { quoted = false; closed = true; } else cell += ch; }
    else if (ch === '"' && !cell && !closed) quoted = true;
    else if (ch === "," || ch === "\n" || ch === "\r") {
      record.push(cell.trim()); cell = ""; closed = false;
      if (ch !== ",") { if (ch === "\r" && text[i + 1] === "\n") i++; if (record.some(Boolean)) records.push(record); record = []; }
    } else { if (closed && !/\s/.test(ch)) throw new Error("Invalid characters after a quoted CSV cell."); cell += ch; }
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  record.push(cell.trim()); if (record.some(Boolean)) records.push(record);
  if (!records.length || records.some((row) => row.length !== 2)) throw new Error("CSV must contain exactly two columns.");
  const first = records[0];
  const hasHeader = first.some((value) => !value || !Number.isFinite(Number(value)));
  if (hasHeader && first.some((value) => value.length > 100)) throw new Error("CSV column labels must be at most 100 characters.");
  const rows = (hasHeader ? records.slice(1) : records).map(([x, y]) => ({ x, y }));
  if (!rows.length || rows.length > 1000 || rows.some(({ x, y }) => !x || !y || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y)))) throw new Error("CSV must contain 1–1000 rows of numeric x and y values.");
  return { xLabel: hasHeader ? first[0] : "x", yLabel: hasHeader ? first[1] : "y", rows };
}
