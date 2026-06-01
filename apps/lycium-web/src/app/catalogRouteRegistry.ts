import { localPrograms } from "../courseData/programs";
import { getProgramClusterPathSlug, getProgramPathSlug } from "../utils/routeSlugs";

export function getCatalogProgramRouteEntries() {
  return localPrograms.map((program) => ({
    program,
    programSlug: getProgramPathSlug(program),
  }));
}

export function getCatalogClusterRouteEntries() {
  return getCatalogProgramRouteEntries().flatMap(({ program, programSlug }) =>
    program.requirementGroups.map((cluster) => ({
      cluster,
      clusterSlug: getProgramClusterPathSlug(cluster),
      program,
      programSlug,
    })),
  );
}
