import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type Props = { title: string; backHref?: string; actions?: ReactNode; description?: ReactNode; className?: string };

export default function ToolWorkspaceHeader({ title, backHref = "/tools", actions, description, className = "" }: Props) {
  return <header className={`tool-workspace-header ${className}`.trim()}>
    <Link href={backHref} className="tool-workspace-back"><ArrowLeft size={16} aria-hidden="true" />Lycium Tools</Link>
    <h1>{title}</h1>
    {description}
    {actions}
  </header>;
}
