"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { usePathname, useRouter } from "next/navigation";
import CourseCatalog from "./components/CourseCatalog/CourseCatalog";
import CourseLearningLayout from "./components/CourseLearningLayout/CourseLearningLayout";
import ProgramView from "./components/ProgramView/ProgramView";
import SettingsModal from "./components/SettingsModal/SettingsModal";
import TopBar from "./components/TopBar/TopBar";
import { localCourses } from "./courseData/localCourses";
import { localPrograms, programBenchmarks } from "./courseData/programs";
import sourceRecordsData from "./courseData/sourceRecords";
import type { CourseEntry, CourseSection } from "./courseTypes";
import { useAgentSettings } from "./hooks/useAgentSettings";
import { useConfiguredCourses } from "./hooks/useConfiguredCourses";
import { useCourseGenerationActions } from "./hooks/useCourseGenerationActions";
import { useCourseProgressState } from "./hooks/useCourseProgressState";
import { API_BASE, browserStorage, localApiSyncEnabled, lyciumApi, scrollCoursePageToTop } from "./runtime/appRuntime";
import { summarizeCourseProgress } from "./utils/courseProgress";
import {
  COURSE_CATALOG_PATH,
  COURSE_CATALOG_COURSES_PATH,
  COURSE_CATALOG_PROGRAMS_PATH,
  LYCIUM_ROUTE_ROOT,
  SETTINGS_PATH,
  findBookmarkedSection,
  getCatalogClusterPath,
  getCatalogProgramPath,
  getCoursePath,
  getCoursePathSlug,
  getCourseSectionIndex,
  getCourseSectionPath,
  getFirstCourseSection,
  getProgramClusterPathSlug,
  getProgramPath,
  getProgramPathSlug,
  getSectionPathSlug,
  parseCourseRoute,
} from "./utils/courseRouting";
import { readSettingsBackdropPath, writeSettingsBackdropPath } from "./utils/settingsRouteState";

