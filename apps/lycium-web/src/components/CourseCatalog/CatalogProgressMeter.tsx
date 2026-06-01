export type CatalogProgressSummary = {
  percentage: number;
  viewedPercentage: number;
};

type CatalogProgressMeterProps = {
  progress: CatalogProgressSummary;
  variant: "course" | "path";
};

export default function CatalogProgressMeter({
  progress,
  variant,
}: CatalogProgressMeterProps) {
  const isCourse = variant === "course";

  return (
    <div className={isCourse ? "course-progress" : "program-showcase-progress"}>
      <div className={isCourse ? "course-progress-bar" : "program-showcase-progress-bar"}>
        <div
          className={isCourse ? "course-progress-viewed-fill" : "program-showcase-progress-viewed"}
          style={{ width: `${progress.viewedPercentage}%` }}
        />
        <div
          className={isCourse ? "course-progress-fill" : "program-showcase-progress-complete"}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      <p className={isCourse ? "course-progress-percentage" : undefined}>
        {Math.round(progress.percentage)}% complete &middot; {Math.round(progress.viewedPercentage)}% viewed
      </p>
    </div>
  );
}
