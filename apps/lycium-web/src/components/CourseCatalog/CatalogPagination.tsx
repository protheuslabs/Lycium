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
        <button
          className="catalog-pagination-button"
          type="button"
          onClick={() => onPageChange(Math.max(1, activePage - 1))}
          disabled={activePage === 1}
        >
          Previous
        </button>
        <span className="catalog-pagination-page">
          Page {activePage} of {totalPages}
        </span>
        <button
          className="catalog-pagination-button"
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, activePage + 1))}
          disabled={activePage === totalPages}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
