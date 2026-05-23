import "./CatalogFooter.css";

type CatalogFooterProps = {
  brand?: string;
  note?: string;
};

export default function CatalogFooter({
  brand = "Lycium",
  note = "Build focused courses, track progress, and keep learning moving.",
}: CatalogFooterProps) {
  return (
    <footer className="catalog-footer" aria-label="Catalog footer">
      <div className="catalog-footer-brand">{brand}</div>
      <p>{note}</p>
    </footer>
  );
}
