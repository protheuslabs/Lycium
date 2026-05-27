import type { ReactNode } from "react";
import Button from "../Button/Button";
import "./CourseNav.css";

type CourseNavProps = {
  centerControls?: ReactNode;
  nextSectionTitle?: string | null;
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
  nextSectionTitle,
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
    <div className="course-nav-block">
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
            <ArrowLeftIcon />
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
          <Button
            className="nav-button course-nav-arrow-button"
            variant="icon"
            iconOnly
            onClick={onNext}
            disabled={isLastSection || nextDisabled}
            aria-label="Next section"
          >
            <ArrowRightIcon />
          </Button>
          <p className="course-nav-up-next">
            {isLastSection ? "End of course" : `Up next: ${nextSectionTitle ?? "Next section"}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
