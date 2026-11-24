import type { Metadata } from "next";
import LyciumClientShell from "../LyciumClientShell";

export const metadata: Metadata = { title: "Assessments | Lycium" };

export default function AssessmentsPage() {
  return <LyciumClientShell initialPath="/assessments" />;
}
