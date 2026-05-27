"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import ContentView from "./components/ContentView/ContentView";
import CourseCatalog from "./components/CourseCatalog/CourseCatalog";
import SettingsModal from "./components/SettingsModal/SettingsModal";
import Sidebar from "./components/Sidebar/Sidebar";
import TopBar from "./components/TopBar/TopBar";
import { localCourses } from "./courseData/localCourses";
import sourceRecordsData from "./courseData/sourceRecords";
import type { CourseEntry, CourseSection } from "./courseTypes";
import { useAgentSettings } from "./hooks/useAgentSettings";
import { useCourseProgressState } from "./hooks/useCourseProgressState";
import { API_BASE, browserStorage, localApiSyncEnabled, lyciumApi, repositorySet, scrollCoursePageToTop } from "./runtime/appRuntime";
import { formatCourseValidationErrors, validateCourseEntry } from "./utils/courseValidation";
import { summarizeCourseProgress } from "./utils/courseProgress";
import {
  COURSE_CATALOG_PATH,
  LYCIUM_ROUTE_ROOT,
  SETTINGS_PATH,
  findBookmarkedSection,
  getCoursePath,
  getCoursePathSlug,
  getCourseSectionIndex,
  getCourseSectionPath,
  getFirstCourseSection,
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
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [generateMessage, setGenerateMessage] = useState("");
  const [publishingCourseKey, setPublishingCourseKey] = useState<string | null>(null);
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

  const handleGenerateCourse = async (evt: FormEvent<HTMLFormElement>, sourceLinks: string[] = []) => {
    evt.preventDefault();
    if (!prompt.trim()) return;
    setGenerateStatus("loading");
    setGenerateMessage("Starting course generation...");

    try {
      let job = await lyciumApi.createCourseGenerationJob({
        prompt,
        learner_id: learnerId ?? undefined,
        level: level || undefined,
        source_policy: "balanced",
        desired_module_count: 12,
        expected_duration_minutes: 2700,
        source_urls: sourceLinks,
      });
      while (job.status === "queued" || job.status === "running") {
        const percent = Math.round((job.progress ?? 0) * 100);
        setGenerateMessage(`${percent}% · ${job.message || job.current_stage || "Generating course..."}`);
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        job = await lyciumApi.getCourseGenerationJob(job.id);
      }

      if (job.status === "failed") {
        throw new Error(job.error || job.message || "Course generation failed.");
      }

      const generatedSnapshot = job.course_snapshot;
      if (!generatedSnapshot?.structure) {
        throw new Error("Course generation finished without a ready course snapshot.");
      }

      const entry: CourseEntry = {
        key: `remote-${generatedSnapshot.id}`,
        title: generatedSnapshot.title,
        data: generatedSnapshot.structure,
        snapshotId: Number(generatedSnapshot.id),
        source: "remote",
        status: generatedSnapshot.status,
      };
      const validation = validateCourseEntry(entry, {
        centralSourceRecords: sourceRecordsData.sources,
        requireSources: true,
      });
      if (!validation.valid) {
        throw new Error(`Generated course failed validation: ${formatCourseValidationErrors(validation.errors)}`);
      }
      setCourses((prev) => [entry, ...prev]);
      setPrompt("");
      setGenerateStatus("success");
      setGenerateMessage("Course generated and ready for review.");
      openCourseByEntry(entry);
    } catch (err) {
      console.warn("Course generation failed:", err);
      setGenerateStatus("error");
      setGenerateMessage(err instanceof Error ? err.message : "Course generation failed. Is the API running?");
    }
  };

  const handlePublishCourse = useCallback(async (course: CourseEntry) => {
    if (!course.snapshotId) return;
    setPublishingCourseKey(course.key);
    try {
      const publishedCourse = await lyciumApi.publishCourse(course.snapshotId);
      const entry: CourseEntry = {
        key: `remote-${publishedCourse.id}`,
        title: publishedCourse.title,
        data: publishedCourse.structure,
        snapshotId: Number(publishedCourse.id),
        source: "remote",
        status: publishedCourse.status,
      };
      const validation = validateCourseEntry(entry, {
        centralSourceRecords: sourceRecordsData.sources,
        requireSources: true,
      });
      if (!validation.valid) {
        throw new Error(`Published course failed validation: ${formatCourseValidationErrors(validation.errors)}`);
      }
      setCourses((prev) => prev.map((current) => (current.key === course.key ? entry : current)));
    } catch (err) {
      console.warn("Course publish failed:", err);
      setGenerateStatus("error");
      setGenerateMessage(err instanceof Error ? err.message : "Course publish failed.");
    } finally {
      setPublishingCourseKey(null);
    }
  }, []);

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

  useEffect(() => {
    if (repositorySet.mode !== "local") {
      repositorySet.courses
        .listCourses()
        .then((courseCards) => {
          const configuredCourses = courseCards
            .flatMap((card) => (card.course ? [card.course] : []))
            .map((course): CourseEntry => ({ ...course, source: course.source === "local" ? "local" : "remote" }));

          if (configuredCourses.length > 0) {
            setCourses(configuredCourses);
          }
        })
        .catch((err: unknown) => console.warn("Configured course repository unavailable:", err));
      return;
    }

    if (!localApiSyncEnabled) {
      const stored = browserStorage.readLearnerId();
      if (stored) {
        setLearnerId(stored);
      }
      return;
    }

    const fetchRemoteCourses = async () => {
      try {
        const rows = await lyciumApi.listRemoteCourses(100, "all");
        const remoteCourses: CourseEntry[] = [];
        for (const row of rows) {
          const snapshotId = Number(row.id);
          const entry: CourseEntry = {
            key: `remote-${row.id}`,
            title: row.title,
            data: row.structure,
            snapshotId,
            source: "remote",
            status: row.status,
          };
          const validation = validateCourseEntry(entry, {
            centralSourceRecords: sourceRecordsData.sources,
            requireSources: true,
          });
          if (validation.valid) {
            remoteCourses.push(entry);
          } else {
            console.warn(`Skipping invalid remote course ${entry.key}: ${formatCourseValidationErrors(validation.errors)}`);
          }
        }
        setCourses((prev) => [...remoteCourses, ...prev.filter((course) => course.source === "local")]);
      } catch (err) {
        console.warn("Remote courses unavailable:", err);
      }
    };

    const ensureLearner = async () => {
      const stored = browserStorage.readLearnerId();
      if (stored) {
        setLearnerId(stored);
        return;
      }
      try {
        const learner = await lyciumApi.createLearner({
          name: "Lycium Learner",
          goal: "Build a personalized course catalog",
          level: "beginner",
          preferences: { modalities: ["text", "video"], time_budget: "4h/week" },
        });
        browserStorage.writeLearnerId(learner.id);
        setLearnerId(Number(learner.id));
      } catch (err) {
        console.warn("Unable to create learner:", err);
      }
    };

    fetchRemoteCourses();
    ensureLearner();
  }, []);

  return (
    <div className="app-root">
      <TopBar onOpenSettings={routeToSettings} onOpenCatalog={routeToHome} />

      {viewRoute.kind === "home" ? (
        <CourseCatalog
          courses={courses}
          prompt={prompt}
          level={level}
          canCreateCourse={agentSettings.agentKeys.some((key) => key.is_active && Boolean(key.model))}
          generateStatus={generateStatus}
          generateMessage={generateMessage}
          onPromptChange={setPrompt}
          onLevelChange={setLevel}
          onGenerateCourse={handleGenerateCourse}
          onOpenCourse={openCourseByEntry}
          onPublishCourse={handlePublishCourse}
          publishingCourseKey={publishingCourseKey}
          onOpenSettings={routeToSettings}
        />
      ) : (
        <div className="main-layout">
          <Sidebar
            sections={sections}
            currentSectionIndex={visibleSectionIndex}
            onSectionSelect={goToSectionIndex}
            courseTitle={selectedCourse?.data?.title ?? "Course"}
            progressPercentage={courseProgress.percentage}
            viewedPercentage={courseProgress.viewedPercentage}
            sectionStatuses={resolvedSectionStatuses}
          />
          <div className="course-content-host">
            <ContentView
              courseKey={selectedCourse?.key ?? ""}
              courseTitle={selectedCourse?.data?.title ?? "Course"}
              section={currentSection}
              moduleTitle={currentSection?.moduleTitle ?? ""}
              moduleIndex={currentSection?.moduleIndex ?? 0}
              onNext={() => goToSectionIndex(Math.min(visibleSectionIndex + 1, sections.length - 1))}
              onPrev={() => goToSectionIndex(Math.max(visibleSectionIndex - 1, 0))}
              nextSectionTitle={sections[visibleSectionIndex + 1]?.title ?? null}
              isFirstSection={visibleSectionIndex === 0}
              isLastSection={visibleSectionIndex === sections.length - 1}
              progressPercentage={moduleProgress.percentage}
              viewedPercentage={moduleProgress.viewedPercentage}
              markComplete={handleCompleteSection}
              isComplete={currentSection ? completedSectionIds.has(currentSection.id) : false}
              orderMandatory={orderMandatory}
              onSectionTimedStatusChange={handleSectionTimedStatusChange}
              sources={sourceRecordsData.sources}
            />
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={route.kind === "settings"}
        agentKeys={agentSettings.agentKeys}
        agentProviders={agentSettings.agentProviders}
        agentProviderId={agentSettings.agentProviderId}
        agentApiKey={agentSettings.agentApiKey}
        apiKeySaveStatus={agentSettings.apiKeySaveStatus}
        canAddAgentKey={agentSettings.canAddAgentKey}
        themeMode={agentSettings.themeMode}
        settingsMessage={agentSettings.settingsMessage}
        settingsStatus={agentSettings.settingsStatus}
        onClose={closeSettingsModal}
        onActivateAgentKey={agentSettings.handleActivateAgentKey}
        onAgentModelChange={agentSettings.handleAgentModelChange}
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
