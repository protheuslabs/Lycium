import Dropdown from "../Dropdown/Dropdown";
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

const CATALOG_VIEW_LEVEL_OPTIONS = [
  { value: "programs", label: "Programs" },
  { value: "clusters", label: "Clusters" },
  { value: "courses", label: "Courses" },
];

type CatalogToolbarProps = {
  catalogViewLevel: CatalogViewLevel;
  searchQuery: string;
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
  onCatalogViewLevelChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSortModeChange: (value: string) => void;
  onPathSortModeChange: (value: string) => void;
  onShowLockedCoursesChange: (checked: boolean) => void;
  onCollegeFilterChange: (value: string) => void;
  onDepartmentFilterChange: (value: string) => void;
  onDifficultyFilterChange: (value: string) => void;
  onActivityFilterChange: (value: string) => void;
  onResetCatalogFilters: () => void;
};

export default function CatalogToolbar({
  catalogViewLevel,
  searchQuery,
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
  onCatalogViewLevelChange,
  onSearchQueryChange,
  onSortModeChange,
  onPathSortModeChange,
  onShowLockedCoursesChange,
  onCollegeFilterChange,
  onDepartmentFilterChange,
  onDifficultyFilterChange,
  onActivityFilterChange,
  onResetCatalogFilters,
}: CatalogToolbarProps) {
  const isCourseView = catalogViewLevel === "courses";
  const searchPlaceholder = isCourseView
    ? "Search names, tags, and departments"
    : catalogViewLevel === "programs"
      ? "Search programs"
      : "Search clusters";
  const sortValue = isCourseView ? sortMode : pathSortMode;
  const sortOptions = isCourseView ? CATALOG_SORT_OPTIONS : CATALOG_PATH_SORT_OPTIONS;
  const sortLabel = isCourseView ? "Sort courses" : `Sort ${catalogViewLevel}`;
  const handleSortChange = isCourseView ? onSortModeChange : onPathSortModeChange;

  return (
    <div className="catalog-toolbar">
      <label className="catalog-view-field">
        <Dropdown
          className="catalog-view-dropdown"
          value={catalogViewLevel}
          options={CATALOG_VIEW_LEVEL_OPTIONS}
          onChange={onCatalogViewLevelChange}
          ariaLabel="Select catalog view level"
        />
      </label>
      <label className="catalog-search-field">
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>
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
