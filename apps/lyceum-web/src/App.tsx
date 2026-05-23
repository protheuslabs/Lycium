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

type AgentModelRecord = {
  id: string;
  label?: string | null;
};

type AgentProviderRecord = {
  id: string;
  label: string;
  default_model?: string | null;
  model_fetch_supported?: boolean;
  generation_adapter?: string;
};

type AgentKeyRecord = {
  id: string;
  provider_id: string;
  provider_label: string;
  key_preview: string;
  model?: string | null;
  models?: AgentModelRecord[];
  models_fetched_at?: string | null;
  is_active: boolean;
};

type ThemeMode = "light" | "auto" | "dark";

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

function getBookmarkedModuleSection(course: CourseEntry): { moduleTitle: string; sectionTitle: string } | null {
  const bookmark = readStoredCourseBookmark(course);
  if (!bookmark) {
    return null;
  }

  for (const module of course.data.modules) {
    for (const section of module.sections) {
      if (section.id === bookmark.section_id || bookmark.path === getCourseSectionPath(course, section)) {
        return {
          moduleTitle: module.title,
          sectionTitle: section.title,
        };
      }
    }
  }

  return null;
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
  const [agentProviders, setAgentProviders] = useState<AgentProviderRecord[]>([]);
  const [agentProviderId, setAgentProviderId] = useState("openai");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentKeys, setAgentKeys] = useState<AgentKeyRecord[]>([]);
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<"idle" | "loading" | "invalid">("idle");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const storedTheme = localStorage.getItem("lyceum-theme-mode");
    return storedTheme === "light" || storedTheme === "dark" || storedTheme === "auto"
      ? storedTheme
      : "auto";
  });
  const [settingsStatus, setSettingsStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [settingsMessage, setSettingsMessage] = useState("");

  const route = useMemo(() => parseCourseRoute(currentPath), [currentPath]);
  const settingsReturnPath =
    route.kind === "settings" && typeof window.history.state?.settingsReturnTo === "string"
      ? window.history.state.settingsReturnTo
      : "/";
  const viewRoute = useMemo(
    () => (route.kind === "settings" ? parseCourseRoute(settingsReturnPath) : route),
    [route, settingsReturnPath]
  );

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
    if (viewRoute.kind !== "course") {
      return null;
    }
    const key = resolveCourseKeyFromPath(viewRoute.courseSlug);
    if (!key) {
      return null;
    }
    return courses.find((course) => course.key === key) ?? null;
  }, [viewRoute.kind, viewRoute.courseSlug, resolveCourseKeyFromPath, courses]);

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
    window.history.pushState(
      { settingsReturnTo: currentPath === "/settings" ? settingsReturnPath : currentPath },
      "",
      "/settings"
    );
    setCurrentPath("/settings");
  }, [currentPath, settingsReturnPath]);

  const closeSettingsModal = useCallback(() => {
    const returnTo =
      typeof window.history.state?.settingsReturnTo === "string"
        ? window.history.state.settingsReturnTo
        : "/";
    const targetPath = returnTo && returnTo !== "/settings" ? returnTo : "/";
    window.history.replaceState({}, "", targetPath);
    setCurrentPath(targetPath);
  }, []);

  const handleSettingsBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeSettingsModal();
    }
  };

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
    const trimmedKey = agentApiKey.trim();
    if (!agentProviderId) {
      setSettingsStatus("error");
      setSettingsMessage("Choose a provider before saving.");
      return;
    }
    if (!trimmedKey) {
      setSettingsStatus("error");
      setSettingsMessage("Enter an API key before saving.");
      return;
    }

    setApiKeySaveStatus("loading");
    setSettingsStatus("loading");
    setSettingsMessage("");

    try {
      const response = await fetch(`${API_BASE}/v1/local/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: agentProviderId, agent_api_key: trimmedKey }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail ?? "Settings save failed");
      }

      const settings = await response.json();
      setAgentApiKey("");
      setApiKeySaveStatus("idle");
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
      setSettingsMessage(
        activeKey
          ? `${activeKey.provider_label} verified with ${activeKey.models?.length ?? 0} models.`
          : "API key verified."
      );
    } catch (err) {
      console.warn("Unable to save settings:", err);
      setAgentApiKey("");
      setApiKeySaveStatus("invalid");
      setSettingsStatus("error");
      setSettingsMessage("");
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
      setSettingsMessage(activeKey ? `${activeKey.provider_label} is now active.` : "Active key updated.");
    } catch (err) {
      console.warn("Unable to activate key:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not switch keys. Is the API running?");
    }
  };

  const handleAgentModelChange = async (keyId: string, model: string) => {
    setSettingsStatus("loading");
    setSettingsMessage("Updating model...");

    try {
      const response = await fetch(`${API_BASE}/v1/local/settings/key-model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId, model }),
      });

      if (!response.ok) {
        throw new Error("Model update failed");
      }

      const settings = await response.json();
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage(`Model set to ${model}.`);
    } catch (err) {
      console.warn("Unable to update model:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not update that model.");
    }
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem("lyceum-theme-mode", mode);
  };

  const handleGenerateCourse = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!prompt.trim()) {
      return;
    }

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
    return () => {
      window.removeEventListener("popstate", syncPath);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "auto") {
      root.removeAttribute("data-theme");
      root.style.colorScheme = "light dark";
      return;
    }

    root.setAttribute("data-theme", themeMode);
    root.style.colorScheme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (route.kind !== "settings") {
      return;
    }

    let ignored = false;
    setSettingsStatus("loading");
    setSettingsMessage("Loading settings...");

    Promise.all([
      fetch(`${API_BASE}/v1/local/ai/providers`).then((response) => {
        if (!response.ok) {
          throw new Error("AI providers unavailable");
        }
        return response.json();
      }),
      fetch(`${API_BASE}/v1/local/settings`).then((response) => {
        if (!response.ok) {
          throw new Error("Settings unavailable");
        }
        return response.json();
      }),
    ])
      .then(([providers, settings]) => {
        if (ignored) {
          return;
        }
        setSettingsStatus("idle");
        setAgentProviders(providers ?? []);
        setAgentProviderId((currentProviderId) => currentProviderId || providers?.[0]?.id || "openai");
        setAgentKeys(settings.agent_keys ?? []);
        const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
        setSettingsMessage(
          activeKey
            ? `${activeKey.provider_label} is active with ${activeKey.model ?? "no model selected"}.`
            : "No agent API key saved yet."
        );
      })
      .catch((err) => {
        if (ignored) {
          return;
        }
        console.warn("Unable to load settings:", err);
        setSettingsStatus("error");
        setSettingsMessage("");
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

  const isSavingAgentKey = apiKeySaveStatus === "loading";
  const canAddAgentKey = Boolean(agentProviderId && agentApiKey.trim()) && !isSavingAgentKey;

  return (
    <div className="app-root">
      <header className="top-bar">
        <a href="/settings" className="settings-link" aria-label="Settings" onClick={routeToSettings}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.06-1.6a.5.5 0 0 0 .12-.64l-1.95-3.37a.5.5 0 0 0-.6-.22l-2.43.98a7.3 7.3 0 0 0-1.69-.98l-.37-2.58A.5.5 0 0 0 14.08 2h-3.9a.5.5 0 0 0-.5.42L9.32 5a7.43 7.43 0 0 0-1.69.98L5.2 5a.5.5 0 0 0-.6.22L2.65 8.59a.5.5 0 0 0 .12.64l2.06 1.6c-.04.32-.08.65-.08.98s.03.66.08.98l-2.06 1.6a.5.5 0 0 0-.12.64l1.95 3.37c.13.22.39.31.6.22l2.43-.98c.52.4 1.08.73 1.69.98l.37 2.58c.04.24.25.42.5.42h3.9c.25 0 .46-.18.5-.42l.37-2.58a7.43 7.43 0 0 0 1.69-.98l2.43.98c.22.08.48 0 .6-.22l1.95-3.37a.5.5 0 0 0-.12-.64l-2.07-1.6ZM12.13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
          </svg>
        </a>
        <a href="/" className="top-bar-title" onClick={openHomeFromHero}>
          Lycium
        </a>
      </header>

      {viewRoute.kind === "home" ? (
        <>
          <main className="home-page">
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
              <option value="elementary">Elementary</option>
              <option value="highschool">High school</option>
              <option value="undergrad">Undergrad</option>
              <option value="postgrad">Post-grad</option>
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
                const courseProgress = getCourseProgress(course);
                const bookmarkedSection = getBookmarkedModuleSection(course);
                const hasActiveCoursePage = Boolean(bookmarkedSection);
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
                    {bookmarkedSection && (
                      <p className="course-active-subheader">
                        <span>{bookmarkedSection.moduleTitle}</span>
                        <span>{bookmarkedSection.sectionTitle}</span>
                      </p>
                    )}
                    {!hasActiveCoursePage ? (
                      <p className="course-progress-percentage course-progress-empty">
                        Course not started
                      </p>
                    ) : (
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
                    )}
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

      {route.kind === "settings" && (
        <div className="settings-modal-backdrop" role="presentation" onMouseDown={handleSettingsBackdropClick}>
          <section
            className="settings-card settings-card-modal"
            aria-labelledby="settings-title"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="settings-close-button" type="button" aria-label="Close settings" onClick={closeSettingsModal}>
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.3 4.3-4.3a1 1 0 1 1 1.4 1.4L13.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
              </svg>
            </button>
            <h1 id="settings-title">Settings</h1>
            <section className="settings-section" aria-labelledby="settings-active-ai">
              <h2 id="settings-active-ai">Active AI</h2>
              <div className="settings-ai-data-panel">
                {agentKeys.length > 0 && (
                  <section className="settings-key-list" aria-label="Saved API keys">
                    <div className="settings-key-stack">
                      {agentKeys.map((key) => (
                        <div
                          key={key.id}
                          className={`settings-key-row${key.is_active ? " settings-key-row-active" : ""}`}
                          role="button"
                          tabIndex={isSavingAgentKey ? -1 : 0}
                          onClick={() => handleActivateAgentKey(key.id)}
                          onKeyDown={(event) => {
                            if (isSavingAgentKey) {
                              return;
                            }
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleActivateAgentKey(key.id);
                            }
                          }}
                          aria-disabled={isSavingAgentKey}
                        >
                          <span className="settings-key-provider">{key.provider_label}</span>
                          <span className="settings-key-preview">{key.key_preview}</span>
                          <label className="settings-model-field" onClick={(event) => event.stopPropagation()}>
                            <select
                              className="settings-model-select"
                              value={key.model ?? ""}
                              onChange={(event) => handleAgentModelChange(key.id, event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              disabled={isSavingAgentKey || !key.models?.length}
                              aria-label={`Model for ${key.provider_label}`}
                            >
                              {(key.models ?? []).map((model) => (
                                <option key={model.id} value={model.id}>
                                  {model.label || model.id}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span className="settings-key-state">{key.is_active ? "Active" : "Use"}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <form className="settings-form" onSubmit={handleSettingsSubmit}>
                  <div className="settings-entry-row">
                    <label className="settings-entry-field" htmlFor="agent-provider">
                      <select
                        id="agent-provider"
                        className="settings-select"
                        value={agentProviderId}
                        onChange={(event) => setAgentProviderId(event.target.value)}
                        disabled={isSavingAgentKey}
                      >
                        {agentProviders.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="settings-entry-field settings-entry-field-key" htmlFor="agent-api-key">
                      <input
                        id="agent-api-key"
                        className={`settings-input${apiKeySaveStatus === "invalid" ? " settings-input--invalid" : ""}`}
                        type="password"
                        value={agentApiKey}
                        onChange={(event) => {
                          setAgentApiKey(event.target.value);
                          if (apiKeySaveStatus === "invalid") {
                            setApiKeySaveStatus("idle");
                          }
                        }}
                        placeholder={apiKeySaveStatus === "invalid" ? "API key invalid" : "api key"}
                        autoComplete="off"
                        disabled={isSavingAgentKey}
                      />
                    </label>
                    <button
                      className={`settings-save-button${isSavingAgentKey ? " settings-save-button-loading" : ""}`}
                      type="submit"
                      disabled={!canAddAgentKey}
                      aria-label="Add API key"
                    >
                      {isSavingAgentKey ? (
                        <span className="settings-save-spinner" aria-hidden="true" />
                      ) : (
                        <svg className="settings-save-plus" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                          <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
            <section className="settings-section" aria-labelledby="settings-display">
              <h2 id="settings-display">Display</h2>
              <div className="theme-toggle" data-mode={themeMode} role="radiogroup" aria-label="Color mode">
                <button
                  className="theme-toggle-option"
                  type="button"
                  role="radio"
                  aria-checked={themeMode === "light"}
                  aria-label="Light mode"
                  onClick={() => handleThemeModeChange("light")}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M12 4.4a.8.8 0 0 0 .8-.8V2a.8.8 0 0 0-1.6 0v1.6a.8.8 0 0 0 .8.8Zm0 15.2a.8.8 0 0 0-.8.8V22a.8.8 0 0 0 1.6 0v-1.6a.8.8 0 0 0-.8-.8ZM4.93 6.06a.8.8 0 0 0 1.13-1.13L4.93 3.8A.8.8 0 1 0 3.8 4.93l1.13 1.13Zm14.14 11.88a.8.8 0 0 0-1.13 1.13l1.13 1.13a.8.8 0 0 0 1.13-1.13l-1.13-1.13ZM3.6 11.2H2a.8.8 0 0 0 0 1.6h1.6a.8.8 0 0 0 0-1.6Zm18.4 0h-1.6a.8.8 0 0 0 0 1.6H22a.8.8 0 0 0 0-1.6ZM4.93 20.2l1.13-1.13a.8.8 0 0 0-1.13-1.13L3.8 19.07a.8.8 0 1 0 1.13 1.13ZM18.5 6.3c.2 0 .41-.08.57-.24l1.13-1.13a.8.8 0 0 0-1.13-1.13l-1.13 1.13A.8.8 0 0 0 18.5 6.3ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
                  </svg>
                </button>
                <button
                  className="theme-toggle-option"
                  type="button"
                  role="radio"
                  aria-checked={themeMode === "auto"}
                  aria-label="Auto color mode"
                  onClick={() => handleThemeModeChange("auto")}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5v8A2.5 2.5 0 0 1 17.5 15h-3.1l.45 2H17a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h2.15l.45-2H6.5A2.5 2.5 0 0 1 4 12.5v-8Zm2.5-.8a.8.8 0 0 0-.8.8v8c0 .44.36.8.8.8h11c.44 0 .8-.36.8-.8v-8a.8.8 0 0 0-.8-.8h-11Z" />
                  </svg>
                </button>
                <button
                  className="theme-toggle-option"
                  type="button"
                  role="radio"
                  aria-checked={themeMode === "dark"}
                  aria-label="Dark mode"
                  onClick={() => handleThemeModeChange("dark")}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M20.2 14.5a.8.8 0 0 0-.86-.18 7.35 7.35 0 0 1-9.65-9.65.8.8 0 0 0-1.03-1.03A8.96 8.96 0 1 0 20.36 15.67a.8.8 0 0 0-.16-1.17Z" />
                  </svg>
                </button>
              </div>
            </section>
            {settingsMessage && (
              <p className={`settings-status settings-status-${settingsStatus}`}>
                {settingsMessage}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
