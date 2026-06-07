type ProgressBarProps = {
  complete: number;
  viewed: number;
};

export default function ProgressBar({ complete, viewed }: ProgressBarProps) {
  return (
    <div className="progress-bar">
      <div className="progress-bar-viewed-fill" style={{ width: `${viewed}%` }} />
      <div className="progress-bar-fill" style={{ width: `${complete}%` }} />
    </div>
  );
}
