export type WeightedSearchField = {
  values: Array<string | null | undefined>;
  weight: number;
};

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function scoreSearchValue(value: string | null | undefined, query: string, weight: number): number {
  const searchable = value?.toLowerCase() ?? "";

  if (!query || !searchable) return 0;
  if (searchable === query) return weight * 4;
  if (searchable.startsWith(query)) return weight * 3;
  if (searchable.includes(query)) return weight * 2;
  return 0;
}

export function scoreWeightedSearch(fields: WeightedSearchField[], query: string): number {
  if (!query) return 0;

  return fields.reduce(
    (total, field) =>
      total + field.values.reduce((fieldTotal, value) => fieldTotal + scoreSearchValue(value, query, field.weight), 0),
    0,
  );
}
