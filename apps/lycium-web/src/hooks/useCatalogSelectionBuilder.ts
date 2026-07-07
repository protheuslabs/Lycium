"use client";

import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { LyciumProgram } from "@lycium/contracts";
import type { CourseEntry } from "../courseTypes";
import { getCatalogClusterSelectionKey, type CatalogSelectionMode } from "../utils/catalogSelection";
import { mergeProgramsById, persistLocalProgramDraft } from "../utils/localProgramDrafts";
import {
  appendCoursesToRequirementGroup,
  cloneRequirementGroupIntoProgram,
} from "../utils/programDraftBuilders";

type UseCatalogSelectionBuilderArgs = {
  courses: CourseEntry[];
  programs: LyciumProgram[];
  setPrograms: Dispatch<SetStateAction<LyciumProgram[]>>;
};

export function useCatalogSelectionBuilder({
  courses,
  programs,
  setPrograms,
}: UseCatalogSelectionBuilderArgs) {
  const [catalogSelectionMode, setCatalogSelectionMode] = useState<CatalogSelectionMode>(null);

  const startProgramSelection = useCallback((programId: string) => {
    setCatalogSelectionMode({ kind: "program", programId, selectedClusterKeys: [] });
  }, []);

  const startClusterSelection = useCallback((programId: string, clusterId: string) => {
    setCatalogSelectionMode({ kind: "cluster", programId, clusterId, selectedCourseKeys: [] });
  }, []);

  const toggleClusterSelection = useCallback((programId: string, clusterId: string) => {
    const key = getCatalogClusterSelectionKey(programId, clusterId);
    setCatalogSelectionMode((current) => {
      if (!current || current.kind !== "program") {
        return current;
      }

      return {
        ...current,
        selectedClusterKeys: current.selectedClusterKeys.includes(key)
          ? current.selectedClusterKeys.filter((value) => value !== key)
          : [...current.selectedClusterKeys, key],
      };
    });
  }, []);

  const toggleCourseSelection = useCallback((courseKey: string) => {
    setCatalogSelectionMode((current) => {
      if (!current || current.kind !== "cluster") {
        return current;
      }

      return {
        ...current,
        selectedCourseKeys: current.selectedCourseKeys.includes(courseKey)
          ? current.selectedCourseKeys.filter((value) => value !== courseKey)
          : [...current.selectedCourseKeys, courseKey],
      };
    });
  }, []);

  const cancelCatalogSelection = useCallback(() => {
    setCatalogSelectionMode(null);
  }, []);

  const commitCatalogSelection = useCallback(() => {
    if (!catalogSelectionMode) {
      return;
    }

    if (catalogSelectionMode.kind === "program") {
      const selectedClusters = catalogSelectionMode.selectedClusterKeys.flatMap((selectionKey) => {
        const [programId, clusterId] = selectionKey.split("::");
        const program = programs.find((candidate) => candidate.id === programId);
        const cluster = program?.requirementGroups.find((candidate) => candidate.id === clusterId);
        return program && cluster ? [{ program, cluster }] : [];
      });
      if (selectedClusters.length === 0) {
        return;
      }

      const selectedProgram = programs.find((program) => program.id === catalogSelectionMode.programId);
      if (!selectedProgram || selectedProgram.reviewStatus !== "draft") {
        return;
      }
      const appendedGroups = selectedClusters.map(({ program, cluster }) =>
        cloneRequirementGroupIntoProgram(selectedProgram, program, cluster),
      );
      const nextProgram: LyciumProgram = {
        ...selectedProgram,
        requirementGroups: [...selectedProgram.requirementGroups, ...appendedGroups],
        reviewStatus: "draft",
      };
      persistLocalProgramDraft(nextProgram);
      setPrograms((current) => mergeProgramsById([nextProgram], current));
      setCatalogSelectionMode(null);
      return;
    }

    const selectedProgram = programs.find((program) => program.id === catalogSelectionMode.programId);
    if (!selectedProgram || selectedProgram.reviewStatus !== "draft") {
      return;
    }
    const selectedCluster = selectedProgram.requirementGroups.find(
      (cluster) => cluster.id === catalogSelectionMode.clusterId,
    );
    if (!selectedCluster) {
      return;
    }

    const selectedCourses = catalogSelectionMode.selectedCourseKeys.flatMap((courseKey) => {
      const course = courses.find((candidate) => candidate.key === courseKey);
      return course ? [course] : [];
    });
    if (selectedCourses.length === 0) {
      return;
    }

    const nextCluster = appendCoursesToRequirementGroup(selectedCluster, selectedCourses);
    const nextProgram: LyciumProgram = {
      ...selectedProgram,
      requirementGroups: selectedProgram.requirementGroups.map((cluster) =>
        cluster.id === nextCluster.id ? nextCluster : cluster,
      ),
      reviewStatus: "draft",
    };
    persistLocalProgramDraft(nextProgram);
    setPrograms((current) => mergeProgramsById([nextProgram], current));
    setCatalogSelectionMode(null);
  }, [catalogSelectionMode, courses, programs, setPrograms]);

  return {
    cancelCatalogSelection,
    catalogSelectionMode,
    commitCatalogSelection,
    setCatalogSelectionMode,
    startClusterSelection,
    startProgramSelection,
    toggleClusterSelection,
    toggleCourseSelection,
  };
}
