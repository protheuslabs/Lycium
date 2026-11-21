import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserStorageRepository } from "@lycium/data-access";
import { useClientMounted } from "../../hooks/useClientMounted";
import QuizMetaRows from "./QuizMetaRows";
import QuizQuestionList from "./QuizQuestionList";
import QuizAttemptFeedback from "./QuizAttemptFeedback";
import { useQuizEditor } from "./quizEditor";
import {
  areSelectionsCorrect,
  attemptSignature,
  buildAttemptQuestions,
  createAttemptOrder,
  formatDuration,
  secondsSince,
} from "./quizAttempts";
import {
  extractMaxAttempts,
  extractPassPercentage,
  extractQuestionsPerAttempt,
  extractTimeLimit,
  normalizeBoolean,
  normalizePayload,
  shouldShowAnswersFromPayload,
} from "./quizNormalization";
import { restoreQuizSession } from "./quizSession";
import type { QuizPayload } from "./quizTypes";
const browserStorage = createBrowserStorageRepository();

type QuizBlockProps = {
  data: QuizPayload;
  name: string;
  storageKey?: string;
  isEditMode?: boolean;
  onDataChange?: (data: QuizPayload) => void;
  onSubmissionChange?: (quizKey: string, submitted: boolean) => void;
  onProgressChange?: (
    quizKey: string,
    status: {
      submitted: boolean;
      inProgress: boolean;
      timed: boolean;
      passed: boolean;
    },
  ) => void;
};

export default function QuizBlock(props: QuizBlockProps) {
  const isClientMounted = useClientMounted();
  if (!isClientMounted) {
    return <div className="quiz-block" />;
  }

  const sessionKey = `${props.storageKey ?? props.name}:${props.name}:${props.isEditMode === true}:${JSON.stringify(props.data)}`;
  return <ClientQuizBlock key={sessionKey} {...props} />;
}

