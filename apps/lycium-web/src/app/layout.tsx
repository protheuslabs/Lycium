import type { Metadata } from "next";
import Script from "next/script";
import "../styles/tokens.css";
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
import "../components/Legal/LegalPage.css";

export const metadata: Metadata = {
  title: "Lycium",
  description: "A contract-first learning runtime for source-backed generated courses.",
};

const themeBootstrapScript = `
(() => {
  try {
    const storedMode = window.localStorage.getItem("lycium-theme-mode");
    const mode = storedMode === "light" || storedMode === "dark" || storedMode === "auto" ? storedMode : "auto";
    const resolvedTheme = mode === "auto"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.setAttribute("data-theme-mode", mode);
    document.documentElement.style.colorScheme = resolvedTheme;
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-theme-mode", "auto");
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script
          id="lycium-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        {children}
      </body>
    </html>
  );
}