function App() {
  const router = useRouter();
  const pathname = usePathname();
  const settingsReturnPathRef = useRef(COURSE_CATALOG_PATH);
  const [courses, setCourses] = useState<CourseEntry[]>(localCourses);
  const [currentCourseKey, setCurrentCourseKey] = useState(localCourses[0]?.key ?? "");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [level, setLevel] = useState("");
  const [learnerId, setLearnerId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState(() => pathname ?? COURSE_CATALOG_PATH);
  const [pageBehindSettingsPath, setPageBehindSettingsPath] = useState(() => {
    const initialPath = pathname ?? COURSE_CATALOG_PATH;
    return parseCourseRoute(initialPath).kind === "settings" ? readSettingsBackdropPath() : initialPath;
  });
  const currentPathRef = useRef(currentPath);

  const route = useMemo(() => parseCourseRoute(currentPath), [currentPath]);
  const viewRoute = useMemo(
    () => (route.kind === "settings" ? parseCourseRoute(pageBehindSettingsPath) : route),
    [pageBehindSettingsPath, route],
  );
  const agentSettings = useAgentSettings(route.kind, API_BASE);

  const coursesByPathSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of courses) {
      map.set(getCoursePathSlug(course), course.key);
    }
    return map;
  }, [courses]);

  const programsByPathSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const program of localPrograms) {
      map.set(getProgramPathSlug(program), program.id);
    }
    return map;
  }, []);

  const resolveCourseKeyFromPath = useCallback(
    (courseSlug: string | null): string | null => (courseSlug ? coursesByPathSlug.get(courseSlug) ?? null : null),
    [coursesByPathSlug],
  );

  const selectedCourseFromPath = useMemo(() => {
    if (viewRoute.kind !== "course") {
      return null;
    }
    const key = resolveCourseKeyFromPath(viewRoute.courseSlug);
    return key ? courses.find((course) => course.key === key) ?? null : null;
  }, [courses, resolveCourseKeyFromPath, viewRoute.courseSlug, viewRoute.kind]);

  const selectedCourse = useMemo(() => {
    const match = selectedCourseFromPath ?? courses.find((course) => course.key === currentCourseKey);
    return match ?? courses[0];
  }, [courses, currentCourseKey, selectedCourseFromPath]);

  const selectedProgram = useMemo(() => {
    if (viewRoute.kind !== "program" || !viewRoute.programSlug) {
      return null;
    }
    const programId = programsByPathSlug.get(viewRoute.programSlug);
    return programId ? localPrograms.find((program) => program.id === programId) ?? null : null;
  }, [programsByPathSlug, viewRoute.kind, viewRoute.programSlug]);

  const selectedCatalogProgram = useMemo(() => {
    if (viewRoute.kind !== "home" || !viewRoute.programSlug) {
      return null;
    }
    const programId = programsByPathSlug.get(viewRoute.programSlug);
    return programId ? localPrograms.find((program) => program.id === programId) ?? null : null;
  }, [programsByPathSlug, viewRoute.kind, viewRoute.programSlug]);

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
    setCurrentPath(COURSE_CATALOG_PATH);
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
        router.push(nextPath);
      }
      currentPathRef.current = nextPath;
      setCurrentPath(nextPath);
      scrollCoursePageToTop();
    },
    [router],
  );

  const openProgramByEntry = useCallback(
    (program: (typeof localPrograms)[number]) => {
      const nextPath = getProgramPath(program);
      router.push(nextPath);
      currentPathRef.current = nextPath;
      setCurrentPath(nextPath);
      scrollCoursePageToTop();
    },
    [router],
  );

  const routeToSettings = useCallback(
    (event?: MouseEvent<HTMLAnchorElement>) => {
      event?.preventDefault();
      if (currentPath === SETTINGS_PATH) {
        currentPathRef.current = SETTINGS_PATH;
        setCurrentPath(SETTINGS_PATH);
        return;
      }
      const returnPath = currentPath === SETTINGS_PATH ? pageBehindSettingsPath : currentPath;
      settingsReturnPathRef.current = returnPath;
      setPageBehindSettingsPath(returnPath);
      writeSettingsBackdropPath(returnPath);
      router.push(SETTINGS_PATH);
      currentPathRef.current = SETTINGS_PATH;
      setCurrentPath(SETTINGS_PATH);
    },
    [currentPath, pageBehindSettingsPath, router],
  );

  const closeSettingsModal = useCallback(() => {
    const returnTo = pageBehindSettingsPath || settingsReturnPathRef.current;
    const targetPath = returnTo && returnTo !== SETTINGS_PATH ? returnTo : COURSE_CATALOG_PATH;
    router.replace(targetPath);
    currentPathRef.current = targetPath;
    setCurrentPath(targetPath);
    setPageBehindSettingsPath(targetPath);
  }, [pageBehindSettingsPath, router]);

  const rememberCourseSection = useCallback((course: CourseEntry, section: CourseSection, path: string) => {
    const bookmark = {
      course_key: course.key,
      course_title: course.title,
      section_id: section.id,
      section_title: section.title,
      path,
    };
    browserStorage.writeBookmark(course.key, bookmark);
    if (localApiSyncEnabled) {
      lyciumApi.saveBookmark(bookmark).catch((err) => console.warn("Failed to save course bookmark:", err));
    }
  }, []);

  const pushSectionPath = useCallback(
    (course: CourseEntry, section: CourseSection, replace = false) => {
      const nextPath = getCourseSectionPath(course, section);
      if (currentPathRef.current !== nextPath) {
        if (replace) {
          router.replace(nextPath);
        } else {
          router.push(nextPath);
        }
      }
      currentPathRef.current = nextPath;
      setCurrentPath(nextPath);
      rememberCourseSection(course, section, nextPath);
      scrollCoursePageToTop();
    },
    [rememberCourseSection, router],
  );

  const openCourseByEntry = useCallback(
    async (course: CourseEntry, replace = false) => {
      setCurrentCourseKey(course.key);
      let targetSection = findBookmarkedSection(course, browserStorage.readBookmark(course.key));
      if (!targetSection && localApiSyncEnabled) {
        try {
          targetSection = findBookmarkedSection(course, await lyciumApi.loadBookmark(course.key));
        } catch (err) {
          console.warn("Local bookmark unavailable:", err);
        }
      }

      const sectionToOpen = targetSection ?? getFirstCourseSection(course);
      if (sectionToOpen) {
        const sectionIndex = getCourseSectionIndex(course, sectionToOpen);
        setCurrentSectionIndex(sectionIndex >= 0 ? sectionIndex : 0);
        pushSectionPath(course, sectionToOpen, replace);
        return;
      }

      const nextPath = getCoursePath(course);
      if (replace) {
        router.replace(nextPath);
      } else {
        router.push(nextPath);
      }
      currentPathRef.current = nextPath;
      setCurrentPath(nextPath);
      scrollCoursePageToTop();
    },
    [pushSectionPath, router],
  );

  const goToSectionIndex = useCallback((index: number) => {
    setCurrentSectionIndex(index);
    const section = sections[index];
    if (selectedCourse && section) {
      pushSectionPath(selectedCourse, section);
    }
  }, [pushSectionPath, sections, selectedCourse]);

  const activeAiReady = agentSettings.agentKeys.some(
    (key) => key.is_active && Boolean(key.model) && key.connection_status !== "unverified",
  );

