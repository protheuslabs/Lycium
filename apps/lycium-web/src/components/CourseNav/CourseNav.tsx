import type { ReactNode } from "react";
import Button from "../Button/Button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import "./CourseNav.css";

type CourseNavProps = {
  centerControls?: ReactNode;
  nextSectionTitle?: string | null;
  isFirstSection: boolean;
  isLastSection: boolean;
  nextDisabled: boolean;
  isComplete: boolean;
  canMarkComplete: boolean;
  completionRequirementsMet: boolean;
  completeButtonTitle: string;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
};

export default function CourseNav({
  centerControls,
  nextSectionTitle,
  isFirstSection,
  isLastSection,
  nextDisabled,
  isComplete,
  canMarkComplete,
  completionRequirementsMet,
  completeButtonTitle,
  onPrev,
  onNext,
  onComplete,
}: CourseNavProps) {
  return (
    <nav className="course-nav-block" aria-label="Section navigation">
      <div className="section-nav course-nav">
        <div className="nav-button-wrapper course-nav-left">
          <Button
            className="nav-button course-nav-arrow-button"
            variant="icon"
            iconOnly
            onClick={onPrev}
            disabled={isFirstSection}
            aria-label="Previous section"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>
        </div>
        <div className="nav-button-wrapper course-nav-right">
          <Button
            className={`nav-button complete-button ${isComplete ? "complete-button--checked" : ""} ${
              !isComplete && !completionRequirementsMet ? "complete-button--blocked" : ""
            }`}
            variant="standard"
            onClick={() => {
              if (canMarkComplete) {
                onComplete();
              }
            }}
            aria-disabled={isComplete || !completionRequirementsMet}
            disabled={isComplete || !canMarkComplete}
            aria-label={isComplete ? "Section complete" : "Mark section complete"}
            title={completeButtonTitle}
          >
            <Check size={18} aria-hidden="true" />
            <span>{isComplete ? "Completed" : "Mark complete"}</span>
          </Button>
          <Button
            className="nav-button course-nav-arrow-button"
            variant="icon"
            iconOnly
            onClick={onNext}
            disabled={isLastSection || nextDisabled}
            aria-label="Next section"
          >
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p className="course-nav-up-next">
        {isLastSection ? "End of course" : `Up next: ${nextSectionTitle ?? "Next section"}`}
      </p>
      {centerControls && <div className="course-nav-center">{centerControls}</div>}
    </nav>
  );
}
