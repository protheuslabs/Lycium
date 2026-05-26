import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { SectionStatus } from "../../courseTypes";
import ProgressMeter from "../ProgressMeter/ProgressMeter";

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
  sectionStatuses: Record<string, SectionStatus>;
};

let persistedSidebarCollapsed = true;

type DisplayStatus = SectionStatus | "available";

function getStatusLabel(status: DisplayStatus): string {
  if (status === "completed") return "Completed";
  if (status === "locked") return "Locked";
  if (status === "seen") return "Seen";
  if (status === "timed") return "Quiz in progress";
  return "Available";
}

function getStatusClassName(status: DisplayStatus): string {
  if (status === "available") return "sidebar-status";
  if (status === "completed") return "sidebar-status sidebar-status--complete";
  return `sidebar-status sidebar-status--${status}`;
}

function SidebarStatusGlyph({ status }: { status: DisplayStatus }) {
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
}

const SidebarStatusBadge = memo(function SidebarStatusBadge({
  status,
  className = "",
}: {
  status: DisplayStatus;
  className?: string;
}) {
  const label = getStatusLabel(status);

  return (
    <span className={`${getStatusClassName(status)} ${className}`.trim()} aria-label={label} title={label}>
      <SidebarStatusGlyph status={status} />
    </span>
  );
});

const SidebarModuleHeader = memo(function SidebarModuleHeader({
  moduleIndex,
  moduleTitle,
  moduleStatus,
  isExpanded,
  isActiveModule,
  isCollapsed,
  onToggleModule,
}: {
  moduleIndex: number;
  moduleTitle: string;
  moduleStatus: DisplayStatus;
  isExpanded: boolean;
  isActiveModule: boolean;
  isCollapsed: boolean;
  onToggleModule: (moduleIndex: number) => void;
}) {
  return (
    <button
      type="button"
      className={`module-header ${isExpanded ? "module-header--expanded" : ""} ${
        isActiveModule ? "module-header--active" : ""
      }`}
      onClick={() => onToggleModule(moduleIndex)}
      aria-expanded={isExpanded}
      aria-disabled={isActiveModule}
    >
      <span className="module-header-label">
        {isCollapsed ? `M${moduleIndex + 1}` : `Module ${moduleIndex + 1}: ${moduleTitle}`}
      </span>
      {isCollapsed && <SidebarStatusBadge status={moduleStatus} className="module-header-status" />}
      <span className="module-header-caret" aria-hidden="true">
        ▾
      </span>
    </button>
  );
});

const SidebarSectionItem = memo(function SidebarSectionItem({
  section,
  index,
  status,
  isActive,
  isCollapsed,
  onSectionSelect,
}: {
  section: SidebarSection;
  index: number;
  status: DisplayStatus;
  isActive: boolean;
  isCollapsed: boolean;
  onSectionSelect: (index: number) => void;
}) {
  const isLocked = status === "locked";
  const handleClick = useCallback(() => {
    if (!isLocked) {
      onSectionSelect(index);
    }
  }, [index, isLocked, onSectionSelect]);

  return (
    <div
      className={`sidebar-item ${isActive ? "active" : ""} ${isLocked ? "locked" : ""}`}
      onClick={handleClick}
      aria-disabled={isLocked}
    >
      <span className="sidebar-item-label">
        {isCollapsed ? section.displayNumber : `${section.displayNumber} ${section.title}`}
      </span>
      <SidebarStatusBadge status={status} />
    </div>
  );
});

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
  const activeModuleIndexRef = useRef(activeModuleIndex);
  activeModuleIndexRef.current = activeModuleIndex;
  const [expandedModules, setExpandedModules] = useState<Set<number>>(() => new Set());
  const [isCollapsed, setIsCollapsed] = useState(() => persistedSidebarCollapsed);
  const [isContentFading, setIsContentFading] = useState(false);
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

  const getSectionStatus = useCallback(
    (sectionId: string): DisplayStatus => sectionStatuses[sectionId] ?? "available",
    [sectionStatuses],
  );

  const getModuleStatus = useCallback((
    moduleSections: Array<{ section: SidebarSection; index: number }>
  ): DisplayStatus => {
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
  }, [getSectionStatus]);

  const toggleModule = useCallback((moduleIndex: number) => {
    if (moduleIndex === activeModuleIndexRef.current) {
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
  }, []);

  const toggleCollapsed = () => {
    setIsContentFading(true);
    window.setTimeout(() => {
      setIsCollapsed((collapsed) => {
        const nextCollapsed = !collapsed;
        persistedSidebarCollapsed = nextCollapsed;
        return nextCollapsed;
      });
      window.setTimeout(() => setIsContentFading(false), 220);
    }, 120);
  };
  
  return (
    <aside className={`sidebar ${isCollapsed ? "sidebar--collapsed" : ""} ${isContentFading ? "sidebar--content-fading" : ""}`}>
      <button
        className="sidebar-pulltab"
        type="button"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!isCollapsed}
        onClick={toggleCollapsed}
      >
        <span aria-hidden="true">{isCollapsed ? "›" : "‹"}</span>
      </button>

      <div className="progress-wrapper" aria-hidden={isCollapsed}>
        <h3 className="sidebar-title">{courseTitle}</h3>
        <ProgressMeter
          cacheKey={`sidebar:${courseTitle}`}
          progressPercentage={progressPercentage}
          viewedPercentage={viewedPercentage}
        />
      </div>
      
      <div className="sidebar-section-list">
        {moduleGroups.map((moduleGroup) => {
          const isActiveModule = moduleGroup.moduleIndex === activeModuleIndex;
          const isExpanded = isActiveModule || expandedModules.has(moduleGroup.moduleIndex);
          const moduleStatus = getModuleStatus(moduleGroup.sections);
          
          return (
            <section className="sidebar-module" key={moduleGroup.moduleIndex}>
              <SidebarModuleHeader
                moduleIndex={moduleGroup.moduleIndex}
                moduleTitle={moduleGroup.moduleTitle}
                moduleStatus={moduleStatus}
                isExpanded={isExpanded}
                isActiveModule={isActiveModule}
                isCollapsed={isCollapsed}
                onToggleModule={toggleModule}
              />

              {isExpanded && (
                <div className="sidebar-module-sections">
                  {moduleGroup.sections.map(({ section, index: idx }) => {
                    const sectionStatus = getSectionStatus(section.id);

                    return (
                      <SidebarSectionItem
                        key={section.id}
                        section={section}
                        index={idx}
                        status={sectionStatus}
                        isActive={idx === currentSectionIndex}
                        isCollapsed={isCollapsed}
                        onSectionSelect={onSectionSelect}
                      />
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
