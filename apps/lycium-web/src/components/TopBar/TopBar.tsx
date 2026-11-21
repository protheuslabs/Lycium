"use client";

import { useState, type MouseEvent } from "react";
import { Library, Menu, NotebookTabs, Search, Wrench } from "lucide-react";
import Link from "next/link";
import Modal from "../Modal/Modal";
import SiteSearch from "./SiteSearch";
import SiteOptions from "./SiteOptions";
import { COURSE_CATALOG_PATH, LYCIUM_ROUTE_ROOT, MY_LEARNING_PATH, TOOLS_PATH } from "../../utils/courseRouting";
import type { RouteInfo } from "../../courseTypes";

type TopBarProps = {
  onOpenCatalog?: () => void;
  onOpenSettings?: (event: MouseEvent<HTMLAnchorElement>) => void;
  currentPage?: RouteInfo["kind"];
};

export default function TopBar({ onOpenCatalog, onOpenSettings, currentPage }: TopBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navigation = [
    { label: "Catalog", ariaLabel: "Course catalog", href: COURSE_CATALOG_PATH, active: currentPage === "home", icon: Library },
    { label: "Tools", ariaLabel: "Tools", href: TOOLS_PATH, active: currentPage === "tools", icon: Wrench },
    { label: "My Learning", ariaLabel: "My Learning", href: MY_LEARNING_PATH, active: currentPage === "learning", icon: NotebookTabs },
  ];
  const openCatalog = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onOpenCatalog && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      onOpenCatalog();
    }
  };

  return (
    <>
      <header className="top-bar">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="top-bar-inner">
          <button className="top-bar-tool top-bar-menu" type="button" aria-label="Open navigation" aria-expanded={isMenuOpen} aria-haspopup="dialog" onClick={() => setIsMenuOpen(true)} title="Navigation">
            <Menu size={22} aria-hidden="true" />
          </button>
          <Link className="top-bar-title" href={LYCIUM_ROUTE_ROOT} aria-label="Lycium home" aria-current={currentPage === "landing" ? "page" : undefined}>
            <span className="top-bar-title-full" aria-hidden="true">LYCIUM</span>
            <span className="top-bar-title-compact" aria-hidden="true">L</span>
          </Link>
          <nav className="top-bar-navigation" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="top-bar-nav-link" aria-label={item.ariaLabel} aria-current={item.active ? "page" : undefined} onClick={item.href === COURSE_CATALOG_PATH ? openCatalog : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="top-bar-search"><SiteSearch /></div>
          <div className="top-bar-actions">
            <button className="top-bar-tool top-bar-search-toggle" type="button" aria-label="Search courses" aria-haspopup="dialog" onClick={() => setIsSearchOpen(true)} title="Search courses"><Search size={21} aria-hidden="true" /></button>
            <SiteOptions onOpenSettings={onOpenSettings} />
          </div>
        </div>
      </header>
      <Modal isOpen={isMenuOpen} title="Navigation" labelledById="site-navigation-title" className="site-navigation-dialog" size="sm" onClose={() => setIsMenuOpen(false)}>
        <nav aria-label="Primary navigation" className="site-mobile-navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-label={item.ariaLabel} aria-current={item.active ? "page" : undefined} onClick={(event) => {
              setIsMenuOpen(false);
              if (item.href === COURSE_CATALOG_PATH) openCatalog(event);
            }}><item.icon size={20} aria-hidden="true" />{item.label}</Link>
          ))}
        </nav>
      </Modal>
      <Modal isOpen={isSearchOpen} title="Find a course" labelledById="site-search-title" className="site-search-dialog" size="md" initialFocus='input[type="search"]' onClose={() => setIsSearchOpen(false)}><SiteSearch /></Modal>
    </>
  );
}
