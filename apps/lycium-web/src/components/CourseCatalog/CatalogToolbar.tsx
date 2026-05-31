import type { LyciumProgram } from "@lycium/contracts";
import Dropdown from "../Dropdown/Dropdown";
import type { DropdownOption } from "../Dropdown/Dropdown";
import CatalogFilterPanel from "./CatalogFilterPanel";
import {
  CATALOG_SORT_OPTIONS,
  type CatalogActivityFilter,
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
  selectedProgram: LyciumProgram | null;
  searchQuery: string;
  sortMode: CatalogSortMode;
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
  onShowLockedCoursesChange: (checked: boolean) => void;
  onCollegeFilterChange: (value: string) => void;
  onDepartmentFilterChange: (value: string) => void;
  onDifficultyFilterChange: (value: string) => void;
  onActivityFilterChange: (value: string) => void;
  onResetCatalogFilters: () => void;
};

export default function CatalogToolbar({
  catalogViewLevel,
  selectedProgram,
  searchQuery,
  sortMode,
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
        <div className="catalog-level-context">
          {catalogViewLevel === "clusters" && selectedProgram
            ? `Viewing clusters in ${selectedProgram.title}`
            : "Choose a program to view its clusters"}
        </div>
      )}
    </div>
  );
}
