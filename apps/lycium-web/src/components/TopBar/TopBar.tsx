"use client";

import { useState, type MouseEvent } from "react";
import { House, Library, LogIn, NotebookTabs, Settings } from "lucide-react";
import LoginDialog from "../Account/LoginDialog";
import Link from "next/link";
import {
  COURSE_CATALOG_PATH,
  LYCIUM_ROUTE_ROOT,
  MY_LEARNING_PATH,
  SETTINGS_PATH,
} from "../../utils/courseRouting";
import type { RouteInfo } from "../../courseTypes";

type TopBarProps = {
  onOpenCatalog?: () => void;
  onOpenSettings?: (event: MouseEvent<HTMLAnchorElement>) => void;
  currentPage?: RouteInfo["kind"];
};

export default function TopBar({ onOpenCatalog, onOpenSettings, currentPage }: TopBarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
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
      <Link className="top-bar-title" href={LYCIUM_ROUTE_ROOT} aria-label="Lycium home">
        <span className="top-bar-title-full" aria-hidden="true">
          Lycium
        </span>
        <span className="top-bar-title-compact" aria-hidden="true">
          L
        </span>
      </Link>
      <nav className="top-bar-navigation" aria-label="Primary navigation">
        <Link
          href={LYCIUM_ROUTE_ROOT}
          className="top-bar-icon-button home-link"
          aria-label="Home"
          aria-current={currentPage === "landing" ? "page" : undefined}
        >
          <House aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link
          href={MY_LEARNING_PATH}
          className="top-bar-icon-button learning-link"
          aria-label="My Learning"
          aria-current={currentPage === "learning" ? "page" : undefined}
        >
          <NotebookTabs aria-hidden="true" />
          <span>My Learning</span>
        </Link>
        <Link
          href={COURSE_CATALOG_PATH}
          className="catalog-link top-bar-icon-button"
          aria-label="Course catalog"
          aria-current={currentPage === "home" ? "page" : undefined}
          onClick={openCatalog}
        >
          <Library aria-hidden="true" />
          <span className="catalog-link-label">Catalog</span>
        </Link>
      </nav>
      <Link
        href={SETTINGS_PATH}
        className="settings-link top-bar-icon-button"
        aria-label="Settings"
        title="Settings"
        onClick={onOpenSettings}
      >
        <Settings aria-hidden="true" />
      </Link>
      <button type="button" className="top-bar-login" onClick={() => setIsLoginOpen(true)}>
        <LogIn size={16} aria-hidden="true" />
        <span>Log in</span>
      </button>
      <LoginDialog isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </header>
  );
}
