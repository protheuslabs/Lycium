import type { DropdownOption } from "../Dropdown/Dropdown";
import CatalogFilterPanel from "./CatalogFilterPanel";
import {
  CATALOG_PATH_SORT_OPTIONS,
  CATALOG_SORT_OPTIONS,
  type CatalogActivityFilter,
  type CatalogPathSortMode,
  type CatalogSortMode,
  type CatalogViewLevel,
} from "./catalogUtils";

import Dropdown from "../Dropdown/Dropdown";

type CatalogToolbarProps = {
  catalogViewLevel: CatalogViewLevel;
  sortMode: CatalogSortMode;
  pathSortMode: CatalogPathSortMode;
  activeFilterCount: number;
  showLockedCourses: boolean;
  collegeFilter: string;
  collegeFilterOptions: DropdownOption[];
  departmentFilter: string;
  departmentFilterOptions: DropdownOption[];
  difficultyFilter: string;
  difficultyFilterOptions: DropdownOption[];
  activityFilter: CatalogActivityFilter;
  onSortModeChange: (value: string) => void;
  onPathSortModeChange: (value: string) => void;
  showPrimaryAction: boolean;
  primaryActionLabel: string;
  primaryActionDisabled: boolean;
  onPrimaryAction: () => void;
  showContextAction: boolean;
  contextActionLabel: string;
  onContextAction: () => void;
  showCancelSelection: boolean;
  onCancelSelection: () => void;
  onShowLockedCoursesChange: (checked: boolean) => void;
  onCollegeFilterChange: (value: string) => void;
  onDepartmentFilterChange: (value: string) => void;
  onDifficultyFilterChange: (value: string) => void;
  onActivityFilterChange: (value: string) => void;
  onResetCatalogFilters: () => void;
};

export default function CatalogToolbar({
  catalogViewLevel,
  sortMode,
  pathSortMode,
  activeFilterCount,
  showLockedCourses,
  collegeFilter,
  collegeFilterOptions,
  departmentFilter,
  departmentFilterOptions,
  difficultyFilter,
  difficultyFilterOptions,
  activityFilter,
  onSortModeChange,
  onPathSortModeChange,
  showPrimaryAction,
  primaryActionLabel,
  primaryActionDisabled,
  onPrimaryAction,
  showContextAction,
  contextActionLabel,
  onContextAction,
  showCancelSelection,
  onCancelSelection,
  onShowLockedCoursesChange,
  onCollegeFilterChange,
  onDepartmentFilterChange,
  onDifficultyFilterChange,
  onActivityFilterChange,
  onResetCatalogFilters,
}: CatalogToolbarProps) {
  const isCourseView = catalogViewLevel === "courses";
  const sortValue = isCourseView ? sortMode : pathSortMode;
  const sortOptions = isCourseView ? CATALOG_SORT_OPTIONS : CATALOG_PATH_SORT_OPTIONS;
  const sortLabel = isCourseView ? "Sort courses" : `Sort ${catalogViewLevel}`;
  const handleSortChange = isCourseView ? onSortModeChange : onPathSortModeChange;

  return (
    <div className={`catalog-toolbar${showPrimaryAction ? " catalog-toolbar--with-create" : ""}`}>
      {showPrimaryAction && (
        <button className="catalog-create-button" type="button" disabled={primaryActionDisabled} onClick={onPrimaryAction}>
          <span className="catalog-create-button-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
            </svg>
          </span>
          <span>{primaryActionLabel}</span>
        </button>
      )}
      {showContextAction && (
        <button className="catalog-create-button catalog-create-button--secondary" type="button" onClick={onContextAction}>
          <span>{contextActionLabel}</span>
        </button>
      )}
      {showCancelSelection && (
        <button className="catalog-create-button catalog-create-button--secondary" type="button" onClick={onCancelSelection}>
          <span>Cancel</span>
        </button>
      )}
      <div className="catalog-dropdown-row">
        <CatalogFilterPanel
          activeFilterCount={activeFilterCount}
          showLockedCourses={showLockedCourses}
          collegeFilter={collegeFilter}
          collegeFilterOptions={collegeFilterOptions}
          departmentFilter={departmentFilter}
          departmentFilterOptions={departmentFilterOptions}
          difficultyFilter={difficultyFilter}
          difficultyFilterOptions={difficultyFilterOptions}
          activityFilter={activityFilter}
          onShowLockedCoursesChange={onShowLockedCoursesChange}
          onCollegeFilterChange={onCollegeFilterChange}
          onDepartmentFilterChange={onDepartmentFilterChange}
          onDifficultyFilterChange={onDifficultyFilterChange}
          onActivityFilterChange={onActivityFilterChange}
          onResetFilters={onResetCatalogFilters}
        />
        <label className="catalog-dropdown-field">
          <Dropdown
            className="catalog-dropdown catalog-sort-dropdown"
            value={sortValue}
            options={sortOptions}
            onChange={handleSortChange}
            ariaLabel={sortLabel}
          />
        </label>
      </div>
    </div>
  );
}
