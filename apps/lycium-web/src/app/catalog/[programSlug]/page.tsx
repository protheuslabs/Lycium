import LyciumClientShell from "../../LyciumClientShell";
import { getStaticCatalogProgramParams } from "../../staticCatalogParams";

export const dynamicParams = false;

export function generateStaticParams() {
  return getStaticCatalogProgramParams();
}

export default function CatalogProgramPage() {
  return <LyciumClientShell />;
}
