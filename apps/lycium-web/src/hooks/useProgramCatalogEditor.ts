"use client";

import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { getCatalogClusterPath, getCatalogProgramPath } from "../utils/courseRouting";
import {
  deletePersistedLocalProgramDraft,
  mergeProgramsById,
  persistLocalProgramDraft,
} from "../utils/localProgramDrafts";
import {
  buildEmptyLocalProgramDraft,
  buildEmptyRequirementGroupDraft,
} from "../utils/programDraftBuilders";

type ProgramEditorKind = "program" | "cluster";
type ProgramEditorMode = "create" | "edit";

type ProgramEditorState = {
  isOpen: boolean;
  kind: ProgramEditorKind;
  mode: ProgramEditorMode;
  title: string;
  description: string;
  programId: string | null;
  clusterId: string | null;
};

type UseProgramCatalogEditorArgs = {
  programs: LyciumProgram[];
  setPrograms: Dispatch<SetStateAction<LyciumProgram[]>>;
  onCatalogNavigate: (path: string) => void;
};

const CLOSED_EDITOR: ProgramEditorState = {
  isOpen: false,
  kind: "program",
  mode: "create",
  title: "",
  description: "",
  programId: null,
  clusterId: null,
};

export function useProgramCatalogEditor({
  programs,
  setPrograms,
  onCatalogNavigate,
}: UseProgramCatalogEditorArgs) {
  const [editor, setEditor] = useState<ProgramEditorState>(CLOSED_EDITOR);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const selectedProgram = useMemo(
    () => (editor.programId ? programs.find((program) => program.id === editor.programId) ?? null : null),
    [editor.programId, programs],
  );
  const selectedCluster = useMemo(
    () =>
      editor.clusterId && selectedProgram
        ? selectedProgram.requirementGroups.find((cluster) => cluster.id === editor.clusterId) ?? null
        : null,
    [editor.clusterId, selectedProgram],
  );

  const closeEditor = useCallback(() => {
    setEditor(CLOSED_EDITOR);
    setConfirmDeleteOpen(false);
  }, []);

  const openCreateProgramEditor = useCallback(() => {
    setEditor({
      isOpen: true,
      kind: "program",
      mode: "create",
      title: "Untitled program",
      description: "",
      programId: null,
      clusterId: null,
    });
  }, []);

  const openEditProgramEditor = useCallback((program: LyciumProgram) => {
    setEditor({
      isOpen: true,
      kind: "program",
      mode: "edit",
      title: program.title,
      description: program.description,
      programId: program.id,
      clusterId: null,
    });
  }, []);

  const openCreateClusterEditor = useCallback((program: LyciumProgram | null) => {
    setEditor({
      isOpen: true,
      kind: "cluster",
      mode: "create",
      title: "Untitled cluster",
      description: "",
      programId: program?.id ?? null,
      clusterId: null,
    });
  }, []);

  const openEditClusterEditor = useCallback((program: LyciumProgram, cluster: LyciumRequirementGroup) => {
    setEditor({
      isOpen: true,
      kind: "cluster",
      mode: "edit",
      title: cluster.displayName,
      description: cluster.purpose,
      programId: program.id,
      clusterId: cluster.id,
    });
  }, []);

  const setTitle = useCallback((title: string) => {
    setEditor((current) => ({ ...current, title }));
  }, []);

  const setDescription = useCallback((description: string) => {
    setEditor((current) => ({ ...current, description }));
  }, []);

  const saveEditor = useCallback(() => {
    if (!editor.isOpen) {
      return null;
    }

    if (editor.kind === "program") {
      const nextProgram =
        editor.mode === "create" || !selectedProgram
          ? buildEmptyLocalProgramDraft(editor.title.trim() || "Untitled program", editor.description.trim() || "")
          : {
              ...selectedProgram,
              title: editor.title.trim() || selectedProgram.title,
              description: editor.description.trim(),
              reviewStatus: "draft" as const,
            };

      persistLocalProgramDraft(nextProgram);
      setPrograms((current) => mergeProgramsById([nextProgram], current));
      setEditor((current) => ({
        ...current,
        mode: "edit",
        programId: nextProgram.id,
        title: nextProgram.title,
        description: nextProgram.description,
      }));
      onCatalogNavigate(getCatalogProgramPath(nextProgram));
      return { program: nextProgram, cluster: null as LyciumRequirementGroup | null };
    }

    const baseProgram =
      selectedProgram ?? buildEmptyLocalProgramDraft("Untitled program", "A blank local program draft.");
    const didBootstrapProgram = !selectedProgram;
    const nextCluster =
      editor.mode === "create" || !selectedCluster
        ? buildEmptyRequirementGroupDraft(
            baseProgram,
            editor.title.trim() || "Untitled cluster",
            editor.description.trim(),
          )
        : {
            ...selectedCluster,
            displayName: editor.title.trim() || selectedCluster.displayName,
            purpose: editor.description.trim(),
          };

    const nextProgram: LyciumProgram = {
      ...baseProgram,
      reviewStatus: "draft",
      requirementGroups:
        editor.mode === "create" || !selectedCluster
          ? [...baseProgram.requirementGroups, nextCluster]
          : baseProgram.requirementGroups.map((cluster) =>
              cluster.id === nextCluster.id ? nextCluster : cluster,
            ),
    };

    persistLocalProgramDraft(nextProgram);
    setPrograms((current) => mergeProgramsById([nextProgram], current));
    setEditor((current) => ({
      ...current,
      mode: "edit",
      programId: nextProgram.id,
      clusterId: nextCluster.id,
      title: nextCluster.displayName,
      description: nextCluster.purpose,
    }));
    onCatalogNavigate(getCatalogClusterPath(nextProgram, nextCluster));

    return {
      program: nextProgram,
      cluster: nextCluster,
      bootstrappedProgram: didBootstrapProgram,
    };
  }, [editor, onCatalogNavigate, selectedCluster, selectedProgram, setPrograms]);

  const deleteEditorTarget = useCallback(() => {
    if (!editor.isOpen) {
      return;
    }

    if (editor.kind === "program") {
      if (!editor.programId) {
        closeEditor();
        return;
      }
      deletePersistedLocalProgramDraft(editor.programId);
      setPrograms((current) => current.filter((program) => program.id !== editor.programId));
      closeEditor();
      onCatalogNavigate("/catalog/programs");
      return;
    }

    if (!selectedProgram || !editor.clusterId) {
      closeEditor();
      return;
    }

    const nextProgram: LyciumProgram = {
      ...selectedProgram,
      requirementGroups: selectedProgram.requirementGroups.filter((cluster) => cluster.id !== editor.clusterId),
      reviewStatus: "draft",
    };
    persistLocalProgramDraft(nextProgram);
    setPrograms((current) => mergeProgramsById([nextProgram], current));
    closeEditor();
    onCatalogNavigate(getCatalogProgramPath(nextProgram));
  }, [closeEditor, editor, onCatalogNavigate, selectedProgram, setPrograms]);

  return {
    closeEditor,
    confirmDeleteOpen,
    deleteEditorTarget,
    editor,
    openCreateClusterEditor,
    openCreateProgramEditor,
    openEditClusterEditor,
    openEditProgramEditor,
    saveEditor,
    selectedCluster,
    selectedProgram,
    setConfirmDeleteOpen,
    setDescription,
    setTitle,
  };
}
