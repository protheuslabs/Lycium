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
  selectedProgramId: string;
  programOptions: DropdownOption[];
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
  onSelectedProgramChange: (value: string) => void;
  onShowLockedCoursesChange: (checked: boolean) => void;
  onCollegeFilterChange: (value: string) => void;
  onDepartmentFilterChange: (value: string) => void;
  onDifficultyFilterChange: (value: string) => void;
  onActivityFilterChange: (value: string) => void;
  onResetCatalogFilters: () => void;
};

export default function CatalogToolbar({
  catalogViewLevel,
  selectedProgramId,
  programOptions,
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
  onSelectedProgramChange,
  onShowLockedCoursesChange,
  onCollegeFilterChange,
  onDepartmentFilterChange,
  onDifficultyFilterChange,
  onActivityFilterChange,
  onResetCatalogFilters,
}: CatalogToolbarProps) {
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
      {catalogViewLevel === "courses" ? (
        <>
          <label className="catalog-search-field">
            <input
              type="search"
              placeholder="Search names, tags, and departments"
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
                value={sortMode}
                options={CATALOG_SORT_OPTIONS}
                onChange={onSortModeChange}
                ariaLabel="Sort courses"
              />
            </label>
          </div>
        </>
      ) : (
        <>
          <label className="catalog-search-field">
            <input
              type="search"
              placeholder={catalogViewLevel === "programs" ? "Search programs" : "Search clusters"}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
          </label>
          <div className="catalog-dropdown-row catalog-dropdown-row--path">
            {catalogViewLevel === "clusters" && (
              <label className="catalog-dropdown-field">
                <Dropdown
                  className="catalog-dropdown"
                  value={selectedProgramId}
                  options={programOptions}
                  onChange={onSelectedProgramChange}
                  ariaLabel="Select program"
                />
              </label>
            )}
            <label className="catalog-dropdown-field">
              <Dropdown
                className="catalog-dropdown catalog-sort-dropdown"
                value={pathSortMode}
                options={CATALOG_PATH_SORT_OPTIONS}
                onChange={onPathSortModeChange}
                ariaLabel={`Sort ${catalogViewLevel}`}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