const {
  generateStatus,
  generateMessage,
  publishingCourseKey,
  handleGenerateCourse,
  handlePublishCourse,
} = useCourseGenerationActions({
  prompt,
  level,
  learnerId,
  activeAiReady,
  setCourses,
  setPrompt,
  openCourseByEntry,
});

  useConfiguredCourses({ setCourses, setLearnerId });

  useEffect(() => {
    if (pathname) {
      currentPathRef.current = pathname;
      setCurrentPath(pathname);
      if (parseCourseRoute(pathname).kind !== "settings") {
        settingsReturnPathRef.current = pathname;
        setPageBehindSettingsPath(pathname);
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
    setCurrentPath(COURSE_CATALOG_PATH);
  }, [currentPath, router]);

  useEffect(() => {
    if (route.kind !== "program") return;
    if (route.programSlug && programsByPathSlug.has(route.programSlug)) return;
    router.replace(COURSE_CATALOG_PATH);
    currentPathRef.current = COURSE_CATALOG_PATH;
    setCurrentPath(COURSE_CATALOG_PATH);
  }, [programsByPathSlug, route.kind, route.programSlug, router]);

  useEffect(() => {
    if (route.kind !== "course" || !route.courseSlug) return;
    const resolvedKey = resolveCourseKeyFromPath(route.courseSlug);
    const routeCourse = resolvedKey ? courses.find((course) => course.key === resolvedKey) ?? null : null;
    if (!routeCourse) return;
    if (routeCourse.key !== currentCourseKey) setCurrentCourseKey(routeCourse.key);

    const routeSections = routeCourse.data.modules.flatMap((module) => module.sections);
    const firstSection = routeSections[0];
    if (!firstSection) {
      setCurrentSectionIndex(0);
      return;
    }
    if (!route.unitSlug) {
      void openCourseByEntry(routeCourse, true);
      return;
    }

    const sectionIndex = routeSections.findIndex((section) => getSectionPathSlug(section) === route.unitSlug);
    if (sectionIndex >= 0) {
      const routeSection = routeSections[sectionIndex];
      setCurrentSectionIndex(sectionIndex);
      if (routeSection) rememberCourseSection(routeCourse, routeSection, getCourseSectionPath(routeCourse, routeSection));
      return;
    }
    setCurrentSectionIndex(0);
    pushSectionPath(routeCourse, firstSection, true);
  }, [
    route.kind,
    route.courseSlug,
    route.unitSlug,
    resolveCourseKeyFromPath,
    courses,
    currentCourseKey,
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
          programs={localPrograms}
          catalogView={viewRoute.kind === "home" ? viewRoute.catalogView ?? null : null}
          catalogProgramId={selectedCatalogProgram?.id ?? null}
          catalogClusterId={selectedCatalogCluster?.id ?? null}
          prompt={prompt}
          level={level}
          canCreateCourse={activeAiReady}
          generateStatus={generateStatus}
          generateMessage={generateMessage}
          onPromptChange={setPrompt}
          onLevelChange={setLevel}
          onGenerateCourse={handleGenerateCourse}
          onOpenCourse={openCourseByEntry}
          onOpenProgram={openProgramByEntry}
          onCatalogDrilldown={routeToCatalogDrilldown}
          onPublishCourse={handlePublishCourse}
          publishingCourseKey={publishingCourseKey}
          onOpenSettings={routeToSettings}
        />
      ) : viewRoute.kind === "program" && selectedProgram ? (
        <ProgramView
          program={selectedProgram}
          courses={courses}
          benchmarks={programBenchmarks[selectedProgram.id as keyof typeof programBenchmarks] ?? []}
          sources={sourceRecordsData.sources}
          onOpenCourse={openCourseByEntry}
          onOpenCatalog={routeToHome}
        />
      ) : (
        <CourseLearningLayout
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
        />
      )}

      <SettingsModal
        isOpen={route.kind === "settings"}
        agentKeys={agentSettings.agentKeys}
        agentProviders={agentSettings.agentProviders}
        agentProviderId={agentSettings.agentProviderId}
        agentApiKey={agentSettings.agentApiKey}
        apiKeySaveStatus={agentSettings.apiKeySaveStatus}
        verifyingAgentKeyId={agentSettings.verifyingAgentKeyId}
        canAddAgentKey={agentSettings.canAddAgentKey}
        themeMode={agentSettings.themeMode}
        settingsMessage={agentSettings.settingsMessage}
        settingsStatus={agentSettings.settingsStatus}
        onClose={closeSettingsModal}
        onActivateAgentKey={agentSettings.handleActivateAgentKey}
        onAgentModelChange={agentSettings.handleAgentModelChange}
        onVerifyAgentKey={agentSettings.handleVerifyAgentKey}
        onAgentProviderChange={agentSettings.setAgentProviderId}
        onAgentApiKeyChange={agentSettings.setAgentApiKey}
        onApiKeySaveStatusChange={agentSettings.setApiKeySaveStatus}
        onSettingsSubmit={agentSettings.handleSettingsSubmit}
        onThemeModeChange={agentSettings.handleThemeModeChange}
      />
    </div>
  );
}

export default App;
