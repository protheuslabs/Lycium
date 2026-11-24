import { ArrowRight, Layers3 } from "lucide-react";
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
                <h3 id="graphing-studio-title">Graphing Studio</h3>
                <p id="graphing-studio-summary">Plot functions, compare datasets, and fit regression models.</p>
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
        </section>
      </main>
      <CatalogFooter />
    </div>
  );
}
