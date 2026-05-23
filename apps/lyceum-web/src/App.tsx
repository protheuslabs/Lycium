import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useLayoutEffect,
  useRef,
} from "react";
import type { FormEvent, MouseEvent } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar/Sidebar";
import ContentView from "./components/ContentView/ContentView";
import CatalogFooter from "./components/CatalogFooter/CatalogFooter";
import aiCourse from "./courseData/introToAiCourse.json";
import webDevCourse from "./courseData/webDevCourse.json";
import pythonCourse from "./courseData/introToPythonCourse.json";
import mlsysCourse from "./courseData/machineLearningSystemsCourse.json";
import softwareArchitectureCourse from "./courseData/softwareArchitectureCourse.json";
import sourceRecordsData from "./courseData/sourceRecords.json";

const API_BASE = import.meta.env.VITE_PROTHEUS_API_URL ?? "http://127.0.0.1:8000";

type CourseBlock = {
  type: string;
  value?: string;
  url?: string;
  sourceIds?: string[];
  question?: string;
  questions?: Array<{
    question?: string;
    options?: string[];
    answer?: number;
    answers?: number[];
    timed?: "t" | "f" | boolean;
  }>;
  questionBank?: unknown;
  question_bank?: unknown;
  questionsPerAttempt?: number | string;
  questions_per_attempt?: number | string;
  questionCount?: number | string;
  question_count?: number | string;
  options?: string[];
  answer?: number;
  answers?: number[];
  name?: string;
  description?: string;
  timed?: "t" | "f" | boolean;
  maxAttempts?: number | string;
  max_attempts?: number | string;
  attemptLimit?: number | string;
  attempt_limit?: number | string;
  timeLimit?: number | string;
  time_limit?: number | string;
  timeLimitSeconds?: number | string;
  time_limit_seconds?: number | string;
  passPercentage?: number | string;
  pass_percentage?: number | string;
  passPercent?: number | string;
  pass_percent?: number | string;
  showAnswers?: boolean | string;
  show_answers?: boolean | string;
  showCorrectAnswers?: boolean | string;
  show_correct_answers?: boolean | string;
};

type CourseSection = {
  id: string;
  title: string;
  content: CourseBlock[];
  sourceIds?: string[];
};

type CourseModule = {
  id: string;
  title: string;
  sections: CourseSection[];
  sourceIds?: string[];
};

type CourseData = {
  title: string;
  orderMandatory?: boolean;
  sourceIds?: string[];
  modules: CourseModule[];
};

type CourseEntry = {
  key: string;
  title: string;
  data: CourseData;
  snapshotId?: number;
  source: "local" | "remote";
};

type AgentKeyRecord = {
  id: string;
  nickname: string;
  key_preview: string;
  is_active: boolean;
};

type CourseBookmarkRecord = {
  course_key?: string;
  course_title?: string | null;
  section_id?: string | null;
  section_title?: string | null;
  path?: string | null;
};

type RouteInfo = {
  kind: "home" | "course" | "settings";
  courseSlug: string | null;
  unitSlug: string | null;
};

function slugifyCourseTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCoursePathSlug(course: CourseEntry): string {
  const base = slugifyCourseTitle(course.title || "course");
  return `${base}-${course.key}`;
}

function getSectionPathSlug(section: CourseSection): string {
  const base = slugifyCourseTitle(section.title || "unit");
  const suffix = slugifyCourseTitle(section.id || "section");

  if (!base) {
    return suffix || "unit";
  }

  if (!suffix || base.endsWith(suffix)) {
    return base;
  }

  return `${base}-${suffix}`;
}

function getCourseSectionPath(course: CourseEntry, section: CourseSection): string {
  return `/courses/${getCoursePathSlug(course)}/units/${getSectionPathSlug(section)}`;
}

function getFirstCourseSection(course: CourseEntry): CourseSection | null {
  return course.data.modules[0]?.sections[0] ?? null;
}

function getFlatCourseSections(course: CourseEntry): CourseSection[] {
  return course.data.modules.flatMap((module) => module.sections);
}

