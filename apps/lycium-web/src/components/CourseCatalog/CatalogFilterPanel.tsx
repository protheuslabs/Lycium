import { useEffect, useRef, useState } from "react";
import Dropdown from "../Dropdown/Dropdown";
import type { DropdownOption } from "../Dropdown/Dropdown";
import { CATALOG_ACTIVITY_OPTIONS, type CatalogActivityFilter } from "./catalogUtils";

type CatalogFilterPanelProps = {
  activeFilterCount: number;
  showLockedCourses: boolean;
  collegeFilter: string;
  collegeFilterOptions: DropdownOption[];
  departmentFilter: string;
  departmentFilterOptions: DropdownOption[];
  difficultyFilter: string;
  difficultyFilterOptions: DropdownOption[];
  activityFilter: CatalogActivityFilter;
  onShowLockedCoursesChange: (checked: boolean) => void;
  onCollegeFilterChange: (value: string) => void;
  onDepartmentFilterChange: (value: string) => void;
  onDifficultyFilterChange: (value: string) => void;
  onActivityFilterChange: (value: string) => void;
  onResetFilters: () => void;
};

export default function CatalogFilterPanel({
  activeFilterCount,
  showLockedCourses,
  collegeFilter,
  collegeFilterOptions,
  departmentFilter,
  departmentFilterOptions,
  difficultyFilter,
  difficultyFilterOptions,
  activityFilter,
  onShowLockedCoursesChange,
  onCollegeFilterChange,
  onDepartmentFilterChange,
  onDifficultyFilterChange,
  onActivityFilterChange,
  onResetFilters,
}: CatalogFilterPanelProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell || shell.contains(event.target as Node)) {
        return;
      }
      setIsFilterOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterOpen]);

  return (
    <div className="catalog-filter-shell" ref={shellRef}>
      <button
        className={`catalog-filter-button ${isFilterOpen ? "catalog-filter-button--active" : ""}`}
        type="button"
        aria-expanded={isFilterOpen}
        aria-haspopup="dialog"
        onClick={() => setIsFilterOpen((current) => !current)}
      >
        <span>Filters</span>
        {activeFilterCount > 0 && <span className="catalog-filter-count">{activeFilterCount}</span>}
      </button>
      {isFilterOpen && (
        <div className="catalog-filter-panel" role="dialog" aria-label="Catalog filters">
          <section className="catalog-filter-section">
            <div>
              <h3>Availability</h3>
              <p>Control whether locked courses appear in the catalog.</p>
            </div>
            <label className="catalog-filter-checkbox">
              <input
                type="checkbox"
                checked={showLockedCourses}
                onChange={(event) => onShowLockedCoursesChange(event.target.checked)}
              />
              <span>Show locked courses</span>
            </label>
          </section>
          <section className="catalog-filter-section">
            <div>
              <h3>College and department</h3>
              <p>Department filtering unlocks after selecting a college.</p>
            </div>
            <div className="catalog-filter-grid">
              <label className="catalog-dropdown-field">
                <Dropdown
                  className="catalog-dropdown"
                  value={collegeFilter}
                  options={collegeFilterOptions}
                  onChange={onCollegeFilterChange}
                  ariaLabel="Filter by college"
                />
              </label>
              <label className="catalog-dropdown-field">
                <Dropdown
                  className="catalog-dropdown"
                  value={departmentFilter}
                  options={departmentFilterOptions}
                  onChange={onDepartmentFilterChange}
                  ariaLabel="Filter by department"
                  disabled={collegeFilter === "all"}
                />
              </label>
            </div>
          </section>
          <section className="catalog-filter-section">
            <div>
              <h3>Course state</h3>
              <p>Narrow by difficulty or how far along the learner is.</p>
            </div>
            <div className="catalog-filter-grid">
              <label className="catalog-dropdown-field">
                <Dropdown
                  className="catalog-dropdown"
                  value={difficultyFilter}
                  options={difficultyFilterOptions}
                  onChange={onDifficultyFilterChange}
                  ariaLabel="Filter by difficulty"
                />
              </label>
              <label className="catalog-dropdown-field">
                <Dropdown
                  className="catalog-dropdown"
                  value={activityFilter}
                  options={CATALOG_ACTIVITY_OPTIONS}
                  onChange={onActivityFilterChange}
                  ariaLabel="Filter by progress"
                />
              </label>
            </div>
          </section>
          <button className="catalog-filter-reset" type="button" onClick={onResetFilters}>
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
