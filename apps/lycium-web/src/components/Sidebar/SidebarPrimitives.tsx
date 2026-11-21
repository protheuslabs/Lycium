import { memo } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  Flag,
  Hourglass,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  Settings,
  X,
} from "lucide-react";
import type { SectionStatus } from "../../courseTypes";

export type DisplayStatus = SectionStatus | "available";
const statusLabels: Record<DisplayStatus, string> = {
  completed: "Completed",
  locked: "Locked",
  seen: "Viewed",
  timed: "Quiz in progress",
  available: "Not started",
};

export const SidebarStatusBadge = memo(function SidebarStatusBadge({
  status,
  className = "",
}: {
  status: DisplayStatus;
  className?: string;
}) {
  const Icon = {
    completed: Check,
    locked: LockKeyhole,
    seen: Eye,
    timed: Hourglass,
    available: null,
  }[status];
  return (
    <span
      className={`sidebar-status sidebar-status--${status} ${className}`}
      aria-label={statusLabels[status]}
      title={statusLabels[status]}
    >
      {Icon && <Icon size={14} aria-hidden="true" />}
    </span>
  );
});

export function SidebarAddRow({
  label,
  isCollapsed,
  onClick,
}: {
  label: string;
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="sidebar-add-row" aria-label={label} onClick={onClick}>
      <Plus size={16} aria-hidden="true" />
      {!isCollapsed && label}
    </button>
  );
}

export function SidebarEditControls({
  isEditMode,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenCourseSettings,
}: {
  isEditMode: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  onOpenCourseSettings?: () => void;
}) {
  const actions = isEditMode
    ? [
        { label: "Cancel course edits", Icon: X, action: onCancelEdit },
        { label: "Open course settings", Icon: Settings, action: onOpenCourseSettings },
        { label: "Save course edits", Icon: Save, action: onSaveEdit },
      ]
    : [{ label: "Edit course", Icon: Pencil, action: onStartEdit }];
  return (
    <div className="sidebar-edit-controls">
      {actions.map(({ label, Icon, action }) => (
        <button
          key={label}
          type="button"
          className="sidebar-edit-button"
          aria-label={label}
          title={label}
          onClick={action}
        >
          <Icon size={17} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function SidebarFinishButton({
  isCollapsed,
  onFinish,
}: {
  isCollapsed: boolean;
  onFinish?: () => void;
}) {
  return (
    <button
      type="button"
      className="sidebar-finish-button"
      aria-label="Finish course draft"
      onClick={onFinish}
    >
      <Flag size={16} aria-hidden="true" />
      {!isCollapsed && "Finish"}
    </button>
  );
}

function formatModuleHeaderLabel(moduleIndex: number, moduleTitle: string) {
  const labeledTitle = moduleTitle.match(/^\s*(Module|Week)\s+(\d+)\s*:?\s*(.*)$/i);
  if (!labeledTitle) return `Module ${moduleIndex + 1}: ${moduleTitle}`;
  const label = labeledTitle[1][0].toUpperCase() + labeledTitle[1].slice(1).toLowerCase();
  const prefix = `${label} ${labeledTitle[2]}`;
  const title = labeledTitle[3].replace(new RegExp(`^${prefix}\\s*:?\\s*`, "i"), "").trim();
  return title ? `${prefix}: ${title}` : prefix;
}

export const SidebarModuleHeader = memo(function SidebarModuleHeader({
  moduleIndex,
  moduleTitle,
  isExpanded,
  isActiveModule,
  completedCount,
  totalCount,
  onToggleModule,
}: {
  moduleIndex: number;
  moduleTitle: string;
  isExpanded: boolean;
  isActiveModule: boolean;
  completedCount: number;
  totalCount: number;
  isCollapsed: boolean;
  onToggleModule: (moduleIndex: number) => void;
}) {
  return (
    <button
      type="button"
      className={`module-header ${isExpanded ? "module-header--expanded" : ""} ${isActiveModule ? "module-header--active" : ""}`}
      onClick={() => onToggleModule(moduleIndex)}
      aria-expanded={isExpanded}
    >
      <span className="module-header-label">
        {formatModuleHeaderLabel(moduleIndex, moduleTitle)}
        <span className="module-header-progress">{completedCount}/{totalCount} complete</span>
      </span>
      <ChevronDown size={16} className="module-header-caret" aria-hidden="true" />
    </button>
  );
});

export const SidebarSourceTab = memo(function SidebarSourceTab({
  isActive,
  sourceCount,
  onSelect,
}: {
  isActive: boolean;
  isCollapsed: boolean;
  sourceCount: number;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className={`module-header sidebar-source-tab ${isActive ? "module-header--active" : ""}`}
      onClick={onSelect}
      aria-current={isActive ? "page" : undefined}
    >
      <BookOpen size={16} aria-hidden="true" />
      <span>Sources{sourceCount > 0 ? ` (${sourceCount})` : ""}</span>
    </button>
  );
});
