import { localPrograms } from "../courseData/programs";
import { getProgramClusterPathSlug, getProgramPathSlug } from "../utils/routeSlugs";

export function getStaticCatalogProgramParams() {
  return localPrograms.map((program) => ({
    programSlug: getProgramPathSlug(program),
  }));
}

export function getStaticCatalogClusterParams() {
  return localPrograms.flatMap((program) =>
    program.requirementGroups.map((cluster) => ({
      programSlug: getProgramPathSlug(program),
      clusterSlug: getProgramClusterPathSlug(cluster),
    })),
  );
}
