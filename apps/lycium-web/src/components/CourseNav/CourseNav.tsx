import type { ReactNode } from "react";
import Button from "../Button/Button";
import "./CourseNav.css";

type CourseNavProps = {
  centerControls?: ReactNode;
  isFirstSection: boolean;
  isLastSection: boolean;
  nextDisabled: boolean;
  isComplete: boolean;
  canMarkComplete: boolean;
  allRequiredQuizzesSubmitted: boolean;
  completeButtonTitle: string;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
};

export default function CourseNav({
  centerControls,
  isFirstSection,
  isLastSection,
  nextDisabled,
  isComplete,
  canMarkComplete,
  allRequiredQuizzesSubmitted,
  completeButtonTitle,
  onPrev,
  onNext,
  onComplete,
}: CourseNavProps) {
  return (
    <div className="section-nav course-nav">
      <div className="nav-button-wrapper course-nav-left">
        <Button className="nav-button" variant="nav" onClick={onPrev} disabled={isFirstSection}>
          Previous
        </Button>
      </div>
      {centerControls && <div className="course-nav-center">{centerControls}</div>}
      <div className="nav-button-wrapper course-nav-right">
        <Button
          className={`nav-button complete-button ${isComplete ? "complete-button--checked" : ""} ${
            !isComplete && !allRequiredQuizzesSubmitted ? "complete-button--blocked" : ""
          }`}
          variant="complete"
          onClick={() => {
            if (canMarkComplete) {
              onComplete();
            }
          }}
          aria-disabled={isComplete || !allRequiredQuizzesSubmitted}
          aria-label={isComplete ? "Section complete" : "Mark section complete"}
          title={completeButtonTitle}
        >
          <span className="complete-button-check" aria-hidden="true">
            ✓
          </span>
        </Button>
        <Button className="nav-button" variant="nav" onClick={onNext} disabled={isLastSection || nextDisabled}>
          Next
        </Button>
      </div>
    </div>
  );
}
