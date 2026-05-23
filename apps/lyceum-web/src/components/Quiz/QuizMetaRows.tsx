import type { AttemptHistoryItem } from "./quizTypes";
import { formatDuration } from "./quizAttempts";

type QuizMetaRowsProps = {
  name: string;
  historicalAttempts: AttemptHistoryItem[];
  currentAttemptResult: AttemptHistoryItem | null;
  reviewAttemptNumber: number | null;
  maxAttempts: number | null;
  passPercentage: number | null;
  timerDuration: number | null;
  attemptsLabel: string;
  timeLabel: string;
  isReviewingPastAttempt: boolean;
  displayedQuestionCount: number;
  onReviewAttemptChange: (attemptNumber: number | null) => void;
};

function scoreClassFor(scorePercentage: number, passPercentage: number | null) {
  if (passPercentage === null) {
    return "quiz-score--neutral";
  }

  return scorePercentage >= passPercentage ? "quiz-score--pass" : "quiz-score--fail";
}

function formatScore(attempt: AttemptHistoryItem) {
  const fallbackTotalQuestions = attempt.questionCorrectness?.length ?? attempt.attemptOrder?.length ?? null;
  const totalQuestions =
    typeof attempt.totalQuestions === "number" && attempt.totalQuestions > 0
      ? attempt.totalQuestions
      : fallbackTotalQuestions;
  const correctCount =
    typeof attempt.correctCount === "number"
      ? attempt.correctCount
      : attempt.questionCorrectness?.filter(Boolean).length;

  if (typeof correctCount === "number" && typeof totalQuestions === "number" && totalQuestions > 0) {
    return `${correctCount}/${totalQuestions} ${Math.round(attempt.scorePercentage)}%`;
  }

  return `${Math.round(attempt.scorePercentage)}%`;
}

function formatPassingScore(passPercentage: number | null, displayedQuestionCount: number) {
  if (passPercentage === null) {
    return "";
  }

  if (displayedQuestionCount === 0) {
    return `${Math.round(passPercentage)}%`;
  }

  const requiredCorrect = Math.ceil((passPercentage / 100) * displayedQuestionCount);
  return `${requiredCorrect}/${displayedQuestionCount} ${Math.round(passPercentage)}%`;
}

export default function QuizMetaRows({
  name,
  historicalAttempts,
  currentAttemptResult,
  reviewAttemptNumber,
  maxAttempts,
  passPercentage,
  timerDuration,
  attemptsLabel,
  timeLabel,
  isReviewingPastAttempt,
  displayedQuestionCount,
  onReviewAttemptChange,
}: QuizMetaRowsProps) {
  return (
    <div className="quiz-meta-stack" aria-label="Quiz metadata">
      {historicalAttempts.map((attempt) => (
        <button
          type="button"
          className={`quiz-meta-row quiz-meta-row--submitted ${
            reviewAttemptNumber === attempt.attemptNumber ? "quiz-meta-row--active" : ""
          }`}
          key={`${name}-attempt-${attempt.attemptNumber}`}
          onClick={() => onReviewAttemptChange(attempt.attemptNumber)}
        >
          <span>Attempt {attempt.attemptNumber}/{maxAttempts ?? "∞"}</span>
          <span className={`quiz-score ${scoreClassFor(attempt.scorePercentage, passPercentage)}`}>
            Score: {formatScore(attempt)}
          </span>
          <span>
            Time: {formatDuration(attempt.elapsedSeconds)}/{timerDuration === null ? "∞" : formatDuration(timerDuration)}
          </span>
        </button>
      ))}

      <button
        type="button"
        className={`quiz-meta-row quiz-meta-row--current ${!isReviewingPastAttempt ? "quiz-meta-row--active" : ""}`}
        onClick={() => onReviewAttemptChange(null)}
      >
        <span>Attempt {attemptsLabel}</span>
        {currentAttemptResult ? (
          <span className={`quiz-score ${scoreClassFor(currentAttemptResult.scorePercentage, passPercentage)}`}>
            Score: {formatScore(currentAttemptResult)}
          </span>
        ) : passPercentage !== null ? (
          <span className="quiz-score quiz-score--neutral">
            Passing score: {formatPassingScore(passPercentage, displayedQuestionCount)}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <span>
          Time: {currentAttemptResult
            ? `${formatDuration(currentAttemptResult.elapsedSeconds)}/${timerDuration === null ? "∞" : formatDuration(timerDuration)}`
            : timeLabel}
        </span>
      </button>
    </div>
  );
}
