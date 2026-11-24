import type { Metadata } from "next";
import LyciumClientShell from "../LyciumClientShell";

export const metadata: Metadata = { title: "Courses | Lycium" };

export default function CatalogPage() {
  return <LyciumClientShell initialPath="/Lycium/catalog" />;
}
