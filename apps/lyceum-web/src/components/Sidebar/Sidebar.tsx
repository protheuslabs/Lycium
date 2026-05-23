import { useMemo, useState } from "react";
import type { SectionStatus } from "../../courseTypes";
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
  viewedPercentage: number;
  contentHeight: number | null;
  sectionStatuses: Record<string, SectionStatus>;
};

export default function Sidebar({
  sections,
  currentSectionIndex, 
  onSectionSelect,
  courseTitle,
  progressPercentage,
  viewedPercentage,
  sectionStatuses
}: SidebarProps) {
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

  const getSectionStatus = (sectionId: string): SectionStatus | "available" => sectionStatuses[sectionId] ?? "available";

  const getModuleStatus = (
    moduleSections: Array<{ section: SidebarSection; index: number }>
  ): SectionStatus | "available" => {
    const statuses = moduleSections.map(({ section }) => getSectionStatus(section.id));
    if (statuses.length > 0 && statuses.every((status) => status === "completed")) {
      return "completed";
    }
    if (statuses.length > 0 && statuses.every((status) => status === "locked")) {
      return "locked";
    }
    if (statuses.some((status) => status === "timed")) {
      return "timed";
    }
    if (statuses.some((status) => status === "seen")) {
      return "seen";
    }
    return "available";
  };

  const statusLabel = (status: SectionStatus | "available"): string => {
    if (status === "completed") return "Completed";
    if (status === "locked") return "Locked";
    if (status === "seen") return "Seen";
    if (status === "timed") return "Quiz in progress";
    return "Available";
  };

  const statusClassName = (status: SectionStatus | "available"): string => {
    if (status === "available") {
      return "sidebar-status";
    }

    if (status === "completed") {
      return "sidebar-status sidebar-status--complete";
    }

    return `sidebar-status sidebar-status--${status}`;
  };

  const renderStatusGlyph = (status: SectionStatus | "available") => {
    if (status === "completed") {
      return <span className="sidebar-status-check">✓</span>;
    }
    if (status === "locked") {
      return <span className="sidebar-lock-icon" aria-hidden="true" />;
    }
    if (status === "seen") {
      return (
        <svg className="sidebar-status-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      );
    }
    if (status === "timed") {
      return (
        <svg className="sidebar-status-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 2h10v2.5L14 8v1l3 3.5V16H7v-3.5L10 9V8L7 4.5V2Zm8 12.75v-1.5L12 9.75l-3 3.5v1.5h6Z" />
        </svg>
      );
    }
    return null;
  };

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
              className="progress-bar-viewed-fill"
              style={{ width: `${viewedPercentage}%` }}
            />
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="progress-percentage">
            {Math.round(progressPercentage)}% complete · {Math.round(viewedPercentage)}% viewed
          </p>
        </div>
      </div>
      
      <div className="sidebar-section-list">
        {moduleGroups.map((moduleGroup) => {
          const isActiveModule = moduleGroup.moduleIndex === activeModuleIndex;
          const isExpanded = isActiveModule || expandedModules.has(moduleGroup.moduleIndex);
          const moduleStatus = getModuleStatus(moduleGroup.sections);
          const moduleStatusLabel = statusLabel(moduleStatus);
          
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
                    className={`${statusClassName(moduleStatus)} module-header-status`}
                    aria-label={moduleStatusLabel}
                    title={moduleStatusLabel}
                  >
                    {renderStatusGlyph(moduleStatus)}
                  </span>
                )}
                <span className="module-header-caret" aria-hidden="true">
                  ▾
                </span>
              </button>

              {isExpanded && (
                <div className="sidebar-module-sections">
                  {moduleGroup.sections.map(({ section, index: idx }) => {
                    const sectionStatus = getSectionStatus(section.id);
                    const isLocked = sectionStatus === "locked";
                    const sectionStatusLabel = statusLabel(sectionStatus);

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
                          className={statusClassName(sectionStatus)}
                          aria-label={sectionStatusLabel}
                          title={sectionStatusLabel}
                        >
                          {renderStatusGlyph(sectionStatus)}
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