function ClientQuizBlock({
  data,
  name,
  storageKey = name,
  isEditMode = false,
  onDataChange,
  onSubmissionChange,
  onProgressChange,
}: QuizBlockProps) {
  const questionBank = useMemo(() => normalizePayload(data), [data]);
  const questionsPerAttempt = useMemo(
    () => extractQuestionsPerAttempt(data, questionBank.length),
    [data, questionBank.length],
  );
  const [initialSession] = useState(() => {
    try {
      return restoreQuizSession({
        isEditMode,
        questionBank,
        questionsPerAttempt,
        persistedProgress: browserStorage.readQuizProgress(storageKey, name),
        persistedMarkers: browserStorage.readQuizMarkers(storageKey, name),
      });
    } catch {
      return restoreQuizSession({ isEditMode, questionBank, questionsPerAttempt });
    }
  });
  const [attemptOrder, setAttemptOrder] = useState(initialSession.attemptOrder);
  const questionsWithTiming = useMemo(
    () =>
      buildAttemptQuestions(questionBank, attemptOrder).map((question) => ({
        ...question,
        timed: question.timed || normalizeBoolean(data.timed),
      })),
    [attemptOrder, data.timed, questionBank],
  );
  const isTimed = questionsWithTiming.some((question) => question.timed);
  const timerDuration = extractTimeLimit(data);
  const maxAttempts = extractMaxAttempts(data);
  const passPercentage = extractPassPercentage(data);
  const showAnswers = shouldShowAnswersFromPayload(data);
  const [selectedByQuestion, setSelectedByQuestion] = useState(initialSession.selectedByQuestion);
  const [submitted, setSubmitted] = useState(initialSession.submitted);
  const [questionCorrectness, setQuestionCorrectness] = useState(
    initialSession.questionCorrectness,
  );
  const [questionMarked, setQuestionMarked] = useState(initialSession.questionMarked);
  const [attemptCount, setAttemptCount] = useState(initialSession.attemptCount);
  const [attemptHistory, setAttemptHistory] = useState(initialSession.attemptHistory);
  const [reviewAttemptNumber, setReviewAttemptNumber] = useState(
    initialSession.reviewAttemptNumber,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(initialSession.elapsedSeconds);
  const [startedAtMs, setStartedAtMs] = useState(initialSession.startedAtMs);
  const [attemptStarted, setAttemptStarted] = useState(initialSession.attemptStarted);
  const [unsureByQuestion, setUnsureByQuestion] = useState(initialSession.unsureByQuestion);
  const [questionView, setQuestionView] = useState(initialSession.questionView);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialSession.currentQuestionIndex);

  useEffect(() => {
    onSubmissionChange?.(name, initialSession.submitted);
  }, [initialSession, name, onSubmissionChange]);

  const handleSubmit = useCallback(() => {
    if (!attemptStarted) {
      return;
    }
    const results = questionsWithTiming.map((question, idx) => {
      const selected = selectedByQuestion[idx] ?? [];
      return areSelectionsCorrect(question.correctAnswers, selected);
    });
    const finalElapsedSeconds = secondsSince(startedAtMs);
    const normalizedElapsedSeconds =
      timerDuration === null ? finalElapsedSeconds : Math.min(finalElapsedSeconds, timerDuration);
    const scorePercentage =
      questionsWithTiming.length > 0
        ? (results.filter(Boolean).length / questionsWithTiming.length) * 100
        : 0;
    const passed = passPercentage === null || scorePercentage >= passPercentage;
    const correctCount = results.filter(Boolean).length;
    const totalQuestions = questionsWithTiming.length;
    const nextAttemptCount = attemptCount + 1;
    const nextAttemptHistory = [
      ...attemptHistory,
      {
        attemptNumber: nextAttemptCount,
        elapsedSeconds: normalizedElapsedSeconds,
        scorePercentage,
        correctCount,
        totalQuestions,
        submittedAt: new Date().toISOString(),
        attemptOrder,
        selectedByQuestion,
        unsureByQuestion,
        questionCorrectness: results,
      },
    ];

    setQuestionCorrectness(results);
    setSubmitted(true);
    setElapsedSeconds(normalizedElapsedSeconds);
    setAttemptCount(nextAttemptCount);
    setAttemptHistory(nextAttemptHistory);
    setQuestionView("all");
    setCurrentQuestionIndex(0);
    browserStorage.writeQuizProgress(storageKey, name, {
      startedAt: new Date(startedAtMs).toISOString(),
      submittedAt: new Date().toISOString(),
      submitted: true,
      attemptStarted: true,
      attemptCount: nextAttemptCount,
      attemptHistory: nextAttemptHistory,
      elapsedSeconds: normalizedElapsedSeconds,
      selectedByQuestion,
      unsureByQuestion,
      questionView: "all",
      currentQuestionIndex: 0,
      questionCorrectness: results,
      attemptOrder,
      attemptSignature: attemptSignature(attemptOrder),
    });
    onSubmissionChange?.(name, true);
    onProgressChange?.(name, {
      submitted: true,
      inProgress: false,
      timed: timerDuration !== null || isTimed,
      passed,
    });
  }, [
    attemptCount,
    attemptHistory,
    attemptOrder,
    attemptStarted,
    isTimed,
    name,
    onProgressChange,
    onSubmissionChange,
    passPercentage,
    questionsWithTiming,
    selectedByQuestion,
    unsureByQuestion,
    startedAtMs,
    storageKey,
    timerDuration,
  ]);

  useEffect(() => {
    if (isEditMode || submitted || !attemptStarted) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = secondsSince(startedAtMs);
      const next = timerDuration !== null ? Math.min(elapsed, timerDuration) : elapsed;
      setElapsedSeconds(next);
      if (timerDuration !== null && next >= timerDuration) {
        clearInterval(interval);
        handleSubmit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [attemptStarted, handleSubmit, isEditMode, startedAtMs, submitted, timerDuration]);

  const allQuestionsAnswered = questionsWithTiming.every(
    (_, idx) => (selectedByQuestion[idx] ?? []).length > 0 || unsureByQuestion[idx] === true,
  );
  const attemptLimitReached = maxAttempts !== null && attemptCount >= maxAttempts;
  const canTryAgain = submitted && !attemptLimitReached;
  const canSubmit =
    !isEditMode && attemptStarted && !submitted && !attemptLimitReached && allQuestionsAnswered;
  const currentAttempt = submitted || attemptLimitReached ? attemptCount : attemptCount + 1;
  const attemptsLabel = maxAttempts === null ? `${currentAttempt} · Unlimited attempts` : `${currentAttempt}/${maxAttempts}`;
  const timeLabel = timerDuration === null ? `Elapsed ${formatDuration(elapsedSeconds)}` : `${formatDuration(elapsedSeconds)}/${formatDuration(timerDuration)}`;
  const hasQuizProgress =
    attemptStarted ||
    selectedByQuestion.some((selection) => selection.length > 0) ||
    unsureByQuestion.some(Boolean) ||
    attemptHistory.length > 0;
  const isQuizInProgress = !submitted && hasQuizProgress;
  const reviewAttempt = attemptHistory.find(
    (attempt) => attempt.attemptNumber === reviewAttemptNumber,
  );
  const displayedQuestions = reviewAttempt?.attemptOrder
    ? buildAttemptQuestions(questionBank, reviewAttempt.attemptOrder)
    : questionsWithTiming;
  const displayedSelectedByQuestion = reviewAttempt?.selectedByQuestion ?? selectedByQuestion;
  const displayedQuestionCorrectness = reviewAttempt?.questionCorrectness ?? questionCorrectness;
  const displayedUnsureByQuestion = reviewAttempt?.unsureByQuestion ?? unsureByQuestion;
  const isReviewingPastAttempt = Boolean(reviewAttempt);
  const displayedAttemptNumber = reviewAttempt?.attemptNumber ?? attemptCount;
  const shouldRevealAnswers =
    (submitted || isReviewingPastAttempt) &&
    (showAnswers || (maxAttempts !== null && displayedAttemptNumber >= maxAttempts));
  const historicalAttempts = submitted ? attemptHistory.slice(0, -1) : attemptHistory;
  const currentAttemptResult = submitted ? attemptHistory[attemptHistory.length - 1] : null;
  const currentAttemptPassed = Boolean(
    currentAttemptResult &&
      (passPercentage === null || currentAttemptResult.scorePercentage >= passPercentage),
  );

  const {
    addAnswer,
    deleteAnswer,
    deleteQuestion,
    editAnswer,
    editQuestion,
    editorDisplayedQuestions,
    promptAddQuestion,
    setCorrectAnswer,
    toggleQuestionMultiple,
    updateQuizData,
  } = useQuizEditor({ data, questionBank, onDataChange });
  const activeDisplayedQuestions = isEditMode ? editorDisplayedQuestions : displayedQuestions;
  const plannedQuestionCount =
    activeDisplayedQuestions.length || questionsPerAttempt || questionBank.length;
  const answeredCount = displayedSelectedByQuestion.filter((selection) => selection.length > 0).length;
  const unsureCount = unsureByQuestion.filter(Boolean).length;
  const displayedResult = reviewAttempt ?? currentAttemptResult;
  const shouldShowAttemptStart =
    !isEditMode && !submitted && !attemptStarted && !isReviewingPastAttempt;
  const shouldShowTopNextAttempt = submitted && canTryAgain && !isReviewingPastAttempt;

  useEffect(() => {
    onProgressChange?.(name, {
      submitted,
      inProgress: isQuizInProgress,
      timed: timerDuration !== null || isTimed,
      passed: currentAttemptPassed,
    });
  }, [
    currentAttemptPassed,
    isQuizInProgress,
    isTimed,
    name,
    onProgressChange,
    submitted,
    timerDuration,
  ]);

  const toggleQuestionMarker = (questionIndex: number) => {
    setQuestionMarked((prev) => {
      const nextState = [...prev];
      nextState[questionIndex] = !nextState[questionIndex];
      browserStorage.writeQuizMarkers(storageKey, name, nextState);
      return nextState;
    });
  };

  const handleOptionSelect = (questionIndex: number, optionIndex: number, multiple: boolean) => {
    if (!attemptStarted || submitted || isReviewingPastAttempt) {
      return;
    }

    const nextState = selectedByQuestion.map((selection) => [...selection]);
    const nextUnsure = [...unsureByQuestion];
    nextUnsure[questionIndex] = false;
    const selected = nextState[questionIndex] ?? [];
    if (multiple) {
      nextState[questionIndex] = selected.includes(optionIndex)
        ? selected.filter((item) => item !== optionIndex)
        : [...selected, optionIndex];
    } else {
      nextState[questionIndex] = [optionIndex];
    }
    setSelectedByQuestion(nextState);
    setUnsureByQuestion(nextUnsure);
    browserStorage.writeQuizProgress(storageKey, name, {
      startedAt: new Date(startedAtMs).toISOString(),
      attemptCount,
      attemptHistory,
      submitted: false,
      attemptStarted: true,
      attemptOrder,
      attemptSignature: attemptSignature(attemptOrder),
      selectedByQuestion: nextState,
      unsureByQuestion: nextUnsure,
      questionView,
      currentQuestionIndex,
    });
  };

  const handleUnsure = (questionIndex: number) => {
    if (!attemptStarted || submitted || isReviewingPastAttempt) return;
    const nextUnsure = [...unsureByQuestion];
    nextUnsure[questionIndex] = !nextUnsure[questionIndex];
    const nextSelections = selectedByQuestion.map((selection) => [...selection]);
    if (nextUnsure[questionIndex]) nextSelections[questionIndex] = [];
    setUnsureByQuestion(nextUnsure);
    setSelectedByQuestion(nextSelections);
    browserStorage.writeQuizProgress(storageKey, name, {
      startedAt: new Date(startedAtMs).toISOString(), attemptCount, attemptHistory,
      submitted: false, attemptStarted: true, attemptOrder,
      attemptSignature: attemptSignature(attemptOrder), selectedByQuestion: nextSelections,
      unsureByQuestion: nextUnsure, questionView, currentQuestionIndex,
    });
  };

  const persistAttemptView = (nextView: "single" | "all", nextIndex: number) => {
    browserStorage.writeQuizProgress(storageKey, name, {
      startedAt: new Date(startedAtMs).toISOString(), attemptCount, attemptHistory,
      submitted: false, attemptStarted: true, attemptOrder,
      attemptSignature: attemptSignature(attemptOrder), selectedByQuestion,
      unsureByQuestion, questionView: nextView, currentQuestionIndex: nextIndex,
    });
  };

  const handleBeginAttempt = () => {
    if (attemptLimitReached || questionBank.length === 0) {
      return;
    }
    const previousAttempt =
      attemptHistory.length > 0 ? attemptHistory[attemptHistory.length - 1] : null;
    const previousAttemptSignature =
      attemptOrder.length > 0
        ? attemptSignature(attemptOrder)
        : previousAttempt?.attemptOrder
          ? attemptSignature(previousAttempt.attemptOrder)
          : null;
    const nextAttemptOrder = createAttemptOrder(
      questionBank,
      questionsPerAttempt,
      previousAttemptSignature,
    );
    setAttemptStarted(true);
    setSubmitted(false);
    setQuestionCorrectness([]);
    setReviewAttemptNumber(null);
    setAttemptOrder(nextAttemptOrder);
    setSelectedByQuestion(nextAttemptOrder.map(() => []));
    setUnsureByQuestion(nextAttemptOrder.map(() => false));
    setCurrentQuestionIndex(0);
    setQuestionMarked(Array(nextAttemptOrder.length).fill(false));
    const nextStartedAtMs = Date.now();
    setStartedAtMs(nextStartedAtMs);
    setElapsedSeconds(0);
    browserStorage.removeQuizMarkers(storageKey, name);
    browserStorage.writeQuizProgress(storageKey, name, {
      startedAt: new Date(nextStartedAtMs).toISOString(),
      attemptCount,
      attemptHistory,
      submitted: false,
      attemptStarted: true,
      attemptOrder: nextAttemptOrder,
      attemptSignature: attemptSignature(nextAttemptOrder),
      previousAttemptSignature: previousAttemptSignature ?? undefined,
      unsureByQuestion: nextAttemptOrder.map(() => false),
      questionView,
      currentQuestionIndex: 0,
    });
    onSubmissionChange?.(name, false);
  };

  const handlePrimaryButton = () => {
    if (isReviewingPastAttempt) {
      setReviewAttemptNumber(null);
      return;
    }

    if (submitted) {
      if (canTryAgain) {
        handleBeginAttempt();
      }
      return;
    }

    if (canSubmit) {
      handleSubmit();
    }
  };

  if (questionBank.length === 0) {
    return (
      <div className="quiz-block">
        <p className="quiz-result quiz-incorrect">No quiz questions were found in this block.</p>
      </div>
    );
  }

  return (
    <div className="quiz-block">
      <QuizMetaRows
        name={name}
        historicalAttempts={historicalAttempts}
        currentAttemptResult={currentAttemptResult}
        reviewAttemptNumber={reviewAttemptNumber}
        maxAttempts={maxAttempts}
        passPercentage={passPercentage}
        timerDuration={timerDuration}
        attemptsLabel={attemptsLabel}
        timeLabel={timeLabel}
        isReviewingPastAttempt={isReviewingPastAttempt}
        displayedQuestionCount={plannedQuestionCount}
        isEditMode={isEditMode}
        onMaxAttemptsChange={(value) => updateQuizData({ ...data, maxAttempts: value })}
        onTimeLimitChange={(value) => updateQuizData({ ...data, timeLimit: value })}
        onPassPercentageChange={(value) => updateQuizData({ ...data, passPercentage: value })}
        onReviewAttemptChange={setReviewAttemptNumber}
      />

      {!isEditMode && displayedResult && <QuizAttemptFeedback attempt={displayedResult} passPercentage={passPercentage} />}
      {!isEditMode && attemptStarted && !submitted && !isReviewingPastAttempt && (
        <div className="quiz-answer-progress" role="status">
          <span>{answeredCount} of {plannedQuestionCount} answered{unsureCount ? ` · ${unsureCount} unsure` : ""}</span>
          <progress value={answeredCount} max={Math.max(1, plannedQuestionCount)} aria-label="Questions answered" />
        </div>
      )}

      {!isEditMode && attemptStarted && !submitted && !isReviewingPastAttempt && activeDisplayedQuestions.length > 1 && (
        <div className="quiz-view-controls">
          <div role="group" aria-label="Question layout">
            <button type="button" aria-pressed={questionView === "single"} onClick={() => { setQuestionView("single"); persistAttemptView("single", currentQuestionIndex); }}>One at a time</button>
            <button type="button" aria-pressed={questionView === "all"} onClick={() => { setQuestionView("all"); persistAttemptView("all", currentQuestionIndex); }}>All questions</button>
          </div>
          {questionView === "single" && <span>Question {currentQuestionIndex + 1} of {activeDisplayedQuestions.length}</span>}
        </div>
      )}

      {shouldShowTopNextAttempt && (
        <div className="quiz-actions quiz-actions--next-attempt">
          <button type="button" className="quiz-button" onClick={handleBeginAttempt}>
            {`Begin attempt #${attemptCount + 1}`}
          </button>
        </div>
      )}

      {shouldShowAttemptStart ? (
        <div className="quiz-start-panel">
          <p>{plannedQuestionCount} {plannedQuestionCount === 1 ? "question" : "questions"} · {timerDuration === null ? "No time limit" : `${formatDuration(timerDuration)} time limit`}</p>
          <button
            type="button"
            className="quiz-button"
            disabled={attemptLimitReached}
            onClick={handleBeginAttempt}
          >
            {attemptLimitReached ? "Attempts used" : `Begin attempt #${attemptCount + 1}`}
          </button>
        </div>
      ) : (
        <QuizQuestionList
          name={name}
          questions={activeDisplayedQuestions}
          selectedByQuestion={displayedSelectedByQuestion}
          questionCorrectness={displayedQuestionCorrectness}
          questionMarked={questionMarked}
          hasMultipleQuestions={activeDisplayedQuestions.length > 1}
          submitted={submitted}
          isEditMode={isEditMode}
          isReviewingPastAttempt={isReviewingPastAttempt}
          shouldRevealAnswers={shouldRevealAnswers}
          questionView={questionView}
          currentQuestionIndex={currentQuestionIndex}
          unsureByQuestion={displayedUnsureByQuestion}
          onUnsure={handleUnsure}
          onToggleQuestionMarker={toggleQuestionMarker}
          onOptionSelect={handleOptionSelect}
          onQuestionEdit={(questionIndex, prompt) => editQuestion(questionIndex, prompt)}
          onQuestionDelete={deleteQuestion}
          onQuestionAdd={promptAddQuestion}
          onAnswerEdit={editAnswer}
          onAnswerDelete={deleteAnswer}
          onAnswerAdd={addAnswer}
          onQuestionMultipleChange={toggleQuestionMultiple}
          onCorrectAnswerChange={setCorrectAnswer}
        />
      )}

      {!isEditMode && attemptStarted && !submitted && !isReviewingPastAttempt && questionView === "single" && activeDisplayedQuestions.length > 1 && (
        <div className="quiz-question-navigation" aria-label="Question navigation">
          <button type="button" disabled={currentQuestionIndex === 0} onClick={() => { const index = currentQuestionIndex - 1; setCurrentQuestionIndex(index); persistAttemptView("single", index); }}>Previous question</button>
          <button type="button" disabled={currentQuestionIndex === activeDisplayedQuestions.length - 1} onClick={() => { const index = currentQuestionIndex + 1; setCurrentQuestionIndex(index); persistAttemptView("single", index); }}>Next question</button>
        </div>
      )}

      {!shouldShowAttemptStart && !shouldShowTopNextAttempt && (
        <div className="quiz-actions">
          <button
            type="button"
            className="quiz-button"
            onClick={handlePrimaryButton}
            disabled={isEditMode || (!isReviewingPastAttempt && !canSubmit && !canTryAgain)}
          >
            {isReviewingPastAttempt
              ? "Back to current attempt"
              : submitted
                ? canTryAgain
                  ? `Begin attempt #${attemptCount + 1}`
                  : "Attempts used"
                : "Submit"}
          </button>
        </div>
      )}
    </div>
  );
}
