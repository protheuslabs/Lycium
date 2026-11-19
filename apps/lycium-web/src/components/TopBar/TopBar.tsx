import type { MouseEvent } from "react";
import { Library, Settings } from "lucide-react";
import Link from "next/link";
import { COURSE_CATALOG_PATH, SETTINGS_PATH } from "../../utils/courseRouting";

type TopBarProps = {
  onOpenCatalog?: () => void;
  onOpenSettings?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export default function TopBar({ onOpenCatalog, onOpenSettings }: TopBarProps) {
  const openCatalog = onOpenCatalog
    ? (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        onOpenCatalog();
      }
    : undefined;

  return (
    <header className="top-bar">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Link
        className="top-bar-title"
        href={COURSE_CATALOG_PATH}
        aria-label="Lycium home"
        onClick={openCatalog}
      >
        <span className="top-bar-title-full" aria-hidden="true">
          Lycium
        </span>
        <span className="top-bar-title-compact" aria-hidden="true">
          L
        </span>
      </Link>
      <Link
        href={COURSE_CATALOG_PATH}
        className="catalog-link top-bar-icon-button"
        aria-label="Course catalog"
        onClick={openCatalog}
      >
        <Library aria-hidden="true" />
        <span className="catalog-link-label">Catalog</span>
      </Link>
      <Link
        href={SETTINGS_PATH}
        className="settings-link top-bar-icon-button"
        aria-label="Settings"
        title="Settings"
        onClick={onOpenSettings}
      >
        <Settings aria-hidden="true" />
      </Link>
    </header>
  );
}
