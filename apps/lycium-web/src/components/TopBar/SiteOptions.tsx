import { useId, useRef, useState, type MouseEvent } from "react";
import { Ellipsis, Settings, SquarePen } from "lucide-react";
import Link from "next/link";
import { SETTINGS_PATH, STUDIO_PATH } from "../../utils/courseRouting";

export default function SiteOptions({ onOpenSettings }: {
  onOpenSettings?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const id = useId();
  const popover = useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button className="top-bar-tool" type="button" popoverTarget={id} aria-label="More options" title="More options" aria-expanded={isOpen} onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          popover.current?.showPopover();
          popover.current?.querySelector("a")?.focus();
        }
      }}><Ellipsis size={22} aria-hidden="true" /></button>
      <nav ref={popover} id={id} popover="auto" className="site-options-popover" aria-label="Site options" onToggle={(event) => setIsOpen(event.newState === "open")}>
        <Link href={STUDIO_PATH} onClick={() => popover.current?.hidePopover()}><SquarePen size={18} aria-hidden="true" />Studio</Link>
        <Link href={SETTINGS_PATH} aria-label="Settings" onClick={(event) => {
          popover.current?.hidePopover();
          onOpenSettings?.(event);
        }}><Settings size={18} aria-hidden="true" />Settings</Link>
      </nav>
    </>
  );
}
