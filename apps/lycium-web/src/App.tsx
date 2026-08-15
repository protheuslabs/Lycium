"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { usePathname, useRouter } from "next/navigation";
import CourseCatalog from "./components/CourseCatalog/CourseCatalog";
import CourseLearningLayout from "./components/CourseLearningLayout/CourseLearningLayout";
import ProgramView from "./components/ProgramView/ProgramView";
import AppSettingsModal from "./components/SettingsModal/AppSettingsModal";
import TopBar from "./components/TopBar/TopBar";
import { localCourses } from "./courseData/localCourses";
import { localPrograms, programBenchmarks } from "./courseData/programs";
import sourceRecordsData from "./courseData/sourceRecords";
import type { CourseEntry } from "./courseTypes";
import { useAgentSettings } from "./hooks/useAgentSettings";
import { describeAiConnectionReadiness } from "./utils/aiConnectionReadiness";
import { useConfiguredCourses } from "./hooks/useConfiguredCourses";
import { useCourseEditingActions } from "./hooks/useCourseEditingActions";
import { useCourseGenerationActions } from "./hooks/useCourseGenerationActions";
import { useCourseProgressState } from "./hooks/useCourseProgressState";
import { useCourseSectionRegenerationActions } from "./hooks/useCourseSectionRegenerationActions";
import { useCourseSourceGapActions } from "./hooks/useCourseSourceGapActions";
import { useProgramArtifacts } from "./hooks/useProgramArtifacts";
import { API_BASE, scrollCoursePageToTop } from "./runtime/appRuntime";
import { summarizeCourseProgress } from "./utils/courseProgress";
import { COURSE_CATALOG_PATH, COURSE_CATALOG_COURSES_PATH, COURSE_CATALOG_PROGRAMS_PATH, LYCIUM_ROUTE_ROOT, SETTINGS_PATH, browserPathForRoute, getCatalogClusterPath, getCatalogProgramPath, getCoursePathSlug, getCourseSectionPath, getProgramClusterPathSlug, getProgramPathSlug, getSectionPathSlug, parseCourseRoute } from "./utils/courseRouting";
import { mergeCourseEntriesByKey, readPersistedLocalCourseEntries } from "./utils/localCourseDrafts";
import { readSettingsBackdropPath, writeSettingsBackdropPath } from "./utils/settingsRouteState";
import { useCourseRouteNavigation } from "./hooks/useCourseRouteNavigation";
import { useCatalogSelectionBuilder } from "./hooks/useCatalogSelectionBuilder";
import { useProgramCatalogEditor } from "./hooks/useProgramCatalogEditor";
import { useClientMounted } from "./hooks/useClientMounted";

