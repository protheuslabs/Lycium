import type { Metadata } from "next";
import PeriodicTableTool from "../../../components/PeriodicTable/PeriodicTableTool";
import ToolFrame from "../../../components/Tools/ToolFrame";
import ToolWorkspaceHeader from "../../../components/Tools/ToolWorkspaceHeader";

export const metadata: Metadata = {
  title: "Interactive Periodic Table | Lycium",
  description: "Explore all 118 chemical elements, electron configurations, atomic properties, periodic trends, and side-by-side comparisons.",
};

export default function PeriodicTablePage() {
  return <div className="periodic-tool-workspace"><ToolWorkspaceHeader title="Periodic Table" /><main id="main-content"><ToolFrame fill><PeriodicTableTool /></ToolFrame></main></div>;
}
