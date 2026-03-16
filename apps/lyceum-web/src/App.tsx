// App.jsx

import { useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar/Sidebar";
import ContentView from "./components/ContentView/ContentView";
import TopBar from "./components/TopBar/TopBar";
import aiCourse from "./courseData/introToAiCourse.json";
import webDevCourse from "./courseData/webDevCourse.json";
import pythonCourse from "./courseData/introToPythonCourse.json"


function App() {
  const courses = {
    ai: {
        key: "ai",
        title: aiCourse.title,
        data: aiCourse
      },
    web: {
        key: "web",
        title: webDevCourse.title,
        data: webDevCourse
      },
    python: {
      key: "python",
      title: pythonCourse.title,
      data: pythonCourse
    }
  }
  const [currentCourseKey, setCurrentCourseKey] = useState("ai");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const selectedCourse = courses[currentCourseKey].data;
  const courseTitle = selectedCourse.title;
  
  const sections = selectedCourse.modules.flatMap((module, moduleIndex) =>
    module.sections.map((section, sectionIndex) => ({
      ...section,
      moduleIndex,                      
      moduleTitle: module.title,       
      displayNumber: `${moduleIndex + 1}.${sectionIndex + 1}`,
    }))
  );
  
  const currentSection = sections[currentSectionIndex];
  if (currentSectionIndex < 0 || currentSectionIndex >= sections.length) {
    console.warn("Invalid currentSectionIndex:", currentSectionIndex);
  }
  // const module
  const moduleIndex = currentSection.moduleIndex;
  const moduleTitle = currentSection.moduleTitle;
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === sections.length - 1;

  // Calculate progress percentages for the progress bar/tab
  const courseProgressPercentage = sections.length > 1 
    ? ((currentSectionIndex) / (sections.length - 1)) * 100 
    : 0;
  const currentModuleIndex = currentSection.moduleIndex;
  const moduleSections = sections.filter(
    (s) => s.moduleIndex === currentModuleIndex
  );
  const moduleSectionIndex = moduleSections.findIndex(
    (s) => s.id === currentSection.id
  );
  const moduleProgressPercentage =
    moduleSections.length > 1
      ? (moduleSectionIndex / (moduleSections.length - 1)) * 100
      : 0;


  // varibles for saving progress
  const progressStorageKey = `lyceum-progress-${currentCourseKey}`;
  const saved = localStorage.getItem(progressStorageKey);
  const initialProgress: { completedSectionIds: string[] } = saved 
    ? JSON.parse(saved) 
    : { completedSectionIds: [] };
  const [progress, setProgress] = useState(initialProgress);
  const savedSection = 0;
  const isCompleted = progress.completedSectionIds.includes(currentSection.id);
  const orderMandatory = false;
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
  
  function handleCourseChange(evt) {
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
  }
  
  return (
  <div className="app-root">
    <header className="top-bar">
      <h1 className="top-bar-title">Lycium - Democratized learning</h1>
    </header>
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

