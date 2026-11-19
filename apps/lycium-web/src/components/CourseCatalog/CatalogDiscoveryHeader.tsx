import { Search } from "lucide-react";
import Dropdown from "../Dropdown/Dropdown";
import { CATALOG_VIEW_LEVEL_OPTIONS, type CatalogViewLevel } from "./catalogUtils";

type CatalogDiscoveryHeaderProps = {
  viewLevel: CatalogViewLevel;
  searchQuery: string;
  disabled: boolean;
  onViewLevelChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

export default function CatalogDiscoveryHeader({
  viewLevel,
  searchQuery,
  disabled,
  onViewLevelChange,
  onSearchChange,
}: CatalogDiscoveryHeaderProps) {
  return (
    <header className="catalog-heading">
      <h1>Catalog</h1>
      <div className="catalog-discovery-search" role="search">
        <Dropdown
          className="catalog-level-dropdown"
          value={viewLevel}
          options={CATALOG_VIEW_LEVEL_OPTIONS}
          onChange={onViewLevelChange}
          ariaLabel="Select catalog view level"
          disabled={disabled}
        />
        <label className="catalog-query-field">
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
