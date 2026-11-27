import { ArrowRight, Atom, Layers3 } from "lucide-react";
import Link from "next/link";
import CatalogFooter from "../CatalogFooter/CatalogFooter";

export default function ToolsPage() {
  return (
    <div className="learner-page-shell">
      <main id="main-content" tabIndex={-1} className="learner-page-inner learner-directory-page">
        <header className="learner-directory-heading">
          <h1 className="learner-display-heading">Tools</h1>
          <p>Interactive workspaces for graphing and scientific exploration.</p>
        </header>

        <section className="tools-directory" aria-labelledby="tools-directory-title">
          <h2 id="tools-directory-title" className="sr-only">Tool directory</h2>

          <Link
            href="/tools/graph"
            className="tools-link"
            aria-labelledby="graphing-studio-title"
            aria-describedby="graphing-studio-summary"
          >
            <article className="tool-entry">
              <div className="tool-entry-preview">
                <svg className="tool-graph-preview" viewBox="0 0 320 160" role="img" aria-label="Graph preview with a quadratic curve and sine wave">
                  <path className="tool-graph-grid" d="M16 24.5H304M16 56.5H304M16 88.5H304M16 120.5H304M48.5 16V144M96.5 16V144M144.5 16V144M192.5 16V144M240.5 16V144M288.5 16V144" />
                  <path className="tool-graph-axis" d="M16 88.5H304M144.5 16V144" />
                  <path className="tool-graph-curve tool-graph-curve-a" d="M23 35C62 61 92 102 118 125C130 136 138 140 145 140C152 140 160 136 172 125C198 102 228 61 297 35" />
                  <path className="tool-graph-curve tool-graph-curve-b" d="M18 73C36 54 54 54 72 73S108 92 126 73S162 54 180 73S216 92 234 73S270 54 298 73" />
                  <circle className="tool-graph-point" cx="192" cy="101" r="4" />
                </svg>
              </div>
              <div className="tool-entry-content">
                <h3 id="graphing-studio-title">Orvane</h3>
                <p id="graphing-studio-summary">Free graphing calculator for functions, datasets, and regression models.</p>
                <span className="tool-entry-action" aria-hidden="true">
                  Open workspace <ArrowRight size={16} />
                </span>
              </div>
            </article>
          </Link>
          <Link href="/tools/flashcards" className="tools-link" aria-labelledby="flashcards-title" aria-describedby="flashcards-summary">
            <article className="tool-entry">
              <div className="tool-entry-preview tool-flashcards-preview" aria-hidden="true">
                <div className="tool-flashcard-shape tool-flashcard-back" />
                <div className="tool-flashcard-shape tool-flashcard-front"><Layers3 size={32} /></div>
              </div>
              <div className="tool-entry-content">
                <h3 id="flashcards-title">Flashcards</h3>
                <p id="flashcards-summary">Create study decks and practice recall with focused review sessions.</p>
                <span className="tool-entry-action" aria-hidden="true">Open workspace <ArrowRight size={16} /></span>
              </div>
            </article>
          </Link>
          <Link href="/tools/molecule" className="tools-link" aria-labelledby="molecule-title" aria-describedby="molecule-summary">
            <article className="tool-entry">
              <div className="tool-entry-preview tool-molecule-preview" aria-hidden="true">
                <svg viewBox="0 0 300 160">
                  <defs>
                    <radialGradient id="tool-water-oxygen" cx="34%" cy="28%" r="72%"><stop offset="0" stopColor="#fb7185" /><stop offset=".48" stopColor="#dc3545" /><stop offset="1" stopColor="#9f1d2c" /></radialGradient>
                    <radialGradient id="tool-water-hydrogen" cx="35%" cy="28%" r="72%"><stop offset="0" stopColor="#ffffff" /><stop offset=".58" stopColor="#dbeafe" /><stop offset="1" stopColor="#8aa4c5" /></radialGradient>
                    <filter id="tool-water-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#111827" floodOpacity=".18" /></filter>
                  </defs>
                  <g className="tool-water-bonds" filter="url(#tool-water-shadow)"><line x1="129" y1="85" x2="80" y2="119" /><line x1="171" y1="85" x2="220" y2="119" /></g>
                  <g className="tool-water-atoms" filter="url(#tool-water-shadow)">
                    <circle className="tool-water-hydrogen" cx="65" cy="129" r="25" /><circle className="tool-water-hydrogen" cx="235" cy="129" r="25" />
                    <circle className="tool-water-oxygen" cx="150" cy="69" r="43" />
                    <ellipse className="tool-water-highlight" cx="136" cy="52" rx="13" ry="9" />
                  </g>
                  <g className="tool-water-electrons"><circle cx="125" cy="18" r="3" /><circle cx="135" cy="14" r="3" /><circle cx="165" cy="14" r="3" /><circle cx="175" cy="18" r="3" /></g>
                </svg>
              </div>
              <div className="tool-entry-content"><h3 id="molecule-title">Molecule Studio</h3><p id="molecule-summary">Construct Lewis structures with bonds, lone pairs, charges, formulas, and molar masses.</p><span className="tool-entry-action" aria-hidden="true">Open workspace <ArrowRight size={16} /></span></div>
            </article>
          </Link>
          <Link href="/tools/periodic-table" className="tools-link" aria-labelledby="periodic-table-title" aria-describedby="periodic-table-summary">
            <article className="tool-entry">
              <div className="tool-entry-preview tool-periodic-preview" aria-hidden="true">
                <div className="tool-periodic-mini-grid">{["H","He","Li","Be","B","C","N","O","F","Ne","Na","Mg","Al","Si","P","S","Cl","Ar"].map((symbol,index) => <span key={symbol} data-accent={symbol === "O"}>{index + 1}<b>{symbol}</b></span>)}</div>
                <Atom className="tool-periodic-orbit" size={38} />
              </div>
              <div className="tool-entry-content"><h3 id="periodic-table-title">Periodic Table</h3><p id="periodic-table-summary">Explore elements, electron configurations, physical properties, and periodic trends.</p><span className="tool-entry-action" aria-hidden="true">Open reference <ArrowRight size={16} /></span></div>
            </article>
          </Link>
        </section>
      </main>
      <CatalogFooter />
    </div>
  );
}
