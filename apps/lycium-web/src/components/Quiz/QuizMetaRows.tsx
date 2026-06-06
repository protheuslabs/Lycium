import type { AttemptHistoryItem } from "./quizTypes";
import { formatDuration } from "./quizAttempts";
import { EditPencilButton, promptForText } from "../ContentView/CourseEditControls";

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
  isEditMode?: boolean;
  onMaxAttemptsChange?: (value: string) => void;
  onTimeLimitChange?: (value: string) => void;
  onPassPercentageChange?: (value: string) => void;
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
  isEditMode = false,
  onMaxAttemptsChange,
  onTimeLimitChange,
  onPassPercentageChange,
  onReviewAttemptChange,
}: QuizMetaRowsProps) {
  const editAttempts = (currentValue: string) => {
    promptForText("Edit max attempts", maxAttempts === null ? "" : currentValue.split("/")[1] ?? "", (value) => onMaxAttemptsChange?.(value));
  };
  const editTime = () => {
    promptForText("Edit time limit in seconds", timerDuration === null ? "" : String(timerDuration), (value) => onTimeLimitChange?.(value));
  };
  const editPassingScore = () => {
    promptForText("Edit passing score percent", passPercentage === null ? "" : String(passPercentage), (value) => onPassPercentageChange?.(value));
  };

  return (
    <div className="quiz-meta-stack" aria-label="Quiz metadata">
      {historicalAttempts.map((attempt) => (
        <div
          role="button"
          tabIndex={0}
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
            {formatDuration(attempt.elapsedSeconds)}/{timerDuration === null ? "∞" : formatDuration(timerDuration)}
          </span>
        </div>
      ))}

      <div
        role="button"
        tabIndex={0}
        className={`quiz-meta-row quiz-meta-row--current ${!isReviewingPastAttempt ? "quiz-meta-row--active" : ""}`}
        onClick={() => onReviewAttemptChange(null)}
      >
        <span className="quiz-meta-edit-field">
          Attempt {attemptsLabel}
          {isEditMode && (
            <EditPencilButton
              label="Edit max attempts"
              onClick={() => editAttempts(attemptsLabel)}
            />
          )}
        </span>
        {currentAttemptResult ? (
          <span className={`quiz-score ${scoreClassFor(currentAttemptResult.scorePercentage, passPercentage)}`}>
            Score: {formatScore(currentAttemptResult)}
          </span>
        ) : passPercentage !== null ? (
          <span className="quiz-score quiz-score--neutral quiz-meta-edit-field">
            Passing score: {formatPassingScore(passPercentage, displayedQuestionCount)}
            {isEditMode && (
              <EditPencilButton
                label="Edit passing score"
                onClick={editPassingScore}
              />
            )}
          </span>
        ) : (
          <span className="quiz-score quiz-score--neutral quiz-meta-edit-field">
            Passing score: ∞
            {isEditMode && (
              <EditPencilButton
                label="Edit passing score"
                onClick={editPassingScore}
              />
            )}
          </span>
        )}
        <span className="quiz-meta-edit-field">
          {currentAttemptResult
            ? `${formatDuration(currentAttemptResult.elapsedSeconds)}/${timerDuration === null ? "∞" : formatDuration(timerDuration)}`
            : timeLabel}
          {isEditMode && (
            <EditPencilButton
              label="Edit time limit"
              onClick={editTime}
            />
          )}
        </span>
      </div>
    </div>
  );
}
