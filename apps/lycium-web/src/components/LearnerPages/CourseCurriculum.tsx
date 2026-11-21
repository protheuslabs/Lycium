import { useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, ChevronsDownUp, ChevronsUpDown, CircleDot, ClipboardCheck, LockKeyhole } from "lucide-react";
import type { CourseEntry, CourseSection } from "../../courseTypes";
import { sectionLearningType } from "../../utils/coursePresentation";
import { stripModulePrefix } from "../CourseEditing/courseEditPrimitives";

export default function CourseCurriculum({ course, sectionStatuses, onOpenSection }: {
  course: CourseEntry;
  sectionStatuses?: Record<string, string>;
  onOpenSection: (course: CourseEntry, section: CourseSection) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>(() => course.data.modules.slice(0, 1).map((module) => module.id));
  const allExpanded = course.data.modules.length > 0 && course.data.modules.every((module) => expanded.includes(module.id));
  return (
    <section id="curriculum" className="overview-curriculum" aria-labelledby="curriculum-title">
      <div className="overview-section-heading">
        <h2 id="curriculum-title">Course curriculum</h2>
        {course.data.modules.length > 1 && (
          <button className="overview-expand" type="button" onClick={() => setExpanded(allExpanded ? [] : course.data.modules.map((module) => module.id))}>
            {allExpanded ? <ChevronsDownUp size={16} aria-hidden="true" /> : <ChevronsUpDown size={16} aria-hidden="true" />}
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      {course.data.modules.map((module, index) => {
        const completed = module.sections.filter((section) => sectionStatuses?.[section.id] === "completed").length;
        return (
        <details className="overview-module" key={module.id} open={expanded.includes(module.id)}>
          <summary onClick={(event) => {
            event.preventDefault();
            setExpanded((current) => current.includes(module.id) ? current.filter((id) => id !== module.id) : [...current, module.id]);
          }}>
            <span className="overview-module-number">{String(index + 1).padStart(2, "0")}</span>
            <span>{stripModulePrefix(module.title)}<small>{module.sections.length} {module.sections.length === 1 ? "section" : "sections"}</small></span>
            <span className="overview-module-completion">
              <span>{completed}/{module.sections.length} complete</span>
              <progress value={completed} max={Math.max(1, module.sections.length)} aria-label={`${stripModulePrefix(module.title)} sections completed`} />
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <ol>{module.sections.map((section, sectionIndex) => {
            const locked = sectionStatuses?.[section.id] === "locked";
            const completed = sectionStatuses?.[section.id] === "completed";
            const viewed = ["seen", "timed"].includes(sectionStatuses?.[section.id] ?? "");
            const type = sectionLearningType(section);
            const status = completed ? "Completed" : locked ? "Locked" : viewed ? "Viewed" : "Not started";
            const ActivityIcon = type === "Quiz" || type === "Project" || type === "Assessment" ? ClipboardCheck : BookOpen;
            const StateIcon = completed ? CheckCircle2 : viewed ? CircleDot : ActivityIcon;
            return (
              <li key={section.id} data-state={status.toLowerCase().replace(" ", "-")}>
                <button type="button" disabled={locked} aria-describedby={`curriculum-status-${section.id}`} onClick={() => onOpenSection(course, section)}>
                  <span className="overview-section-number">{index + 1}.{sectionIndex + 1}</span>
                  <span className="overview-section-identity"><StateIcon size={18} aria-hidden="true" /><span>{section.title}</span></span>
                  <small aria-hidden="true">{completed || viewed ? status : type}</small>
                  {locked ? <LockKeyhole size={16} aria-label="Locked" /> : <ArrowRight size={16} aria-hidden="true" />}
                </button>
                <span id={`curriculum-status-${section.id}`} className="catalog-sr-only">{type}. {status}.</span>
              </li>
            );
          })}</ol>
        </details>
        );
      })}
    </section>
  );
}
