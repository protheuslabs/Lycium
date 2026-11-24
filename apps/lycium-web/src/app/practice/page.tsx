import type { Metadata } from "next";
import LyciumClientShell from "../LyciumClientShell";

export const metadata: Metadata = { title: "Practice | Lycium" };

export default function PracticePage() {
  return <LyciumClientShell initialPath="/practice" />;
}
