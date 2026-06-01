import { getCatalogClusterRouteEntries, getCatalogProgramRouteEntries } from "./catalogRouteRegistry";

export function getStaticCatalogProgramParams() {
  return getCatalogProgramRouteEntries().map(({ programSlug }) => ({ programSlug }));
}

export function getStaticCatalogClusterParams() {
  return getCatalogClusterRouteEntries().map(({ programSlug, clusterSlug }) => ({ programSlug, clusterSlug }));
}
