import { useEffect, useRef } from "react";

function scrollToSection(nav: HTMLElement | null, id: string) {
    const pane = nav?.closest<HTMLElement>(".learner-page-shell");
    const target = document.getElementById(id);
    if (!nav || !pane || !target || !pane.contains(target)) return;
    const top = pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - nav.offsetHeight;
    // Native hash scrolling also moves overflow-hidden ancestors and hides the top bar.
    const app = pane.closest<HTMLElement>(".app-root");
    if (app) app.scrollTop = 0;
    window.scrollTo(0, 0);
    pane.scrollTo({ top: Math.max(0, top), behavior: "auto" });
}

export default function OverviewNavigation({ hasOutcomes, hasRequirements }: {
  hasOutcomes: boolean;
  hasRequirements: boolean;
}) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const onHashChange = () => scrollToSection(navigation.current, window.location.hash.slice(1));
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const links = [
    { id: "overview", label: "Overview" },
    ...(hasOutcomes ? [{ id: "learning-outcomes", label: "What you'll learn" }] : []),
    { id: "curriculum", label: "Curriculum" },
    ...(hasRequirements ? [{ id: "requirements", label: "Requirements" }] : []),
  ];
  return (
    <nav ref={navigation} className="overview-jump-nav" aria-label="Course overview sections">
      <div>{links.map(({ id, label }) => <a key={id} href={`#${id}`} onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        event.preventDefault();
        window.history.pushState(window.history.state, "", `#${id}`);
        scrollToSection(navigation.current, id);
      }}>{label}</a>)}</div>
    </nav>
  );
}
