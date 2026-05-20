import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import "./App.css";
import Sidebar from "./components/Sidebar/Sidebar";
import ContentView from "./components/ContentView/ContentView";
import aiCourse from "./courseData/introToAiCourse.json";
import webDevCourse from "./courseData/webDevCourse.json";
import pythonCourse from "./courseData/introToPythonCourse.json";

const API_BASE = import.meta.env.VITE_PROTHEUS_API_URL ?? "http://127.0.0.1:8000";

type CourseBlock = {
  type: string;
  value?: string;
  url?: string;
  question?: string;
  options?: string[];
  answer?: number;
  name?: string;
  description?: string;
};

type CourseSection = {
  id: string;
  title: string;
  content: CourseBlock[];
};

type CourseModule = {
  id: string;
  title: string;
  sections: CourseSection[];
};

type CourseData = {
  title: string;
  orderMandatory?: boolean;
  modules: CourseModule[];
};

type CourseEntry = {
  key: string;
  title: string;
  data: CourseData;
  snapshotId?: number;
  source: "local" | "remote";
};

type RouteInfo = {
  kind: "home" | "course";
  slug: string | null;
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

function getCourseSectionIds(course: CourseEntry): string[] {
  return course.data.modules.flatMap((module) =>
    module.sections.map((section) => section.id)
  );
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
    return { kind: "home", slug: null };
  }

  if (pathWithoutQuery.startsWith("/courses/")) {
    const slug = decodeURIComponent(pathWithoutQuery.slice("/courses/".length)).toLowerCase();
    if (!slug) {
      return { kind: "home", slug: null };
    }
    return { kind: "course", slug };
  }

  return { kind: "home", slug: null };
}

function App() {
  const localCourses: CourseEntry[] = useMemo(
    () => [
      {
        key: "local-ai",
        title: aiCourse.title,
        data: aiCourse,
        source: "local",
      },
      {
        key: "local-web",
        title: webDevCourse.title,
        data: webDevCourse,
        source: "local",
      },
      {
        key: "local-python",
        title: pythonCourse.title,
        data: pythonCourse,
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

  const route = useMemo(() => parseCourseRoute(currentPath), [currentPath]);

  const coursesByPathSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of courses) {
      map.set(getCoursePathSlug(course), course.key);
    }
    return map;
  }, [courses]);

  const resolveCourseKeyFromPath = useCallback(
    (slug: string | null): string | null => {
      if (!slug) {
        return null;
      }
      return coursesByPathSlug.get(slug) ?? null;
    },
    [coursesByPathSlug]
  );

  const selectedCourseFromPath = useMemo(() => {
    if (route.kind !== "course") {
      return null;
    }
    const key = resolveCourseKeyFromPath(route.slug);
    if (!key) {
      return null;
    }
    return courses.find((course) => course.key === key) ?? null;
  }, [route.kind, route.slug, resolveCourseKeyFromPath, courses]);

  const selectedCourse = useMemo(() => {
    const match = selectedCourseFromPath ?? courses.find((course) => course.key === currentCourseKey);
    return match ?? courses[0];
  }, [courses, currentCourseKey, selectedCourseFromPath]);

  const sections = (selectedCourse?.data?.modules ?? []).flatMap((module, moduleIndex) =>
    module.sections.map((section, sectionIndex) => ({
      ...section,
      moduleIndex,
      moduleTitle: module.title,
      displayNumber: `${moduleIndex + 1}.${sectionIndex + 1}`,
    }))
  );

  const currentSection = sections[currentSectionIndex] ?? null;
  const moduleIndex = currentSection?.moduleIndex ?? 0;
  const moduleTitle = currentSection?.moduleTitle ?? "";
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === sections.length - 1;
  const courseProgressPercentage = sections.length > 1 ? (currentSectionIndex / (sections.length - 1)) * 100 : 0;
  const currentModuleIndex = currentSection?.moduleIndex ?? 0;
  const moduleSections = sections.filter((section) => section.moduleIndex === currentModuleIndex);
  const moduleSectionIndex = currentSection ? moduleSections.findIndex((section) => section.id === currentSection.id) : 0;
  const moduleProgressPercentage = moduleSections.length > 1 ? (moduleSectionIndex / (moduleSections.length - 1)) * 100 : 0;

  const progressStorageKey = `lyceum-progress-${selectedCourse?.key}`;
  const [progress, setProgress] = useState<{ completedSectionIds: string[] }>({ completedSectionIds: [] });
  const isCompleted = currentSection ? progress.completedSectionIds.includes(currentSection.id) : false;
  const orderMandatory = selectedCourse?.data?.orderMandatory ?? false;

  const routeToHome = useCallback(() => {
    if (window.location.pathname === "/") {
      setCurrentPath("/");
      return;
    }
    window.history.pushState({}, "", "/");
    setCurrentPath("/");
  }, []);

  const openCourseByEntry = useCallback(
    (course: CourseEntry) => {
      setCurrentCourseKey(course.key);
      setCurrentSectionIndex(0);
      const nextPath = `/courses/${getCoursePathSlug(course)}`;
      if (window.location.pathname !== nextPath) {
        window.history.pushState({ courseKey: course.key }, "", nextPath);
      }
      setCurrentPath(nextPath);
    },
    []
  );

  const handleSectionSelect = (index: number) => {
    setCurrentSectionIndex(index);
  };

  const handleNextSection = () => {
    setCurrentSectionIndex((prev) => Math.min(prev + 1, sections.length - 1));
  };

  const handlePrevSection = () => {
    setCurrentSectionIndex((prev) => Math.max(prev - 1, 0));
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
    if (route.kind === "course" && selectedCourseFromPath) {
      if (selectedCourseFromPath.key !== currentCourseKey) {
        setCurrentCourseKey(selectedCourseFromPath.key);
        setCurrentSectionIndex(0);
      }
      return;
    }

    if (route.kind === "course" && route.slug) {
      const resolvedKey = resolveCourseKeyFromPath(route.slug);
      if (resolvedKey) {
        setCurrentCourseKey(resolvedKey);
        setCurrentSectionIndex(0);
        return;
      }
      return;
    }
  }, [route.kind, route.slug, resolveCourseKeyFromPath, selectedCourseFromPath, currentCourseKey, currentPath]);

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

  useEffect(() => {
    const loadedProgress = localStorage.getItem(progressStorageKey);
    const initialProgress: { completedSectionIds: string[] } = loadedProgress
      ? JSON.parse(loadedProgress)
      : { completedSectionIds: [] };
    setProgress(initialProgress);
  }, [progressStorageKey]);

  return (
    <div className="app-root">
      <header className="top-bar">
        <a href="/" className="top-bar-title" onClick={openHomeFromHero}>
          Lycium
        </a>
      </header>

      {route.kind === "home" ? (
        <main className="home-page">
          <section className="hero">
            <h1>Lycium</h1>
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
                return (
                  <article key={course.key} className="course-card">
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
                    <button
                      className="course-open-button"
                      type="button"
                      onClick={() => openCourseByEntry(course)}
                    >
                      Open course
                    </button>
                    <small className="course-slug">/{`courses/${slug}`}</small>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      ) : (
        <div className="main-layout">
          <Sidebar
            sections={sections}
            currentSectionIndex={currentSectionIndex}
            onSectionSelect={handleSectionSelect}
            courseTitle={selectedCourse?.data?.title ?? "Course"}
            progressPercentage={courseProgressPercentage}
          />
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
          />
        </div>
      )}
    </div>
  );
}

export default App;
