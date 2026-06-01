type CatalogProgressMeterProps = {
  percentage: number;
  viewedPercentage: number;
  variant: "course" | "path";
};

export default function CatalogProgressMeter({
  percentage,
  viewedPercentage,
  variant,
}: CatalogProgressMeterProps) {
  const isCourse = variant === "course";

  return (
    <div className={isCourse ? "course-progress" : "program-showcase-progress"}>
      <div className={isCourse ? "course-progress-bar" : "program-showcase-progress-bar"}>
        <div
          className={isCourse ? "course-progress-viewed-fill" : "program-showcase-progress-viewed"}
          style={{ width: `${viewedPercentage}%` }}
        />
        <div
          className={isCourse ? "course-progress-fill" : "program-showcase-progress-complete"}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className={isCourse ? "course-progress-percentage" : undefined}>
        {Math.round(percentage)}% complete &middot; {Math.round(viewedPercentage)}% viewed
      </p>
    </div>
  );
}
