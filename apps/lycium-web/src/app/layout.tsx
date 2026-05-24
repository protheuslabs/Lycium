import type { Metadata } from "next";
import "../index.css";
import "../App.css";
import "../components/TopBar/topBar.css";
import "../components/ContentView/contentView.css";
import "../components/Video/VideoBlock.css";
import "../components/Quiz/quiz.css";
import "../components/CourseCatalog/CourseCatalog.css";
import "../components/CourseCatalog/CourseCatalog.create.css";
import "../components/CourseCatalog/CourseCatalog.info.css";
import "../components/Dropdown/Dropdown.css";
import "../components/CatalogFooter/CatalogFooter.css";
import "../components/Sidebar/Sidebar.css";
import "../components/SettingsModal/SettingsModal.css";
import "../components/SettingsModal/SettingsModal.theme.css";

export const metadata: Metadata = {
  title: "Lycium",
  description: "A contract-first learning runtime for source-backed generated courses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
