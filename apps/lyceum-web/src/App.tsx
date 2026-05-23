import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import "./App.css";
import ContentView from "./components/ContentView/ContentView";
import CourseCatalog from "./components/CourseCatalog/CourseCatalog";
import SettingsModal from "./components/SettingsModal/SettingsModal";
import Sidebar from "./components/Sidebar/Sidebar";
import { localCourses } from "./courseData/localCourses";
import sourceRecordsData from "./courseData/sourceRecords";
import type { CourseEntry, CourseSection } from "./courseTypes";
import { useAgentSettings } from "./hooks/useAgentSettings";
import {
  findBookmarkedSection,
  getCoursePathSlug,
  getCourseSectionIndex,
  getCourseSectionPath,
  getFirstCourseSection,
  getSectionPathSlug,
  parseCourseRoute,
  readStoredCourseBookmark,
  writeStoredCourseBookmark,
} from "./utils/courseRouting";

const API_BASE = import.meta.env.VITE_PROTHEUS_API_URL ?? "http://127.0.0.1:8000";

type RemoteCourseRow = {
  id: string | number;
  title: string;
  structure: CourseEntry["data"];
};

function scrollCoursePageToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

function App() {
  const [courses, setCourses] = useState<CourseEntry[]>(localCourses);
  const [currentCourseKey, setCurrentCourseKey] = useState(localCourses[0]?.key ?? "");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [level, setLevel] = useState("");
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [generateMessage, setGenerateMessage] = useState("");
  const [learnerId, setLearnerId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [courseContentHeight, setCourseContentHeight] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ completedSectionIds: string[] }>({ completedSectionIds: [] });
  const courseContentRef = useRef<HTMLDivElement | null>(null);

  const route = useMemo(() => parseCourseRoute(currentPath), [currentPath]);
  const settingsReturnPath =
    route.kind === "settings" && typeof window.history.state?.settingsReturnTo === "string"
      ? window.history.state.settingsReturnTo
      : "/";
  const viewRoute = useMemo(
    () => (route.kind === "settings" ? parseCourseRoute(settingsReturnPath) : route),
    [route, settingsReturnPath]
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
    [coursesByPathSlug]
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
        }))
      ),
    [selectedCourse]
  );

  const currentSection = sections[currentSectionIndex] ?? null;
  const progressStorageKey = `lyceum-progress-${selectedCourse?.key}`;
  const completedSectionIds = new Set(progress.completedSectionIds);
  const completedSectionCount = sections.filter((section) => completedSectionIds.has(section.id)).length;
  const courseProgressPercentage = sections.length > 0 ? (completedSectionCount / sections.length) * 100 : 0;
  const currentModuleIndex = currentSection?.moduleIndex ?? 0;
  const moduleSections = sections.filter((section) => section.moduleIndex === currentModuleIndex);
  const completedModuleSectionCount = moduleSections.filter((section) => completedSectionIds.has(section.id)).length;
  const moduleProgressPercentage = moduleSections.length > 0 ? (completedModuleSectionCount / moduleSections.length) * 100 : 0;
  const orderMandatory = selectedCourse?.data?.orderMandatory ?? false;

  const routeToHome = useCallback(() => {
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
    }
    setCurrentPath("/");
  }, []);

  const routeToSettings = useCallback(
    (event?: MouseEvent<HTMLAnchorElement>) => {
      event?.preventDefault();
      if (window.location.pathname === "/settings") {
        setCurrentPath("/settings");
        return;
      }
      window.history.pushState(
        { settingsReturnTo: currentPath === "/settings" ? settingsReturnPath : currentPath },
        "",
        "/settings"
      );
      setCurrentPath("/settings");
    },
    [currentPath, settingsReturnPath]
  );

  const closeSettingsModal = useCallback(() => {
    const returnTo = typeof window.history.state?.settingsReturnTo === "string" ? window.history.state.settingsReturnTo : "/";
    const targetPath = returnTo && returnTo !== "/settings" ? returnTo : "/";
    window.history.replaceState({}, "", targetPath);
    setCurrentPath(targetPath);
  }, []);

  const rememberCourseSection = useCallback((course: CourseEntry, section: CourseSection, path: string) => {
    writeStoredCourseBookmark(course, section, path);
    fetch(`${API_BASE}/v1/local/bookmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_key: course.key,
        course_title: course.title,
        section_id: section.id,
        section_title: section.title,
        path,
      }),
    }).catch((err) => console.warn("Failed to save course bookmark:", err));
  }, []);

  const pushSectionPath = useCallback(
    (course: CourseEntry, section: CourseSection, replace = false) => {
      const nextPath = getCourseSectionPath(course, section);
      if (window.location.pathname !== nextPath) {
        const nextState = { courseKey: course.key, sectionId: section.id };
        if (replace) {
          window.history.replaceState(nextState, "", nextPath);
        } else {
          window.history.pushState(nextState, "", nextPath);
        }
      }
      setCurrentPath(nextPath);
      rememberCourseSection(course, section, nextPath);
      scrollCoursePageToTop();
    },
    [rememberCourseSection]
  );

  const openCourseByEntry = useCallback(
    async (course: CourseEntry, replace = false) => {
      setCurrentCourseKey(course.key);
      let targetSection = findBookmarkedSection(course, readStoredCourseBookmark(course));
      if (!targetSection) {
        try {
          const response = await fetch(`${API_BASE}/v1/local/bookmarks/${encodeURIComponent(course.key)}`);
          if (response.ok) {
            targetSection = findBookmarkedSection(course, await response.json());
          }
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

      const nextPath = `/courses/${getCoursePathSlug(course)}`;
      if (replace) {
        window.history.replaceState({ courseKey: course.key }, "", nextPath);
      } else {
        window.history.pushState({ courseKey: course.key }, "", nextPath);
      }
      setCurrentPath(nextPath);
      scrollCoursePageToTop();
    },
    [pushSectionPath]
  );

  const goToSectionIndex = (index: number) => {
    setCurrentSectionIndex(index);
    const section = sections[index];
    if (selectedCourse && section) {
      pushSectionPath(selectedCourse, section);
    }
  };

  const handleCompleteSection = (sectionId: string) => {
    setProgress((prev) => {
      const completed = new Set(prev.completedSectionIds);
      completed.add(sectionId);
      const updated = { ...prev, completedSectionIds: Array.from(completed) };
      localStorage.setItem(progressStorageKey, JSON.stringify(updated));
      fetch(`${API_BASE}/v1/local/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_key: selectedCourse?.key ?? "unknown",
          course_title: selectedCourse?.title ?? null,
          section_id: sectionId,
          completed_section_ids: updated.completedSectionIds,
        }),
      }).catch((err) => console.warn("Failed to mirror local completion:", err));
      return updated;
    });

    if (selectedCourse?.snapshotId && learnerId) {
      fetch(`${API_BASE}/v1/courses/${selectedCourse.snapshotId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learner_id: learnerId,
          section_id: sectionId,
          completion_state: "completed",
          mastery_score: 0.8,
          event_type: "section_completed",
          event_payload: { course_key: selectedCourse?.key ?? "unknown" },
        }),
      }).catch((err) => console.warn("Failed to post progress:", err));
    }
  };

  const handleGenerateCourse = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!prompt.trim()) return;
    setGenerateStatus("loading");
    setGenerateMessage("Generating course...");

    try {
      const response = await fetch(`${API_BASE}/v1/agent/courses/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          learner_id: learnerId ?? undefined,
          level: level || undefined,
          source_policy: "balanced",
          desired_module_count: 3,
          expected_duration_minutes: 180,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail ?? "Generation failed");
      }

      const course = await response.json();
      const entry: CourseEntry = {
        key: `remote-${course.id}`,
        title: course.title,
        data: course.structure,
        snapshotId: course.id,
        source: "remote",
      };
      setCourses((prev) => [entry, ...prev]);
      setPrompt("");
      setGenerateStatus("success");
      setGenerateMessage("Course generated.");
      openCourseByEntry(entry);
    } catch (err) {
      console.warn("Course generation failed:", err);
      setGenerateStatus("error");
      setGenerateMessage(err instanceof Error ? err.message : "Course generation failed. Is the API running?");
    }
  };

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

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
  }, [route.kind, route.courseSlug, route.unitSlug, resolveCourseKeyFromPath, courses, currentCourseKey, openCourseByEntry, pushSectionPath, rememberCourseSection]);

  useEffect(() => {
    const fetchRemoteCourses = async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/courses?limit=25`);
        if (!response.ok) throw new Error("Failed to fetch courses");
        const rows = (await response.json()) as RemoteCourseRow[];
        const remoteCourses: CourseEntry[] = rows.map((row) => {
          const snapshotId = Number(row.id);
          return {
            key: `remote-${row.id}`,
            title: row.title,
            data: row.structure,
            snapshotId,
            source: "remote",
          };
        });
        setCourses((prev) => [...remoteCourses, ...prev.filter((course) => course.source === "local")]);
      } catch (err) {
        console.warn("Remote courses unavailable:", err);
      }
    };

    const ensureLearner = async () => {
      const stored = localStorage.getItem("lyceum-learner-id");
      if (stored) {
        setLearnerId(Number(stored));
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/v1/learners`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Lycium Learner",
            goal: "Build a personalized course catalog",
            level: "beginner",
            preferences: { modalities: ["text", "video"], time_budget: "4h/week" },
          }),
        });
        if (!response.ok) throw new Error("Failed to create learner");
        const learner = await response.json();
        localStorage.setItem("lyceum-learner-id", String(learner.id));
        setLearnerId(Number(learner.id));
      } catch (err) {
        console.warn("Unable to create learner:", err);
      }
    };

    fetchRemoteCourses();
    ensureLearner();
  }, []);

  useLayoutEffect(() => {
    const measured = courseContentRef.current;
    if (!measured) return;
    const measureHeight = () => setCourseContentHeight(Math.ceil(measured.clientHeight));
    measureHeight();
    const observer = new ResizeObserver(measureHeight);
    observer.observe(measured);
    return () => observer.disconnect();
  }, [selectedCourse?.key, currentSectionIndex, currentPath]);

  useEffect(() => {
    let initialProgress = { completedSectionIds: [] as string[] };
    try {
      const loadedProgress = localStorage.getItem(progressStorageKey);
      initialProgress = loadedProgress ? JSON.parse(loadedProgress) : initialProgress;
    } catch {
      initialProgress = { completedSectionIds: [] };
    }
    setProgress(initialProgress);
    if (!selectedCourse?.key) return;

    fetch(`${API_BASE}/v1/local/completion/${encodeURIComponent(selectedCourse.key)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Local completion unavailable");
        return response.json();
      })
      .then((storedProgress) => {
        const storedSectionIds = Array.isArray(storedProgress.completed_section_ids) ? storedProgress.completed_section_ids : [];
        if (storedSectionIds.length === 0) return;
        const merged = {
          completedSectionIds: Array.from(new Set([...initialProgress.completedSectionIds, ...storedSectionIds])),
        };
        localStorage.setItem(progressStorageKey, JSON.stringify(merged));
        setProgress(merged);
      })
      .catch((err) => console.warn("Local completion unavailable:", err));
  }, [progressStorageKey, selectedCourse?.key]);

  return (
    <div className="app-root">
      <header className="top-bar">
        <a href="/settings" className="settings-link top-bar-icon-button" aria-label="Settings" onClick={routeToSettings}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.06-1.6a.5.5 0 0 0 .12-.64l-1.95-3.37a.5.5 0 0 0-.6-.22l-2.43.98a7.3 7.3 0 0 0-1.69-.98l-.37-2.58A.5.5 0 0 0 14.08 2h-3.9a.5.5 0 0 0-.5.42L9.32 5a7.43 7.43 0 0 0-1.69.98L5.2 5a.5.5 0 0 0-.6.22L2.65 8.59a.5.5 0 0 0 .12.64l2.06 1.6c-.04.32-.08.65-.08.98s.03.66.08.98l-2.06 1.6a.5.5 0 0 0-.12.64l1.95 3.37c.13.22.39.31.6.22l2.43-.98c.52.4 1.08.73 1.69.98l.37 2.58c.04.24.25.42.5.42h3.9c.25 0 .46-.18.5-.42l.37-2.58a7.43 7.43 0 0 0 1.69-.98l2.43.98c.22.08.48 0 .6-.22l1.95-3.37a.5.5 0 0 0-.12-.64l-2.07-1.6ZM12.13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
          </svg>
        </a>
        <span className="top-bar-title">
          Lycium
        </span>
        <a
          href="/"
          className="catalog-link top-bar-icon-button"
          aria-label="Course catalog"
          onClick={(event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); routeToHome(); }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M4.5 4h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5Zm10 0h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5Zm-10 10h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5Zm10 0h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5Z" />
          </svg>
        </a>
      </header>

      {viewRoute.kind === "home" ? (
        <CourseCatalog
          courses={courses}
          prompt={prompt}
          level={level}
          generateStatus={generateStatus}
          generateMessage={generateMessage}
          onPromptChange={setPrompt}
          onLevelChange={setLevel}
          onGenerateCourse={handleGenerateCourse}
          onOpenCourse={openCourseByEntry}
        />
      ) : (
        <div className="main-layout">
          <Sidebar
            sections={sections}
            currentSectionIndex={currentSectionIndex}
            onSectionSelect={goToSectionIndex}
            courseTitle={selectedCourse?.data?.title ?? "Course"}
            progressPercentage={courseProgressPercentage}
            contentHeight={courseContentHeight}
            completedSectionIds={progress.completedSectionIds}
            orderMandatory={Boolean(orderMandatory)}
          />
          <div className="course-content-host" ref={courseContentRef}>
            <ContentView
              courseTitle={selectedCourse?.data?.title ?? "Course"}
              section={currentSection}
              moduleTitle={currentSection?.moduleTitle ?? ""}
              moduleIndex={currentSection?.moduleIndex ?? 0}
              onNext={() => goToSectionIndex(Math.min(currentSectionIndex + 1, sections.length - 1))}
              onPrev={() => goToSectionIndex(Math.max(currentSectionIndex - 1, 0))}
              isFirstSection={currentSectionIndex === 0}
              isLastSection={currentSectionIndex === sections.length - 1}
              progressPercentage={moduleProgressPercentage}
              markComplete={handleCompleteSection}
              isComplete={currentSection ? completedSectionIds.has(currentSection.id) : false}
              orderMandatory={orderMandatory}
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
