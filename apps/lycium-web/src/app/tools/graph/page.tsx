import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GraphingStudio from "../../../components/Tools/GraphingStudio";
import ToolFrame from "../../../components/Tools/ToolFrame";

const siteRoot = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://protheuslabs.github.io/Lycium").replace(/\/$/, "");
const basePath = (process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium").replace(/\/$/, "");
const siteUrl = siteRoot.endsWith(basePath) ? siteRoot : `${siteRoot}${basePath}`;
const graphUrl = `${siteUrl}/tools/graph/`;
const title = "Orvane | Free Online Graphing Calculator | Lycium";
const description = "Graph functions, explore sliders and intersections, plot data, and fit regression models with Orvane, Lycium's free online graphing calculator.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "online graphing calculator",
    "function grapher",
    "graphing tool",
    "plot functions",
    "linear regression graph",
    "math graphing calculator",
  ],
  alternates: {
    canonical: graphUrl,
  },
  openGraph: {
    title,
    description,
    type: "website",
    url: graphUrl,
    siteName: "Lycium",
  },
  twitter: { card: "summary", title, description },
};

export default function GraphPage() {
  return (
    <div className="graphing-workspace">
      <a className="skip-link" href="#main-content">Skip to graphing workspace</a>
      <header className="graphing-workspace-header">
        <Link href="/tools" className="graphing-back-link"><ArrowLeft size={16} aria-hidden="true" />Lycium Tools</Link>
        <h1>Orvane</h1>
        <p className="graphing-workspace-description">An interactive online graphing calculator for functions, datasets, and regression.</p>
        <div id="graphing-workspace-actions" />
      </header>
      <main id="main-content" tabIndex={-1} className="graphing-workspace-main">
        <p className="sr-only">Orvane is a free online graphing calculator for plotting functions, exploring sliders and intersections, and visualizing data with regression models.</p>
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
            name: "Orvane",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            description,
            url: graphUrl,
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: 0 },
          }),
        }}
      />
    </div>
  );
}
