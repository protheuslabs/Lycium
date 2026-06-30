type CatalogEmptyStateProps = {
  level: "clusters" | "courses" | "programs";
};

export default function CatalogEmptyState({ level }: CatalogEmptyStateProps) {
  return (
    <div className="catalog-empty-state" aria-live="polite">
      <p>No matching {level}. Try a different search term or filter.</p>
    </div>
  );
}
