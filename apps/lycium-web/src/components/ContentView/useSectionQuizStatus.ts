import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  QuizProgressStatus,
  QuizProgressStatusHandler,
  QuizSubmissionStatusHandler,
  Section,
} from "./contentViewTypes";

export function useSectionQuizStatus({
  section,
  isComplete,
  onQuizSectionPassed,
  onSectionTimedStatusChange,
}: {
  section: Section | null;
  isComplete: boolean;
  onQuizSectionPassed?: (sectionId: string) => void;
  onSectionTimedStatusChange?: (sectionId: string, hasTimedQuizInProgress: boolean) => void;
}) {
  const quizBlockKeys = useMemo(() => {
    if (!section) {
      return [];
    }

    return section.content
      .map((block, index) => (block.type === "quiz" ? `quiz-${section.id}-${index}` : null))
      .filter((quizKey): quizKey is string => quizKey !== null);
  }, [section]);

  const [submittedQuizKeys, setSubmittedQuizKeys] = useState<Set<string>>(() => new Set());
  const [passedQuizKeys, setPassedQuizKeys] = useState<Set<string>>(() => new Set());
  const [quizProgressByKey, setQuizProgressByKey] = useState<Record<string, QuizProgressStatus>>({});

  useEffect(() => {
    setSubmittedQuizKeys(new Set());
    setPassedQuizKeys(new Set());
    setQuizProgressByKey({});
  }, [section?.id]);

  const handleQuizSubmissionChange = useCallback<QuizSubmissionStatusHandler>((quizKey, submitted) => {
    setSubmittedQuizKeys((previous) => {
      if (submitted === previous.has(quizKey)) {
        return previous;
      }

      const next = new Set(previous);
      if (submitted) {
        next.add(quizKey);
      } else {
        next.delete(quizKey);
      }
      return next;
    });
  }, []);

  const handleQuizProgressChange = useCallback<QuizProgressStatusHandler>((quizKey, status) => {
    setPassedQuizKeys((previous) => {
      if (status.passed === previous.has(quizKey)) {
        return previous;
      }

      const next = new Set(previous);
      if (status.passed) {
        next.add(quizKey);
      } else {
        next.delete(quizKey);
      }
      return next;
    });

    setQuizProgressByKey((previous) => {
      const existing = previous[quizKey];
      if (
        existing &&
        existing.submitted === status.submitted &&
        existing.inProgress === status.inProgress &&
        existing.timed === status.timed &&
        existing.passed === status.passed
      ) {
        return previous;
      }

      return { ...previous, [quizKey]: status };
    });
  }, []);

  const requiresQuizSubmission = quizBlockKeys.length > 0;
  const allRequiredQuizzesSubmitted =
    !requiresQuizSubmission || quizBlockKeys.every((quizKey) => submittedQuizKeys.has(quizKey));
  const allRequiredQuizzesPassed =
    !requiresQuizSubmission || quizBlockKeys.every((quizKey) => passedQuizKeys.has(quizKey));
  const hasTimedQuizInProgress = quizBlockKeys.some((quizKey) => {
    const status = quizProgressByKey[quizKey];
    return Boolean(status && status.timed && status.inProgress && !status.submitted);
  });

  useEffect(() => {
    if (section?.id && requiresQuizSubmission && allRequiredQuizzesPassed && !isComplete) {
      onQuizSectionPassed?.(section.id);
    }
  }, [allRequiredQuizzesPassed, isComplete, onQuizSectionPassed, requiresQuizSubmission, section?.id]);

  useEffect(() => {
    if (section?.id) {
      onSectionTimedStatusChange?.(section.id, hasTimedQuizInProgress);
    }
  }, [hasTimedQuizInProgress, onSectionTimedStatusChange, section?.id]);

  return {
    allRequiredQuizzesSubmitted: allRequiredQuizzesPassed,
    canMarkComplete: !isComplete && !requiresQuizSubmission,
    completeButtonTitle: isComplete
      ? "Section complete"
      : requiresQuizSubmission
        ? allRequiredQuizzesSubmitted
          ? "Reach the quiz passing score to complete this page"
          : "Begin and submit the quiz to complete this page"
        : "Mark section complete",
    handleQuizProgressChange,
    handleQuizSubmissionChange,
  };
}
