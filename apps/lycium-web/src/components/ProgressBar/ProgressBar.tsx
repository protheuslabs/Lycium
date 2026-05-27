type ProgressBarProps = {
  complete: number;
  viewed: number;
  animate: boolean;
};

export default function ProgressBar({ complete, viewed, animate }: ProgressBarProps) {
  const transition = animate ? undefined : "none";

  return (
    <div className="progress-bar">
      <div className="progress-bar-viewed-fill" style={{ transition, width: `${viewed}%` }} />
      <div className="progress-bar-fill" style={{ transition, width: `${complete}%` }} />
    </div>
  );
}
