import "./Sidebar.css";

import { ChangeEvent } from "react";

type SidebarCourse = {
  key: string;
  title: string;
  source: "local" | "remote";
};

type SidebarSection = {
  id: string;
  title: string;
  moduleIndex: number;
  moduleTitle: string;
  displayNumber: string;
};

type SidebarProps = {
  sections: SidebarSection[];
  currentSectionIndex: number;
  onSectionSelect: (index: number) => void;
  currentCourseKey: string;
  onCourseChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  courses: SidebarCourse[];
  courseTitle: string;
  progressPercentage: number;
};

export default function Sidebar({
  sections,
  currentSectionIndex, 
  onSectionSelect,
  currentCourseKey,
  onCourseChange,
  courses,
  courseTitle,
  progressPercentage
}: SidebarProps) {
  
  return (
    <aside className="sidebar">
      
      {/* Course selector at the top */}
      <div className="course-selector">
        <label className="course-label">
          Course:&nbsp;
          <select
            value={currentCourseKey}
            onChange={onCourseChange}
            className="course-select"
          >
            {courses.map((course) => (
              <option key={course.key} value={course.key}>
                {course.title} {course.source === "remote" ? "(generated)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      
      {/* Section list below the course selector */}
      <h3 className="sidebar-title">{courseTitle}</h3>

      <h3 className="progress-percentage">
        {Math.round(progressPercentage)}% complete
      </h3>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      <div className="sidebar-section-list">
        {sections.map((section, idx) => {
          const showModuleHeader =
            idx === 0 || section.moduleIndex !== sections[idx - 1].moduleIndex;
          return (
            <div key={section.id}>
              {/* MODULE HEADER */}
              {showModuleHeader && (
                <div className="module-header">
                  Module {section.moduleIndex + 1}: {section.moduleTitle}
                </div>
              )}

              {/* SECTION ITEM */}
              <div
                className={`sidebar-item ${
                  idx === currentSectionIndex ? "active" : ""
                }`}
                onClick={() => {
                  onSectionSelect(idx)
                  console.log("Section clicked:", idx)
                }
                }
              >
                {section.displayNumber} {section.title}
              </div>
            </div>
          );
        })}
      </div>

      
    </aside>
  )
}
