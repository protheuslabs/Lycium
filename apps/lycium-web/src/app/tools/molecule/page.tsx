import type { Metadata } from "next";
import MoleculeStudio from "../../../components/Molecule/MoleculeStudio";
import ToolFrame from "../../../components/Tools/ToolFrame";
import ToolWorkspaceHeader from "../../../components/Tools/ToolWorkspaceHeader";

export const metadata: Metadata = {
  title: "Molecule Studio | 2D Lewis Structure Builder | Lycium",
  description: "Build and explore Lewis structures with atoms, bonds, lone pairs, formal charges, molecular formulas, and molar masses.",
};

export default function MoleculePage() {
  return <div className="molecule-workspace">
    <a className="skip-link" href="#main-content">Skip to molecular workspace</a>
    <ToolWorkspaceHeader title="Molecule Studio" />
    <main id="main-content" tabIndex={-1} className="molecule-workspace-main">
      <ToolFrame fill className="molecule-tool-frame"><MoleculeStudio /></ToolFrame>
    </main>
  </div>;
}
