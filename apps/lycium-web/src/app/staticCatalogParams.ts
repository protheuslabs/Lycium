import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { localPrograms } from "../courseData/programs";

function slugifyRouteSegment(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStaticProgramSlug(program: Pick<LyciumProgram, "id" | "title">): string {
  return `${slugifyRouteSegment(program.title || "program")}-${program.id}`;
}

function getStaticClusterSlug(cluster: Pick<LyciumRequirementGroup, "id" | "displayName">): string {
  return `${slugifyRouteSegment(cluster.displayName || "cluster")}-${cluster.id}`;
}

export function getStaticCatalogProgramParams() {
  return localPrograms.map((program) => ({
    programSlug: getStaticProgramSlug(program),
  }));
}

export function getStaticCatalogClusterParams() {
  return localPrograms.flatMap((program) =>
    program.requirementGroups.map((cluster) => ({
      programSlug: getStaticProgramSlug(program),
      clusterSlug: getStaticClusterSlug(cluster),
    })),
  );
}
