import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GraphingStudio from "../../../components/Tools/GraphingStudio";
import ToolFrame from "../../../components/Tools/ToolFrame";

export default function GraphPage() {
  return (
    <div className="graphing-workspace">
      <a className="skip-link" href="#main-content">Skip to graphing workspace</a>
      <header className="graphing-workspace-header">
        <Link href="/tools" className="graphing-back-link"><ArrowLeft size={16} aria-hidden="true" />Back to Tools</Link>
        <h1>Graphing Studio</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="graphing-workspace-main">
        <ToolFrame fill>
          <GraphingStudio workspace />
        </ToolFrame>
      </main>
    </div>
  );
}
