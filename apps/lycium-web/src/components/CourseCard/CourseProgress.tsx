type CourseProgressProps = {
  title: string;
  completed: number;
  total: number;
  showPercentage?: boolean;
  className?: string;
};

export default function CourseProgress({ title, completed, total, showPercentage = true, className = "" }: CourseProgressProps) {
  const count = Math.max(0, Math.min(completed, total));
  const percentage = total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div className={`learner-progress ${className}`}>
      <div className="learner-progress-label"><span>{count} of {total} sections complete</span>{showPercentage && <strong>{percentage}%</strong>}</div>
      <progress value={count} max={Math.max(1, total)} aria-label={`${title} completion`} />
    </div>
  );
}
