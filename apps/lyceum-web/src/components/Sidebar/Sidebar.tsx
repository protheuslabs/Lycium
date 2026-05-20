import "./Sidebar.css";

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
  courseTitle: string;
  progressPercentage: number;
};

export default function Sidebar({
  sections,
  currentSectionIndex, 
  onSectionSelect,
  courseTitle,
  progressPercentage
}: SidebarProps) {
  
  return (
    <aside className="sidebar">
      <div className="progress-wrapper">
        <h3 className="sidebar-title">{courseTitle}</h3>
        <div className="progress-meter">
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="progress-percentage">
            {Math.round(progressPercentage)}% complete
          </p>
        </div>
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