type AppProps = {
  initialPath?: string;
};
function App({ initialPath }: AppProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedInitialPath = initialPath ?? pathname ?? COURSE_CATALOG_PATH;
  const settingsReturnPathRef = useRef(COURSE_CATALOG_PATH);
  const [courses, setCourses] = useState<CourseEntry[]>(localCourses);
  const [programs, setPrograms] = useState<LyciumProgram[]>(localPrograms);
  const [currentCourseKey, setCurrentCourseKey] = useState(localCourses[0]?.key ?? "");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [level, setLevel] = useState("");
  const [learnerId, setLearnerId] = useState<number | null>(null);
  const currentPath = pathname ?? resolvedInitialPath;
  const [courseKeyToOpenInEditMode, setCourseKeyToOpenInEditMode] = useState<string | null>(null);
  const [pageBehindSettingsPath, setPageBehindSettingsPath] = useState(() => {
    return parseCourseRoute(resolvedInitialPath).kind === "settings" ? readSettingsBackdropPath() : resolvedInitialPath;
  });
  const currentPathRef = useRef(currentPath);

  const route = useMemo(() => parseCourseRoute(currentPath), [currentPath]);
  const viewRoute = useMemo(
    () => (route.kind === "settings" ? parseCourseRoute(pageBehindSettingsPath) : route),
    [pageBehindSettingsPath, route],
  );
  const agentSettings = useAgentSettings(route.kind, API_BASE);
  const { programArtifacts, submitProgramArtifact } = useProgramArtifacts();
  const clientMounted = useClientMounted();
  const routeCourses = useMemo(
    () => clientMounted ? mergeCourseEntriesByKey(readPersistedLocalCourseEntries(), courses) : courses,
    [clientMounted, courses],
  );

  const coursesByPathSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of routeCourses) {
      map.set(getCoursePathSlug(course), course.key);
    }
    return map;
  }, [routeCourses]);

  const programsByPathSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const program of programs) {
      map.set(getProgramPathSlug(program), program.id);
    }
    return map;
  }, [programs]);

  const resolveCourseKeyFromPath = useCallback(
    (courseSlug: string | null): string | null => (courseSlug ? coursesByPathSlug.get(courseSlug) ?? null : null),
    [coursesByPathSlug],
  );

  const selectedCourseFromPath = useMemo(() => {
    if (viewRoute.kind !== "course") {
      return null;
    }
    const key = resolveCourseKeyFromPath(viewRoute.courseSlug);
    return key ? routeCourses.find((course) => course.key === key) ?? null : null;
  }, [resolveCourseKeyFromPath, routeCourses, viewRoute.courseSlug, viewRoute.kind]);

  const selectedCourse = useMemo(() => {
    if (viewRoute.kind === "course") {
      return selectedCourseFromPath ?? undefined;
    }

    const match = selectedCourseFromPath ?? courses.find((course) => course.key === currentCourseKey);
    return match ?? courses[0];
  }, [courses, currentCourseKey, selectedCourseFromPath, viewRoute.kind]);

  const selectedProgram = useMemo(() => {
    if (viewRoute.kind !== "program" || !viewRoute.programSlug) {
      return null;
    }
    const programId = programsByPathSlug.get(viewRoute.programSlug);
    return programId ? programs.find((program) => program.id === programId) ?? null : null;
  }, [programs, programsByPathSlug, viewRoute.kind, viewRoute.programSlug]);

  const selectedCatalogProgram = useMemo(() => {
    if (viewRoute.kind !== "home" || !viewRoute.programSlug) {
      return null;
    }
    const programId = programsByPathSlug.get(viewRoute.programSlug);
    return programId ? programs.find((program) => program.id === programId) ?? null : null;
  }, [programs, programsByPathSlug, viewRoute.kind, viewRoute.programSlug]);

  const selectedCatalogCluster = useMemo(() => {
    if (!selectedCatalogProgram || !viewRoute.clusterSlug) {
      return null;
    }
    return (
      selectedCatalogProgram.requirementGroups.find(
        (cluster) => getProgramClusterPathSlug(cluster) === viewRoute.clusterSlug,
      ) ?? null
    );
  }, [selectedCatalogProgram, viewRoute.clusterSlug]);

  const sections = useMemo(
    () =>
      (selectedCourse?.data?.modules ?? []).flatMap((module, moduleIndex) =>
        module.sections.map((section, sectionIndex) => ({
          ...section,
          moduleId: module.id,
          moduleIndex,
          moduleTitle: module.title,
          displayNumber: `${moduleIndex + 1}.${sectionIndex + 1}`,
        })),
      ),
    [selectedCourse],
  );

  const routeSectionIndex = useMemo(() => {
    if (viewRoute.kind !== "course" || !viewRoute.unitSlug) {
      return -1;
    }

    return sections.findIndex((section) => getSectionPathSlug(section) === viewRoute.unitSlug);
  }, [sections, viewRoute.kind, viewRoute.unitSlug]);
  const visibleSectionIndex = routeSectionIndex >= 0 ? routeSectionIndex : currentSectionIndex;
  const currentSection = sections[visibleSectionIndex] ?? null;
  const orderMandatory = selectedCourse?.data?.orderMandatory ?? false;
  const {
    progress,
    resolvedSectionStatuses,
    completedSectionIds,
    handleSectionTimedStatusChange,
    handleCompleteSection,
  } = useCourseProgressState({
    selectedCourse,
    sections,
    orderMandatory,
    learnerId,
    currentSectionId: currentSection?.id ?? null,
  });

  const courseProgress = summarizeCourseProgress(sections, {
    completedSectionIds: progress.completedSectionIds,
    sectionStatuses: resolvedSectionStatuses,
  });
  const currentModuleIndex = currentSection?.moduleIndex ?? 0;
  const moduleSections = sections.filter((section) => section.moduleIndex === currentModuleIndex);
  const moduleProgress = summarizeCourseProgress(moduleSections, {
    completedSectionIds: progress.completedSectionIds,
    sectionStatuses: resolvedSectionStatuses,
  });

  const routeToHome = useCallback(() => {
    if (currentPath !== COURSE_CATALOG_PATH) {
      router.push(COURSE_CATALOG_PATH);
    }
    currentPathRef.current = COURSE_CATALOG_PATH;
  }, [currentPath, router]);

  const routeToCatalogDrilldown = useCallback(
    (
      viewLevel: "programs" | "courses" | "clusters",
      program: LyciumProgram | null = null,
      cluster: LyciumRequirementGroup | null = null,
    ) => {
      const nextPath = cluster && program
        ? getCatalogClusterPath(program, cluster)
        : program
          ? getCatalogProgramPath(program)
          : viewLevel === "programs"
            ? COURSE_CATALOG_PROGRAMS_PATH
            : COURSE_CATALOG_COURSES_PATH;
      if (currentPathRef.current !== nextPath) {
        if (typeof window === "undefined") {
          router.push(nextPath);
        } else {
          window.history.pushState(null, "", browserPathForRoute(nextPath));
        }
      }
      currentPathRef.current = nextPath;
      scrollCoursePageToTop();
    },
    [router],
  );
  const navigateCatalogPath = useCallback(
    (path: string) => {
      if (currentPathRef.current !== path) {
        if (typeof window === "undefined") {
          router.push(path);
        } else {
          window.history.pushState(null, "", browserPathForRoute(path));
        }
      }
      currentPathRef.current = path;
      scrollCoursePageToTop();
    },
    [router],
  );
  const {
    cancelCatalogSelection,
    catalogSelectionMode,
    commitCatalogSelection,
    setCatalogSelectionMode,
    startClusterSelection,
    startProgramSelection,
    toggleClusterSelection,
    toggleCourseSelection,
  } = useCatalogSelectionBuilder({
    courses,
    programs,
    setPrograms,
  });
  const programEditor = useProgramCatalogEditor({
    programs,
    setPrograms,
    onCatalogNavigate: navigateCatalogPath,
  });

  const { queueCourseSourceGap } = useCourseSourceGapActions({ setCourses });

  const routeToSettings = useCallback(
    (event?: MouseEvent<HTMLAnchorElement>) => {
      event?.preventDefault();
      if (currentPath === SETTINGS_PATH) {
        currentPathRef.current = SETTINGS_PATH;
        return;
      }
      const returnPath = currentPath === SETTINGS_PATH ? pageBehindSettingsPath : currentPath;
      settingsReturnPathRef.current = returnPath;
      setPageBehindSettingsPath(returnPath);
      writeSettingsBackdropPath(returnPath);
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", browserPathForRoute(SETTINGS_PATH));
      } else {
        router.push(SETTINGS_PATH);
      }
      currentPathRef.current = SETTINGS_PATH;
    },
    [currentPath, pageBehindSettingsPath, router],
  );

  const closeSettingsModal = useCallback(() => {
    const returnTo = pageBehindSettingsPath || settingsReturnPathRef.current;
    const targetPath = returnTo && returnTo !== SETTINGS_PATH ? returnTo : COURSE_CATALOG_PATH;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", browserPathForRoute(targetPath));
    } else {
      router.replace(targetPath);
    }
    currentPathRef.current = targetPath;
    setPageBehindSettingsPath(targetPath);
  }, [pageBehindSettingsPath, router]);

  const { openCourseByEntry, pushSectionPath, rememberCourseSection } = useCourseRouteNavigation({
    router,
    currentPathRef,
    setCurrentCourseKey,
    setCurrentSectionIndex,
  });

  const handleManualCourseCreated = useCallback((course: CourseEntry) => {
    setCourseKeyToOpenInEditMode(course.key);
  }, []);
  const handleInitialEditModeConsumed = useCallback(() => {
    setCourseKeyToOpenInEditMode(null);
  }, []);
  const { createManualCourse, deleteCourseDraft, exportCourseDraft, forkCourse, importCourseDraft, resetCourseDraft, saveCourseDraft } = useCourseEditingActions({
    openCourseByEntry,
    setCourses,
    onManualCourseCreated: handleManualCourseCreated,
  });
  const goToSectionIndex = useCallback((index: number) => {
    setCurrentSectionIndex(index);
    const section = sections[index];
    if (selectedCourse && section) {
      pushSectionPath(selectedCourse, section);
    }
  }, [pushSectionPath, sections, selectedCourse]);

  const activeAiConnection = useMemo(
    () => describeAiConnectionReadiness(agentSettings.agentKeys),
    [agentSettings.agentKeys],
  );
  const activeAiReady = activeAiConnection.ready;

  const { regenerateCourseSection } = useCourseSectionRegenerationActions({
    learnerId,
    activeAiReady,
    aiLockedReason: activeAiConnection.lockedReason,
    openCourseByEntry,
    setCourses,
  });

  const {
    generateStatus,
    generateMessage,
    generateProgress,
    generateTitle,
    publishingCourseKey,
    handleGenerateCourse,
    handlePublishCourse,
    handleResumeCourseSourceGap,
  } = useCourseGenerationActions({
    prompt,
    level,
    learnerId,
    activeAiReady,
    aiLockedReason: activeAiConnection.lockedReason,
    setCourses,
    setPrompt,
    openCourseByEntry,
  });

  useConfiguredCourses({ setCourses, setLearnerId, setPrograms });

  useEffect(() => {
    if (pathname) {
      currentPathRef.current = pathname;
      if (parseCourseRoute(pathname).kind !== "settings") {
        settingsReturnPathRef.current = pathname;
        writeSettingsBackdropPath(pathname);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (currentPath !== "/" && currentPath !== LYCIUM_ROUTE_ROOT) {
      return;
    }

    router.replace(COURSE_CATALOG_PATH);
    currentPathRef.current = COURSE_CATALOG_PATH;
  }, [currentPath, router]);

  useEffect(() => {
    if (route.kind !== "program") return;
    if (route.programSlug && programsByPathSlug.has(route.programSlug)) return;
    router.replace(COURSE_CATALOG_PATH);
    currentPathRef.current = COURSE_CATALOG_PATH;
  }, [programsByPathSlug, route.kind, route.programSlug, router]);

  useEffect(() => {
    if (viewRoute.kind === "home") {
      return;
    }
    setCatalogSelectionMode(null);
  }, [setCatalogSelectionMode, viewRoute.kind]);

  useEffect(() => {
    if (route.kind !== "course" || !route.courseSlug) return;
    const resolvedKey = resolveCourseKeyFromPath(route.courseSlug);
    const routeCourse = resolvedKey ? routeCourses.find((course) => course.key === resolvedKey) ?? null : null;
    if (!routeCourse) return;

    const routeSections = routeCourse.data.modules.flatMap((module) => module.sections);
    const firstSection = routeSections[0];
    if (!firstSection) return;
    if (!route.unitSlug) {
      void openCourseByEntry(routeCourse, true);
      return;
    }

    const sectionIndex = routeSections.findIndex((section) => getSectionPathSlug(section) === route.unitSlug);
    if (sectionIndex >= 0) {
      const routeSection = routeSections[sectionIndex];
      if (routeSection) rememberCourseSection(routeCourse, routeSection, getCourseSectionPath(routeCourse, routeSection));
      return;
    }
    pushSectionPath(routeCourse, firstSection, true);
  }, [
    route.kind,
    route.courseSlug,
    route.unitSlug,
    resolveCourseKeyFromPath,
    routeCourses,
    openCourseByEntry,
    pushSectionPath,
    rememberCourseSection,
  ]);

  return (
    <div className="app-root">
      <TopBar onOpenSettings={routeToSettings} onOpenCatalog={routeToHome} />

      {viewRoute.kind === "home" ? (
        <CourseCatalog
          courses={courses}
          programs={programs}
          catalogView={viewRoute.kind === "home" ? viewRoute.catalogView ?? null : null}
          catalogProgramId={selectedCatalogProgram?.id ?? null}
          catalogClusterId={selectedCatalogCluster?.id ?? null}
          prompt={prompt}
          level={level}
          canCreateCourse={activeAiReady}
          aiLockedReason={activeAiConnection.lockedReason}
          generateStatus={generateStatus}
          generateMessage={generateMessage}
          generateProgress={generateProgress}
          generateTitle={generateTitle}
          onPromptChange={setPrompt}
          onLevelChange={setLevel}
          onGenerateCourse={handleGenerateCourse}
          onOpenCourse={openCourseByEntry}
          onQueueCourseSourceGap={queueCourseSourceGap}
          onResumeCourseSourceGap={handleResumeCourseSourceGap}
          catalogSelectionMode={catalogSelectionMode}
          programEditor={programEditor}
          onStartProgramSelection={startProgramSelection}
          onStartClusterSelection={startClusterSelection}
          onToggleProgramClusterSelection={toggleClusterSelection}
          onToggleClusterCourseSelection={toggleCourseSelection}
          onCommitCatalogSelection={commitCatalogSelection}
          onCancelCatalogSelection={cancelCatalogSelection}
          onCatalogDrilldown={routeToCatalogDrilldown} onPublishCourse={handlePublishCourse}
          onForkCourse={forkCourse} onCreateManualCourse={createManualCourse}
          onDeleteCourseDraft={deleteCourseDraft} onExportCourseDraft={exportCourseDraft}
          onImportCourseDraft={importCourseDraft} onResetCourseDraft={resetCourseDraft}
          publishingCourseKey={publishingCourseKey}
          onOpenSettings={routeToSettings}
        />
      ) : viewRoute.kind === "program" && selectedProgram ? (
        <ProgramView
          program={selectedProgram}
          courses={courses}
          benchmarks={programBenchmarks[selectedProgram.id as keyof typeof programBenchmarks] ?? []}
          portfolioArtifacts={new Map()} submittedArtifacts={programArtifacts} sources={sourceRecordsData.sources}
          onOpenCourse={openCourseByEntry} onOpenCatalog={routeToHome} onSubmitArtifact={submitProgramArtifact}
        />
      ) : (
        <CourseLearningLayout
          key={selectedCourse?.key ?? "no-course"}
          sections={sections}
          visibleSectionIndex={visibleSectionIndex}
          selectedCourse={selectedCourse}
          currentSection={currentSection}
          courseProgress={courseProgress}
          moduleProgress={moduleProgress}
          resolvedSectionStatuses={resolvedSectionStatuses}
          completedSectionIds={completedSectionIds}
          orderMandatory={orderMandatory}
          sources={sourceRecordsData.sources}
          onSectionSelect={goToSectionIndex}
	          onCompleteSection={handleCompleteSection}
	          onSectionTimedStatusChange={handleSectionTimedStatusChange}
          onSaveCourseDraft={saveCourseDraft}
          initialEditCourseKey={courseKeyToOpenInEditMode}
          onInitialEditModeConsumed={handleInitialEditModeConsumed}
            canUseAiRefresh={activeAiReady}
            aiConnectionLockReason={activeAiConnection.lockedReason}
            onRegenerateSection={regenerateCourseSection}
	        />
      )}

      <AppSettingsModal isOpen={route.kind === "settings"} agentSettings={agentSettings} onClose={closeSettingsModal} />
    </div>
  );
}

export default App;
