import { Calculator } from "lucide-react";
import Link from "next/link";
import CatalogFooter from "../CatalogFooter/CatalogFooter";

export default function ToolsPage() {
  return (
    <div className="learner-page-shell">
      <main id="main-content" tabIndex={-1} className="tools-page learner-page-inner">
        <header className="tools-heading">
          <h1>Tools</h1>
          <p>Interactive workspaces for exploring ideas and building understanding.</p>
        </header>

        <section className="tools-directory" aria-labelledby="tools-directory-title">
          <h2 id="tools-directory-title" className="sr-only">Tool directory</h2>

          <Link href="/tools/graph" className="tools-link" aria-labelledby="graphing-studio-title">
            <article className="tool-entry">
              <div className="tool-entry-icon">
                <Calculator size={24} aria-hidden="true" />
              </div>
              <div>
                <div className="tool-entry-title">
                  <h3 id="graphing-studio-title">Graphing Studio</h3>
                  <span className="tool-entry-status">Ready</span>
                </div>
                <p>Plot and compare mathematical relationships in an interactive workspace.</p>
              </div>
            </article>
          </Link>
        </section>
      </main>
      <CatalogFooter />
    </div>
  );
}
