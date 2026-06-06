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
  onSectionTimedStatusChange,
}: {
  section: Section | null;
  isComplete: boolean;
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
  const [quizProgressByKey, setQuizProgressByKey] = useState<Record<string, QuizProgressStatus>>({});

  useEffect(() => {
    setSubmittedQuizKeys(new Set());
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
    setQuizProgressByKey((previous) => {
      const existing = previous[quizKey];
      if (
        existing &&
        existing.submitted === status.submitted &&
        existing.inProgress === status.inProgress &&
        existing.timed === status.timed
      ) {
        return previous;
      }

      return { ...previous, [quizKey]: status };
    });
  }, []);

  const requiresQuizSubmission = quizBlockKeys.length > 0;
  const allRequiredQuizzesSubmitted =
    !requiresQuizSubmission || quizBlockKeys.every((quizKey) => submittedQuizKeys.has(quizKey));
  const hasTimedQuizInProgress = quizBlockKeys.some((quizKey) => {
    const status = quizProgressByKey[quizKey];
    return Boolean(status && status.timed && status.inProgress && !status.submitted);
  });

  useEffect(() => {
    if (section?.id) {
      onSectionTimedStatusChange?.(section.id, hasTimedQuizInProgress);
    }
  }, [hasTimedQuizInProgress, onSectionTimedStatusChange, section?.id]);

  return {
    allRequiredQuizzesSubmitted,
    canMarkComplete: !isComplete && allRequiredQuizzesSubmitted,
    completeButtonTitle: isComplete
      ? "Section complete"
      : requiresQuizSubmission && !allRequiredQuizzesSubmitted
        ? "Submit the quiz before marking this page complete"
        : "Mark section complete",
    handleQuizProgressChange,
    handleQuizSubmissionChange,
  };
}
