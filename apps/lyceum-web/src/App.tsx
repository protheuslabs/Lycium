// App.jsx

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar/Sidebar";
import ContentView from "./components/ContentView/ContentView";
import aiCourse from "./courseData/introToAiCourse.json";
import webDevCourse from "./courseData/webDevCourse.json";
import pythonCourse from "./courseData/introToPythonCourse.json"

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


function App() {
  const localCourses: CourseEntry[] = [
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
  ];

  const [courses, setCourses] = useState<CourseEntry[]>(localCourses);
  const [currentCourseKey, setCurrentCourseKey] = useState(localCourses[0]?.key ?? "");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [level, setLevel] = useState("");
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [generateMessage, setGenerateMessage] = useState("");
  const [learnerId, setLearnerId] = useState<number | null>(null);

  const selectedCourse = useMemo(() => {
    const match = courses.find((course) => course.key === currentCourseKey);
    return match ?? courses[0];
  }, [courses, currentCourseKey]);
  const courseTitle = selectedCourse?.data?.title ?? "Course";
  
  const sections = (selectedCourse?.data?.modules ?? []).flatMap((module, moduleIndex) =>
    module.sections.map((section, sectionIndex) => ({
      ...section,
      moduleIndex,
      moduleTitle: module.title,
      displayNumber: `${moduleIndex + 1}.${sectionIndex + 1}`,
    }))
  );
  
  const currentSection = sections[currentSectionIndex] ?? null;
  if (currentSectionIndex < 0 || currentSectionIndex >= sections.length) {
    console.warn("Invalid currentSectionIndex:", currentSectionIndex);
  }
  // const module
  const moduleIndex = currentSection?.moduleIndex ?? 0;
  const moduleTitle = currentSection?.moduleTitle ?? "";
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === sections.length - 1;

  // Calculate progress percentages for the progress bar/tab
  const courseProgressPercentage = sections.length > 1 
    ? ((currentSectionIndex) / (sections.length - 1)) * 100 
    : 0;
  const currentModuleIndex = currentSection?.moduleIndex ?? 0;
  const moduleSections = sections.filter(
    (s) => s.moduleIndex === currentModuleIndex
  );
  const moduleSectionIndex = currentSection
    ? moduleSections.findIndex((s) => s.id === currentSection.id)
    : 0;
  const moduleProgressPercentage =
    moduleSections.length > 1
      ? (moduleSectionIndex / (moduleSections.length - 1)) * 100
      : 0;


  // varibles for saving progress
  const progressStorageKey = `lyceum-progress-${currentCourseKey}`;
  const [progress, setProgress] = useState<{ completedSectionIds: string[] }>({ completedSectionIds: [] });
  const savedSection = 0;
  const isCompleted = currentSection ? progress.completedSectionIds.includes(currentSection.id) : false;
  const orderMandatory = selectedCourse?.data?.orderMandatory ?? false;

  useEffect(() => {
    const saved = localStorage.getItem(progressStorageKey);
    const initialProgress: { completedSectionIds: string[] } = saved ? JSON.parse(saved) : { completedSectionIds: [] };
    setProgress(initialProgress);
  }, [progressStorageKey]);

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
        setCourses([...remoteCourses, ...localCourses]);
        if (remoteCourses.length > 0) {
          setCurrentCourseKey(remoteCourses[0].key);
        }
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
  // Handler called when user clicks in the sidebar
  function handleSectionSelect(index) {
    setCurrentSectionIndex(index);
  }

  function handleNextSection() {
    setCurrentSectionIndex((prev) =>
      Math.min(prev + 1, sections.length - 1)
    );
  }

  function handlePrevSection() {
    setCurrentSectionIndex((prev) =>
      Math.max(prev - 1, 0)
    );
  }
  
  function handleCourseChange(evt: ChangeEvent<HTMLSelectElement>) {
    const newKey = evt.target.value;
    setCurrentCourseKey(newKey);
    setCurrentSectionIndex(savedSection); // We might save progress in the future but for now it resets to the first section
  }

  function handleCompleteSection(sectionId: string) {
    setProgress((prev) => {
      const set = new Set(prev.completedSectionIds);
      set.add(sectionId);

      const updated = { ...prev, completedSectionIds: Array.from(set) };
      localStorage.setItem(progressStorageKey, JSON.stringify(updated));
      return updated;
    });
    console.log("marked complete!");
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
  }

  async function handleGenerateCourse(evt: FormEvent<HTMLFormElement>) {
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
      setCurrentCourseKey(entry.key);
      setPrompt("");
      setGenerateStatus("success");
      setGenerateMessage("Course generated.");
    } catch (err) {
      console.warn("Course generation failed:", err);
      setGenerateStatus("error");
      setGenerateMessage("Course generation failed. Is the API running?");
    }
  }
  
  return (
  <div className="app-root">
    <header className="top-bar">
      <h1 className="top-bar-title">Lycium - Democratized learning</h1>
    </header>
    <div className="generator-bar">
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
        {generateMessage && (
          <span className={`generator-status generator-status-${generateStatus}`}>{generateMessage}</span>
        )}
      </form>
    </div>
    <div className="main-layout">
    <Sidebar
      sections={sections}
      currentSectionIndex={currentSectionIndex}
      onSectionSelect={handleSectionSelect}
      currentCourseKey={currentCourseKey}
      onCourseChange={handleCourseChange}
      courses={courses}
      courseTitle={courseTitle}
      progressPercentage={courseProgressPercentage}
    />

    <ContentView 
      courseTitle={courseTitle} 
      section={currentSection}
      moduleTitle = {moduleTitle}
      moduleIndex = {moduleIndex}
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
  </div>
  );
}

export default App;
