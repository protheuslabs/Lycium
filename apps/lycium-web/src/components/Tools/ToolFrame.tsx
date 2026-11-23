import type { ReactNode } from "react";
import "./toolFrame.css";

type ToolFrameProps = {
  children: ReactNode;
  fill?: boolean;
  className?: string;
};

// Shared spacing for standalone workspaces and future inline or iframe hosts.
// Embed hosts can override the --lycium-tool-* spacing tokens on an ancestor.
export default function ToolFrame({ children, fill = false, className = "" }: ToolFrameProps) {
  return (
    <div className={`lycium-tool-frame${fill ? " lycium-tool-frame--fill" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
