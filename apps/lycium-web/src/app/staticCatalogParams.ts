import { getCatalogClusterRouteEntries, getCatalogProgramRouteEntries } from "./catalogRouteRegistry";

const EMPTY_PROGRAM_SLUG = "__lycium-empty-program__";
const EMPTY_CLUSTER_SLUG = "__lycium-empty-cluster__";

function shouldEmitEmptyExportParam() {
  return process.env.NEXT_OUTPUT === "export";
}

export function getStaticCatalogProgramParams() {
  const params = getCatalogProgramRouteEntries().map(({ programSlug }) => ({ programSlug }));
  return params.length || !shouldEmitEmptyExportParam() ? params : [{ programSlug: EMPTY_PROGRAM_SLUG }];
}

export function getStaticCatalogClusterParams() {
  const params = getCatalogClusterRouteEntries().map(({ programSlug, clusterSlug }) => ({ programSlug, clusterSlug }));
  return params.length || !shouldEmitEmptyExportParam() ? params : [{ programSlug: EMPTY_PROGRAM_SLUG, clusterSlug: EMPTY_CLUSTER_SLUG }];
}
