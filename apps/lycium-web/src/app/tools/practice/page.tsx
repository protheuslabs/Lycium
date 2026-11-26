import type { Metadata } from "next";
import PracticeWorkspace from "../../../components/Practice/PracticeWorkspace";

export const metadata: Metadata = { title: "Practice | Lycium" };

export default function PracticePage() {
  return <PracticeWorkspace />;
}
