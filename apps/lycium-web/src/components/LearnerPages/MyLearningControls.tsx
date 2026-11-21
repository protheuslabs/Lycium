import { Search, SlidersHorizontal } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { LearningSort, LearningView } from "../../utils/learningLibrary";

type Props = {
  view: LearningView; query: string; subject: string; sort: LearningSort; subjects: string[];
  counts: { active: number; completed: number; all: number };
  onViewChange: (view: LearningView) => void; onQueryChange: (query: string) => void;
  onSubjectChange: (subject: string) => void; onSortChange: (sort: LearningSort) => void;
};

const views: Array<{ value: LearningView; label: string }> = [
  { value: "active", label: "In progress" }, { value: "completed", label: "Completed" }, { value: "all", label: "All courses" },
];

export default function MyLearningControls({ view, query, subject, sort, subjects, counts, onViewChange, onQueryChange, onSubjectChange, onSortChange }: Props) {
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    onViewChange(views[nextIndex].value);
    document.getElementById(`learning-tab-${views[nextIndex].value}`)?.focus();
  }
  return <div className="learning-course-controls">
    <div className="learning-tabs" role="tablist" aria-label="Course progress">
      {views.map((item, index) => <button key={item.value} type="button" role="tab" id={`learning-tab-${item.value}`} aria-label={item.label} aria-selected={view === item.value} aria-controls="learning-course-panel" tabIndex={view === item.value ? 0 : -1} onKeyDown={(event) => handleTabKey(event, index)} onClick={() => onViewChange(item.value)}>{item.label}<span className="learning-tab-count">{counts[item.value]}</span></button>)}
    </div>
    <div className="learning-course-filters">
      <label className="learning-search"><Search size={17} aria-hidden="true" /><input type="search" placeholder="Search your courses" aria-label="Search your courses" value={query} onChange={(event) => onQueryChange(event.target.value)} /></label>
      <label className="learning-select"><span className="sr-only">Filter your courses by subject</span><SlidersHorizontal size={16} aria-hidden="true" /><select aria-label="Filter your courses by subject" value={subject} onChange={(event) => onSubjectChange(event.target.value)}><option value="all">All subjects</option>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="learning-select"><span className="sr-only">Sort your courses</span><select aria-label="Sort your courses" value={sort} onChange={(event) => onSortChange(event.target.value as LearningSort)}><option value="title">Course title</option><option value="progress">Most complete</option></select></label>
    </div>
  </div>;
}
