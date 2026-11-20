import type { Metadata } from "next";
import LibraryPreview from "../../components/LibraryPreview/LibraryPreview";

export const metadata: Metadata = { title: "Library Motion Study | Lycium" };

export default function LibraryPreviewPage() {
  return <LibraryPreview />;
}
