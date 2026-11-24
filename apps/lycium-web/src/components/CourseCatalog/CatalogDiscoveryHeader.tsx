import { Search } from "lucide-react";
import Link from "next/link";
import { STUDIO_PATH } from "../../utils/courseRouting";
import Dropdown from "../Dropdown/Dropdown";
import { CATALOG_VIEW_LEVEL_OPTIONS, type CatalogViewLevel } from "./catalogUtils";

type CatalogDiscoveryHeaderProps = {
  viewLevel: CatalogViewLevel;
  searchQuery: string;
  disabled: boolean;
  studioMode?: boolean;
  onViewLevelChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

export default function CatalogDiscoveryHeader({
  viewLevel,
  searchQuery,
  disabled,
  studioMode = false,
  onViewLevelChange,
  onSearchChange,
}: CatalogDiscoveryHeaderProps) {
  return (
    <header className="catalog-heading">
      <div className="catalog-heading-title">
        <h1 className={studioMode ? undefined : "learner-display-heading"}>{studioMode ? "Studio" : "Courses"}</h1>
        {!studioMode && <Link href={STUDIO_PATH} className="learner-text-link">Open Studio</Link>}
      </div>
      <div className="catalog-discovery-search" role="search">
        <Dropdown
          className="catalog-level-dropdown"
          value={viewLevel}
          options={CATALOG_VIEW_LEVEL_OPTIONS}
          onChange={onViewLevelChange}
          ariaLabel="Select catalog view level"
          disabled={disabled}
        />
        <label className="catalog-query-field site-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label={`Search ${viewLevel}`}
            placeholder={`Search ${viewLevel}`}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
    </header>
  );
}
