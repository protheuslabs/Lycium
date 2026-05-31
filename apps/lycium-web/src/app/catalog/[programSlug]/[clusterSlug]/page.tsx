import LyciumClientShell from "../../../LyciumClientShell";
import { getStaticCatalogClusterParams } from "../../../staticCatalogParams";

export const dynamicParams = false;

export function generateStaticParams() {
  return getStaticCatalogClusterParams();
}

export default function CatalogProgramClusterPage() {
  return <LyciumClientShell />;
}
