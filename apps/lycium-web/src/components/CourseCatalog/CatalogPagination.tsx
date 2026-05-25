type CatalogPaginationProps = {
  activePage: number;
  firstVisibleResult: number;
  lastVisibleResult: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
};

export default function CatalogPagination({
  activePage,
  firstVisibleResult,
  lastVisibleResult,
  totalPages,
  totalResults,
  onPageChange,
}: CatalogPaginationProps) {
  return (
    <nav className="catalog-pagination" aria-label="Course catalog pagination">
      <p className="catalog-pagination-summary">
        Showing {firstVisibleResult}-{lastVisibleResult} of {totalResults}
      </p>
      <div className="catalog-pagination-controls">
        <div className="catalog-pagination-pill catalog-pagination-pill--left" aria-label="Previous catalog pages">
          <button
            className="catalog-pagination-button catalog-pagination-button--icon"
            type="button"
            onClick={() => onPageChange(1)}
            disabled={activePage === 1}
            aria-label="Go to first catalog page"
            title="First page"
          >
            <span aria-hidden="true">«</span>
          </button>
          <button
            className="catalog-pagination-button catalog-pagination-button--icon"
            type="button"
            onClick={() => onPageChange(Math.max(1, activePage - 1))}
            disabled={activePage === 1}
            aria-label="Go to previous catalog page"
            title="Previous page"
          >
            <span aria-hidden="true">‹</span>
          </button>
        </div>
        <span className="catalog-pagination-page">
          Page {activePage} of {totalPages}
        </span>
        <div className="catalog-pagination-pill catalog-pagination-pill--right" aria-label="Next catalog pages">
          <button
            className="catalog-pagination-button catalog-pagination-button--icon"
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, activePage + 1))}
            disabled={activePage === totalPages}
            aria-label="Go to next catalog page"
            title="Next page"
          >
            <span aria-hidden="true">›</span>
          </button>
          <button
            className="catalog-pagination-button catalog-pagination-button--icon"
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={activePage === totalPages}
            aria-label="Go to last catalog page"
            title="Last page"
          >
            <span aria-hidden="true">»</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
