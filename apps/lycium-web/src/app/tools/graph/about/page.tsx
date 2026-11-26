import type { Metadata } from "next";
import Link from "next/link";

const title = "Orvane Graphing Calculator | Capabilities and Agent Interface";
const description = "Learn what Orvane supports: function plotting, sliders, datasets, regression, intersections, tangent lines, and numerical integration.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["Orvane", "online graphing calculator", "function plotting", "numerical integration", "graphing for education"],
  alternates: { canonical: "https://protheuslabs.github.io/Lycium/tools/graph/about/" },
  openGraph: { title, description, type: "article", url: "https://protheuslabs.github.io/Lycium/tools/graph/about/", siteName: "Lycium" },
};

export default function OrvaneAboutPage() {
  return <main className="learner-page-inner" style={{ maxWidth: 860, margin: "0 auto", paddingBlock: "4rem" }}>
    <p><Link href="/tools/graph">← Open Orvane</Link></p>
    <h1>Orvane: a free online graphing calculator</h1>
    <p>Orvane is Lycium’s interactive graphing workspace for learners, instructors, and scientific exploration. It runs in the browser and keeps graphs editable while you explore them.</p>
    <h2>What Orvane can do</h2>
    <ul>
      <li>Plot explicit functions such as <code>y=x^2</code>, <code>y=sin(x)</code>, and restricted or piecewise expressions.</li>
      <li>Adjust parameters with interactive sliders and inspect intersections, intercepts, and tangent slopes.</li>
      <li>Enter datasets, display scatter plots, and fit linear or exponential regression models.</li>
      <li>Generate tables of values and estimate signed integrals or area between curves numerically.</li>
      <li>Pan, zoom, export, import, annotate, and share editable graph documents.</li>
    </ul>
    <h2>Who it is for</h2>
    <p>Orvane is designed for math and science courses where a visual, reusable graph is more useful than a one-time calculation. It is free to use and does not require an account for local graphing.</p>
    <h2>For AI agents and developers</h2>
    <p>The shared <code>graphAgent</code> module defines versioned, deterministic contracts for creating validated graph documents, analyzing them, and validating datasets. The current GitHub Pages deployment is static, so it does not expose a public HTTP or MCP server. A server adapter can call the same module when deployed with a JavaScript runtime.</p>
    <p><Link href="/tools/graph">Start graphing in Orvane →</Link></p>
  </main>;
}