function getCourseBookmarkStorageKey(course: CourseEntry): string {
  return `lyceum-bookmark-${course.key}`;
}

function readStoredCourseBookmark(course: CourseEntry): CourseBookmarkRecord | null {
  try {
    const saved = localStorage.getItem(getCourseBookmarkStorageKey(course));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function writeStoredCourseBookmark(course: CourseEntry, section: CourseSection, path: string): void {
  const bookmark: CourseBookmarkRecord = {
    course_key: course.key,
    course_title: course.title,
    section_id: section.id,
    section_title: section.title,
    path,
  };
  localStorage.setItem(getCourseBookmarkStorageKey(course), JSON.stringify(bookmark));
}

function findBookmarkedSection(course: CourseEntry, bookmark: CourseBookmarkRecord | null): CourseSection | null {
  if (!bookmark) {
    return null;
  }

  const courseSections = getFlatCourseSections(course);
  return (
    courseSections.find((section) => section.id === bookmark.section_id) ??
    courseSections.find((section) => bookmark.path === getCourseSectionPath(course, section)) ??
    null
  );
}

function getCourseSectionIndex(course: CourseEntry, section: CourseSection): number {
  return getFlatCourseSections(course).findIndex((candidate) => candidate.id === section.id);
}

function getCourseSectionIds(course: CourseEntry): string[] {
  return getFlatCourseSections(course).map((section) => section.id);
}

function getCourseProgress(course: CourseEntry): { completed: number; total: number; percentage: number } {
  const courseStorageKey = `lyceum-progress-${course.key}`;
  const sections = getCourseSectionIds(course);
  const sectionCount = sections.length;

  if (sectionCount === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  try {
    const saved = localStorage.getItem(courseStorageKey);
    const parsed = saved ? JSON.parse(saved) : { completedSectionIds: [] };
    const completedSectionIds = Array.isArray(parsed?.completedSectionIds)
      ? parsed.completedSectionIds
      : [];

    const completedSet = new Set(completedSectionIds);
    const completed = sections.filter((sectionId) => completedSet.has(sectionId)).length;
    const percentage = (completed / sectionCount) * 100;

    return {
      completed,
      total: sectionCount,
      percentage,
    };
  } catch {
    return { completed: 0, total: sectionCount, percentage: 0 };
  }
}

function parseCourseRoute(pathname: string): RouteInfo {
  const pathWithoutQuery = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  if (pathWithoutQuery === "/" || pathWithoutQuery === "/courses") {
    return { kind: "home", courseSlug: null, unitSlug: null };
  }

  if (pathWithoutQuery === "/settings") {
    return { kind: "settings", courseSlug: null, unitSlug: null };
  }

  if (pathWithoutQuery.startsWith("/courses/")) {
    const segments = pathWithoutQuery.split("/").filter(Boolean);
    const courseSlug = decodeURIComponent(segments[1] ?? "").toLowerCase();
    const unitSlug =
      segments[2] === "units" && segments[3]
        ? decodeURIComponent(segments[3]).toLowerCase()
        : null;

    if (!courseSlug) {
      return { kind: "home", courseSlug: null, unitSlug: null };
    }

    return { kind: "course", courseSlug, unitSlug };
  }

  return { kind: "home", courseSlug: null, unitSlug: null };
}

function App() {
  const localCourses: CourseEntry[] = useMemo(
    () => [
      {
        key: "local-ai",
        title: aiCourse.title,
        data: aiCourse as CourseData,
        source: "local",
      },
      {
        key: "local-web",
        title: webDevCourse.title,
        data: webDevCourse as CourseData,
        source: "local",
      },
      {
        key: "local-python",
        title: pythonCourse.title,
        data: pythonCourse as CourseData,
        source: "local",
      },
      {
        key: "local-mlsys",
        title: mlsysCourse.title,
        data: mlsysCourse as CourseData,
        source: "local",
      },
      {
        key: "local-software-architecture",
        title: softwareArchitectureCourse.title,
        data: softwareArchitectureCourse as CourseData,
        source: "local",
      },
    ],
    []
  );

  const [courses, setCourses] = useState<CourseEntry[]>(localCourses);
  const [currentCourseKey, setCurrentCourseKey] = useState(localCourses[0]?.key ?? "");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [level, setLevel] = useState("");
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [generateMessage, setGenerateMessage] = useState("");
  const [learnerId, setLearnerId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const courseContentRef = useRef<HTMLDivElement | null>(null);
  const [courseContentHeight, setCourseContentHeight] = useState<number | null>(null);
  const [agentKeyNickname, setAgentKeyNickname] = useState("");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentKeys, setAgentKeys] = useState<AgentKeyRecord[]>([]);
  const [settingsStatus, setSettingsStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [settingsMessage, setSettingsMessage] = useState("");

  const route = useMemo(() => parseCourseRoute(currentPath), [currentPath]);

  const coursesByPathSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of courses) {
      map.set(getCoursePathSlug(course), course.key);
    }
    return map;
  }, [courses]);

  const resolveCourseKeyFromPath = useCallback(
    (courseSlug: string | null): string | null => {
      if (!courseSlug) {
        return null;
      }
      return coursesByPathSlug.get(courseSlug) ?? null;
    },
    [coursesByPathSlug]
  );

  const selectedCourseFromPath = useMemo(() => {
    if (route.kind !== "course") {
      return null;
    }
    const key = resolveCourseKeyFromPath(route.courseSlug);
    if (!key) {
      return null;
    }
    return courses.find((course) => course.key === key) ?? null;
  }, [route.kind, route.courseSlug, resolveCourseKeyFromPath, courses]);

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
  const moduleIndex = currentSection?.moduleIndex ?? 0;
  const moduleTitle = currentSection?.moduleTitle ?? "";
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === sections.length - 1;
  const progressStorageKey = `lyceum-progress-${selectedCourse?.key}`;
  const [progress, setProgress] = useState<{ completedSectionIds: string[] }>({ completedSectionIds: [] });
  const completedSectionIds = new Set(progress.completedSectionIds);
  const completedSectionCount = sections.filter((section) => completedSectionIds.has(section.id)).length;
  const courseProgressPercentage = sections.length > 0 ? (completedSectionCount / sections.length) * 100 : 0;
  const currentModuleIndex = currentSection?.moduleIndex ?? 0;
  const moduleSections = sections.filter((section) => section.moduleIndex === currentModuleIndex);
  const completedModuleSectionCount = moduleSections.filter((section) => completedSectionIds.has(section.id)).length;
  const moduleProgressPercentage = moduleSections.length > 0 ? (completedModuleSectionCount / moduleSections.length) * 100 : 0;
  const isCompleted = currentSection ? completedSectionIds.has(currentSection.id) : false;
  const orderMandatory = selectedCourse?.data?.orderMandatory ?? false;

  const routeToHome = useCallback(() => {
    if (window.location.pathname === "/") {
      setCurrentPath("/");
      return;
    }
    window.history.pushState({}, "", "/");
    setCurrentPath("/");
  }, []);

  const routeToSettings = useCallback((event?: MouseEvent<HTMLAnchorElement>) => {
    event?.preventDefault();
    if (window.location.pathname === "/settings") {
      setCurrentPath("/settings");
      return;
    }
    window.history.pushState({}, "", "/settings");
    setCurrentPath("/settings");
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

  const pushSectionPath = useCallback((course: CourseEntry, section: CourseSection, replace = false) => {
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
  }, [rememberCourseSection]);

  const openCourseByEntry = useCallback(
    async (course: CourseEntry, replace = false) => {
      setCurrentCourseKey(course.key);
      const locallyBookmarkedSection = findBookmarkedSection(course, readStoredCourseBookmark(course));
      let targetSection = locallyBookmarkedSection;

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

      const firstSection = getFirstCourseSection(course);
      const sectionToOpen = targetSection ?? firstSection;

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
    },
    [pushSectionPath]
  );

  const handleSectionSelect = (index: number) => {
    setCurrentSectionIndex(index);
    const section = sections[index];
    if (selectedCourse && section) {
      pushSectionPath(selectedCourse, section);
    }
  };

  const handleNextSection = () => {
    const nextIndex = Math.min(currentSectionIndex + 1, sections.length - 1);
    setCurrentSectionIndex(nextIndex);
    const section = sections[nextIndex];
    if (selectedCourse && section) {
      pushSectionPath(selectedCourse, section);
    }
  };

  const handlePrevSection = () => {
    const nextIndex = Math.max(currentSectionIndex - 1, 0);
    setCurrentSectionIndex(nextIndex);
    const section = sections[nextIndex];
    if (selectedCourse && section) {
      pushSectionPath(selectedCourse, section);
    }
  };

  const openHomeFromHero = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    routeToHome();
  };

  const handleCompleteSection = (sectionId: string) => {
    setProgress((prev) => {
      const set = new Set(prev.completedSectionIds);
      set.add(sectionId);

      const updated = { ...prev, completedSectionIds: Array.from(set) };
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

  const handleSettingsSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const trimmedNickname = agentKeyNickname.trim();
    const trimmedKey = agentApiKey.trim();
    if (!trimmedNickname) {
      setSettingsStatus("error");
      setSettingsMessage("Give this key a nickname before saving.");
      return;
    }
    if (!trimmedKey) {
      setSettingsStatus("error");
      setSettingsMessage("Enter an API key before saving.");
      return;
    }

    setSettingsStatus("loading");
    setSettingsMessage("Saving settings...");

    try {
      const response = await fetch(`${API_BASE}/v1/local/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmedNickname, agent_api_key: trimmedKey }),
      });

      if (!response.ok) {
        throw new Error("Settings save failed");
      }

      const settings = await response.json();
      setAgentKeyNickname("");
      setAgentApiKey("");
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage(`Agent API key saved locally in ${settings.local_data_dir}.`);
    } catch (err) {
      console.warn("Unable to save settings:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not save settings. Is the API running?");
    }
  };

  const handleActivateAgentKey = async (keyId: string) => {
    setSettingsStatus("loading");
    setSettingsMessage("Switching active key...");

    try {
      const response = await fetch(`${API_BASE}/v1/local/settings/active-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });

      if (!response.ok) {
        throw new Error("Active key update failed");
      }

      const settings = await response.json();
      setAgentKeys(settings.agent_keys ?? []);
      const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
      setSettingsStatus("success");
      setSettingsMessage(activeKey ? `${activeKey.nickname} is now active.` : "Active key updated.");
    } catch (err) {
      console.warn("Unable to activate key:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not switch keys. Is the API running?");
    }
  };

  const handleGenerateCourse = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!prompt.trim()) {
      return;
    }

    setGenerateStatus("loading");
    setGenerateMessage("Generating course...");

    try {
      const response = await fetch(`${API_BASE}/v1/courses/generate`, {
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
        throw new Error("Generation failed");
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
      setGenerateMessage("Course generation failed. Is the API running?");
    }
  };

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => {
      window.removeEventListener("popstate", syncPath);
    };
  }, []);

  useEffect(() => {
    if (route.kind !== "settings") {
      return;
    }

    let ignored = false;
    setSettingsStatus("loading");
    setSettingsMessage("Loading settings...");

    fetch(`${API_BASE}/v1/local/settings`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Settings unavailable");
        }
        return response.json();
      })
      .then((settings) => {
        if (ignored) {
          return;
        }
        setSettingsStatus("idle");
        setAgentKeys(settings.agent_keys ?? []);
        setSettingsMessage(
          settings.has_agent_api_key
            ? `Agent API key is saved locally as ${settings.agent_api_key_preview}.`
            : "No agent API key saved yet."
        );
      })
      .catch((err) => {
        if (ignored) {
          return;
        }
        console.warn("Unable to load settings:", err);
        setSettingsStatus("error");
        setSettingsMessage("Settings are available once the API is running.");
      });

    return () => {
      ignored = true;
    };
  }, [route.kind]);

  useEffect(() => {
    if (route.kind !== "course" || !route.courseSlug) {
      return;
    }

    const resolvedKey = resolveCourseKeyFromPath(route.courseSlug);
    const routeCourse = resolvedKey
      ? courses.find((course) => course.key === resolvedKey) ?? null
      : null;

    if (!routeCourse) {
      return;
    }

    if (routeCourse.key !== currentCourseKey) {
      setCurrentCourseKey(routeCourse.key);
    }

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

    const sectionIndex = routeSections.findIndex(
      (section) => getSectionPathSlug(section) === route.unitSlug
    );

    if (sectionIndex >= 0) {
      const routeSection = routeSections[sectionIndex];
      setCurrentSectionIndex(sectionIndex);
      if (routeSection) {
        rememberCourseSection(routeCourse, routeSection, getCourseSectionPath(routeCourse, routeSection));
      }
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
    const fetchRemoteCourses = async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/courses?limit=25`);
        if (!response.ok) {
          throw new Error("Failed to fetch courses");
        }

        const rows = await response.json();
        const remoteCourses: CourseEntry[] = rows.map((row: any) => ({
          key: `remote-${row.id}`,
          title: row.title,
          data: row.structure,
          snapshotId: row.id,
          source: "remote",
        }));

        setCourses((prev) => {
          const locals = prev.filter((course) => course.source === "local");
          return [...remoteCourses, ...locals];
        });
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

        if (!response.ok) {
          throw new Error("Failed to create learner");
        }

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
    if (!measured) {
      return;
    }

    const measureHeight = () => {
      setCourseContentHeight(Math.ceil(measured.clientHeight));
    };

    measureHeight();

    const observer = new ResizeObserver(measureHeight);
    observer.observe(measured);

    return () => {
      observer.disconnect();
    };
  }, [selectedCourse?.key, currentSectionIndex, currentPath]);

  useEffect(() => {
    const loadedProgress = localStorage.getItem(progressStorageKey);
    const initialProgress: { completedSectionIds: string[] } = loadedProgress
      ? JSON.parse(loadedProgress)
      : { completedSectionIds: [] };
    setProgress(initialProgress);
    if (!selectedCourse?.key) {
      return;
    }

    fetch(`${API_BASE}/v1/local/completion/${encodeURIComponent(selectedCourse.key)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Local completion unavailable");
        }
        return response.json();
      })
      .then((storedProgress) => {
        const storedSectionIds = Array.isArray(storedProgress.completed_section_ids)
          ? storedProgress.completed_section_ids
          : [];
        if (storedSectionIds.length === 0) {
          return;
        }
        const merged = {
          completedSectionIds: Array.from(
            new Set([...initialProgress.completedSectionIds, ...storedSectionIds])
          ),
        };
        localStorage.setItem(progressStorageKey, JSON.stringify(merged));
        setProgress(merged);
      })
      .catch((err) => console.warn("Local completion unavailable:", err));
  }, [progressStorageKey, selectedCourse?.key]);

  return (
    <div className="app-root">
      <header className="top-bar">
        <a href="/settings" className="settings-link" aria-label="Settings" onClick={routeToSettings}>
          ⚙
        </a>
        <a href="/" className="top-bar-title" onClick={openHomeFromHero}>
          Lycium
        </a>
      </header>

      {route.kind === "settings" ? (
        <main className="settings-page">
          <section className="settings-card" aria-labelledby="settings-title">
            <h1 id="settings-title">Settings</h1>
            <form className="settings-form" onSubmit={handleSettingsSubmit}>
              <div className="settings-entry-row">
                <label className="settings-entry-field" htmlFor="agent-api-nickname">
                  <input
                    id="agent-api-nickname"
                    className="settings-input"
                    type="text"
                    value={agentKeyNickname}
                    onChange={(event) => setAgentKeyNickname(event.target.value)}
                    placeholder="name"
                    autoComplete="off"
                  />
                </label>
                <label className="settings-entry-field settings-entry-field-key" htmlFor="agent-api-key">
                  <input
                    id="agent-api-key"
                    className="settings-input"
                    type="password"
                    value={agentApiKey}
                    onChange={(event) => setAgentApiKey(event.target.value)}
                    placeholder="api key"
                    autoComplete="off"
                  />
                </label>
                <button className="settings-save-button" type="submit" disabled={settingsStatus === "loading"} aria-label="Add API key">
                  +
                </button>
              </div>
            </form>
            {agentKeys.length > 0 && (
              <section className="settings-key-list" aria-label="Saved API keys">
                <h2>Saved keys</h2>
                <div className="settings-key-stack">
                  {agentKeys.map((key) => (
                    <button
                      key={key.id}
                      className={`settings-key-row${key.is_active ? " settings-key-row-active" : ""}`}
                      type="button"
                      onClick={() => handleActivateAgentKey(key.id)}
                    >
                      <span className="settings-key-name">{key.nickname}</span>
                      <span className="settings-key-preview">{key.key_preview}</span>
                      <span className="settings-key-state">{key.is_active ? "Active" : "Use"}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {settingsMessage && (
              <p className={`settings-status settings-status-${settingsStatus}`}>
                {settingsMessage}
              </p>
            )}
          </section>
        </main>
      ) : route.kind === "home" ? (
        <>
          <main className="home-page">
            <section className="hero">
              <p>Generate a new course or open one below to begin learning.</p>
            </section>

          <section className="generator-bar">
            <form className="generator-form" onSubmit={handleGenerateCourse}>
              <input
                className="generator-input"
                placeholder="Describe a course to generate (e.g. Beginner Python for data analysis)"
                value={prompt}
                onChange={(evt) => setPrompt(evt.target.value)}
              />
              <select className="generator-select" value={level} onChange={(evt) => setLevel(evt.target.value)}>
                <option value="">Any level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button className="generator-button" type="submit" disabled={!prompt.trim() || generateStatus === "loading"}>
                {generateStatus === "loading" ? "Generating..." : "Generate"}
              </button>
              {generateMessage && <span className={`generator-status generator-status-${generateStatus}`}>{generateMessage}</span>}
            </form>
          </section>

          <section className="catalog-page">
            <h2>Available Courses</h2>
            <div className="course-grid">
              {courses.map((course) => {
                const slug = getCoursePathSlug(course);
                const courseProgress = getCourseProgress(course);
                const firstSection = getFirstCourseSection(course);
                const cardPath = firstSection
                  ? getCourseSectionPath(course, firstSection)
                  : `/courses/${slug}`;
                return (
                  <article
                    key={course.key}
                    className="course-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => openCourseByEntry(course)}
                    onKeyDown={(evt) => {
                      if (evt.key === "Enter" || evt.key === " ") {
                        evt.preventDefault();
                        openCourseByEntry(course);
                      }
                    }}
                  >
                    <h3>{course.title}</h3>
                    <div className="course-progress">
                      <div className="course-progress-bar">
                        <div
                          className="course-progress-fill"
                          style={{ width: `${courseProgress.percentage}%` }}
                        />
                      </div>
                      <p className="course-progress-percentage">
                        {Math.round(courseProgress.percentage)}% complete
                      </p>
                    </div>
                    <p className="course-source">{course.source === "remote" ? "Generated" : "Local"} course</p>
                    <small className="course-slug">{cardPath}</small>
                  </article>
                );
              })}
            </div>
          </section>

          </main>

          <CatalogFooter />
        </>
      ) : (
        <div className="main-layout">
          <Sidebar
            sections={sections}
            currentSectionIndex={currentSectionIndex}
            onSectionSelect={handleSectionSelect}
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
              moduleTitle={moduleTitle}
              moduleIndex={moduleIndex}
              onNext={handleNextSection}
              onPrev={handlePrevSection}
              isFirstSection={isFirstSection}
              isLastSection={isLastSection}
              progressPercentage={moduleProgressPercentage}
              markComplete={handleCompleteSection}
              isComplete={isCompleted}
              orderMandatory={orderMandatory}
              sources={sourceRecordsData.sources}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
