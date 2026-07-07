export type CatalogSelectionMode =
  | {
      kind: "program";
      programId: string;
      selectedClusterKeys: string[];
    }
  | {
      kind: "cluster";
      programId: string;
      clusterId: string;
      selectedCourseKeys: string[];
    }
  | null;

export function getCatalogClusterSelectionKey(programId: string, clusterId: string): string {
  return `${programId}::${clusterId}`;
}
