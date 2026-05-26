
type CatalogFooterProps = {
  brand?: string;
  note?: string;
};

export default function CatalogFooter({
  brand = "Lycium",
  note = "Lycium",
}: CatalogFooterProps) {
  return (
    <footer className="catalog-footer" aria-label="Catalog footer">
      <div className="catalog-footer-brand">{brand}</div>
      <div className="catalog-footer-meta">
        <p>{note}</p>
        <nav className="catalog-footer-social" aria-label="Social media">
          <a
            className="catalog-footer-social-link"
            href="https://github.com/protheuslabs/Lycium"
            aria-label="Lycium GitHub repository"
            target="_blank"
            rel="noreferrer"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.5v-1.9c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.93c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.82-4.57 5.08.36.32.69.96.69 1.94v2.77c0 .28.18.6.69.5A10.13 10.13 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
            </svg>
          </a>
        </nav>
      </div>
    </footer>
  );
}
