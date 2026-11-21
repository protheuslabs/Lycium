import { ArrowRight, ClipboardCheck } from "lucide-react";
import type { CourseEntry, CourseSection } from "../../courseTypes";
import { selectPendingPractice, type LearningCourse } from "../../utils/learningLibrary";

export default function PracticeList({ items, onOpenSection }: {
  items: LearningCourse[];
  onOpenSection: (course: CourseEntry, section: CourseSection) => void;
}) {
  const pending = selectPendingPractice(items);
  if (!pending.length) return null;
  return (
    <section className="practice-list" aria-labelledby="practice-title">
      <h2 id="practice-title">Practice &amp; assessment</h2>
      <div>
        {pending.map((item) => (
          <button type="button" key={item.course.key} onClick={() => onOpenSection(item.course, item.section)} aria-label={`Open ${item.type}: ${item.section.title}`}>
            <ClipboardCheck size={19} aria-hidden="true" />
            <span className="practice-list-copy"><span>{item.course.title}</span><strong>{item.section.title}</strong></span>
            <span className="practice-list-type">{item.type}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
