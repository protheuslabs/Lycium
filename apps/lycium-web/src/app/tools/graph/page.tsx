import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GraphingStudio from "../../../components/Tools/GraphingStudio";
import ToolFrame from "../../../components/Tools/ToolFrame";

export const metadata: Metadata = {
  title: "Online Graphing Calculator | Graphing Studio | Lycium",
  description: "Plot functions, compare datasets, and explore mathematical relationships with Lycium's free online graphing calculator.",
  keywords: [
    "online graphing calculator",
    "function grapher",
    "graphing tool",
    "plot functions",
    "linear regression graph",
    "math graphing calculator",
  ],
  alternates: {
    canonical: "https://protheuslabs.github.io/Lycium/tools/graph",
  },
  openGraph: {
    title: "Online Graphing Calculator | Graphing Studio",
    description: "Plot functions, compare datasets, and explore mathematical relationships in Lycium's interactive graphing workspace.",
    type: "website",
  },
};

export default function GraphPage() {
  return (
    <div className="graphing-workspace">
      <a className="skip-link" href="#main-content">Skip to graphing workspace</a>
      <header className="graphing-workspace-header">
        <Link href="/tools" className="graphing-back-link"><ArrowLeft size={16} aria-hidden="true" />Back to Tools</Link>
        <h1>Graphing Studio</h1>
        <p className="graphing-workspace-description">An interactive online graphing calculator for functions, datasets, and regression.</p>
        <div id="graphing-workspace-actions" />
      </header>
      <main id="main-content" tabIndex={-1} className="graphing-workspace-main">
        <p className="sr-only">Graphing Studio is an interactive online graphing calculator for plotting functions, comparing curves, exploring parameters, and visualizing scientific data.</p>
        <ToolFrame fill className="graphing-tool-frame">
          <GraphingStudio workspace />
        </ToolFrame>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Lycium Graphing Studio",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            description: "Interactive online graphing calculator for plotting functions, comparing datasets, and exploring regression.",
            url: "https://protheuslabs.github.io/Lycium/tools/graph",
            isAccessibleForFree: true,
          }),
        }}
      />
    </div>
  );
}
