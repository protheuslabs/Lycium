import { useMemo, useState } from "react";
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
  contentHeight: number | null;
  completedSectionIds: string[];
  orderMandatory: boolean;
};

export default function Sidebar({
  sections,
  currentSectionIndex, 
  onSectionSelect,
  courseTitle,
  progressPercentage,
  completedSectionIds,
  orderMandatory
}: SidebarProps) {
  const completedSections = new Set(completedSectionIds);
  const activeModuleIndex = sections[currentSectionIndex]?.moduleIndex ?? 0;
  const [expandedModules, setExpandedModules] = useState<Set<number>>(() => new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const moduleGroups = useMemo(() => {
    const groups: Array<{
      moduleIndex: number;
      moduleTitle: string;
      sections: Array<{ section: SidebarSection; index: number }>;
    }> = [];

    sections.forEach((section, index) => {
      const existingGroup = groups.find((group) => group.moduleIndex === section.moduleIndex);

      if (existingGroup) {
        existingGroup.sections.push({ section, index });
        return;
      }

      groups.push({
        moduleIndex: section.moduleIndex,
        moduleTitle: section.moduleTitle,
        sections: [{ section, index }],
      });
    });

    return groups;
  }, [sections]);

  const toggleModule = (moduleIndex: number) => {
    if (moduleIndex === activeModuleIndex) {
      return;
    }

    setExpandedModules((current) => {
      const next = new Set(current);

      if (next.has(moduleIndex)) {
        next.delete(moduleIndex);
      } else {
        next.add(moduleIndex);
      }

      return next;
    });
  };
  
  return (
    <aside className={`sidebar ${isCollapsed ? "sidebar--collapsed" : ""}`}>
      <button
        className="sidebar-pulltab"
        type="button"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
      >
        <span aria-hidden="true">{isCollapsed ? "›" : "‹"}</span>
      </button>

      <div className="progress-wrapper" aria-hidden={isCollapsed}>
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
        {moduleGroups.map((moduleGroup) => {
          const isActiveModule = moduleGroup.moduleIndex === activeModuleIndex;
          const isExpanded = isActiveModule || expandedModules.has(moduleGroup.moduleIndex);
          const isModuleCompleted = moduleGroup.sections.every(({ section }) => completedSections.has(section.id));
          const isModuleLocked =
            orderMandatory &&
            !isModuleCompleted &&
            moduleGroup.sections.every(({ index: idx, section }) => {
              const sectionLocked =
                !completedSections.has(section.id) &&
                sections.slice(0, idx).some((previousSection) => !completedSections.has(previousSection.id));
              return sectionLocked;
            });
          const moduleStatusLabel = isModuleCompleted ? "Completed" : isModuleLocked ? "Locked" : "Available";
          
          return (
            <section className="sidebar-module" key={moduleGroup.moduleIndex}>
              <button
                type="button"
                className={`module-header ${isExpanded ? "module-header--expanded" : ""} ${
                  isActiveModule ? "module-header--active" : ""
                }`}
                onClick={() => toggleModule(moduleGroup.moduleIndex)}
                aria-expanded={isExpanded}
                aria-disabled={isActiveModule}
              >
                <span className="module-header-label">
                  {isCollapsed ? `M${moduleGroup.moduleIndex + 1}` : `Module ${moduleGroup.moduleIndex + 1}: ${moduleGroup.moduleTitle}`}
                </span>
                {isCollapsed && (
                  <span
                    className={`sidebar-status module-header-status ${
                      isModuleCompleted
                        ? "sidebar-status--complete"
                        : isModuleLocked
                          ? "sidebar-status--locked"
                          : ""
                    }`}
                    aria-label={moduleStatusLabel}
                    title={moduleStatusLabel}
                  >
                    {isModuleCompleted && <span className="sidebar-status-check">✓</span>}
                    {isModuleLocked && <span className="sidebar-lock-icon" aria-hidden="true" />}
                  </span>
                )}
                <span className="module-header-caret" aria-hidden="true">
                  ▾
                </span>
              </button>

              {isExpanded && (
                <div className="sidebar-module-sections">
                  {moduleGroup.sections.map(({ section, index: idx }) => {
                    const isCompleted = completedSections.has(section.id);
                    const isLocked =
                      orderMandatory &&
                      !isCompleted &&
                      sections.slice(0, idx).some((previousSection) => !completedSections.has(previousSection.id));
                    const statusLabel = isCompleted
                      ? "Completed"
                      : isLocked
                        ? "Locked"
                        : "Available";

                    return (
                      <div
                        key={section.id}
                        className={`sidebar-item ${
                          idx === currentSectionIndex ? "active" : ""
                        } ${isLocked ? "locked" : ""}`}
                        onClick={() => {
                          if (!isLocked) {
                            onSectionSelect(idx);
                          }
                        }}
                        aria-disabled={isLocked}
                      >
                        <span className="sidebar-item-label">
                          {isCollapsed ? section.displayNumber : `${section.displayNumber} ${section.title}`}
                        </span>
                        <span
                          className={`sidebar-status ${
                            isCompleted
                              ? "sidebar-status--complete"
                              : isLocked
                                ? "sidebar-status--locked"
                                : ""
                          }`}
                          aria-label={statusLabel}
                          title={statusLabel}
                        >
                          {isCompleted && <span className="sidebar-status-check">✓</span>}
                          {isLocked && <span className="sidebar-lock-icon" aria-hidden="true" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      
    </aside>
  )
}
