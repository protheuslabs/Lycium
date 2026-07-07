import type { LyciumQuizProgressRecord } from "@lycium/contracts";
import { describe, expect, it } from "vitest";
import { restoreQuizSession } from "./quizSession";
import type { NormalizedQuestion } from "./quizTypes";

const questionBank: NormalizedQuestion[] = [
  {
    prompt: "First?",
    options: ["No", "Yes"],
    correctAnswers: [1],
    isMultiple: false,
    timed: false,
  },
  {
    prompt: "Second?",
    options: ["Right", "Wrong"],
    correctAnswers: [0],
    isMultiple: false,
    timed: false,
  },
];

const attemptOrder = [
  { questionIndex: 0, optionOrder: [0, 1] },
  { questionIndex: 1, optionOrder: [1, 0] },
];

describe("restoreQuizSession", () => {
  it("creates a deterministic clean editor session", () => {
    const session = restoreQuizSession({
      isEditMode: true,
      questionBank,
      questionsPerAttempt: 2,
      persistedMarkers: [true, true],
      nowMs: 1_000,
    });

    expect(session.attemptOrder).toEqual([
      { questionIndex: 0, optionOrder: [0, 1] },
      { questionIndex: 1, optionOrder: [0, 1] },
    ]);
    expect(session.selectedByQuestion).toEqual([[], []]);
    expect(session.questionMarked).toEqual([false, false]);
    expect(session.attemptStarted).toBe(true);
    expect(session.startedAtMs).toBe(1_000);
  });

  it("restores an in-progress attempt and normalizes markers", () => {
    const session = restoreQuizSession({
      isEditMode: false,
      questionBank,
      questionsPerAttempt: 2,
      persistedProgress: {
        startedAt: "2026-01-01T00:00:00.000Z",
        attemptStarted: true,
        attemptCount: 1,
        attemptOrder,
      },
      persistedMarkers: [true],
      nowMs: Date.parse("2026-01-01T00:01:30.000Z"),
    });

    expect(session.attemptOrder).toEqual(attemptOrder);
    expect(session.selectedByQuestion).toEqual([[], []]);
    expect(session.questionMarked).toEqual([true, false]);
    expect(session.elapsedSeconds).toBe(90);
    expect(session.attemptCount).toBe(1);
    expect(session.attemptStarted).toBe(true);
    expect(session.submitted).toBe(false);
  });

  it("reconstructs missing history for a submitted attempt", () => {
    const session = restoreQuizSession({
      isEditMode: false,
      questionBank,
      questionsPerAttempt: 2,
      persistedProgress: {
        startedAt: "2026-01-01T00:00:00.000Z",
        submittedAt: "2026-01-01T00:00:42.000Z",
        submitted: true,
        attemptStarted: true,
        attemptCount: 2,
        elapsedSeconds: 42,
        attemptOrder,
        selectedByQuestion: [[1], [0]],
        questionCorrectness: [true, false],
      },
      persistedMarkers: [true, false, true],
      nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    });

    expect(session.submitted).toBe(true);
    expect(session.selectedByQuestion).toEqual([[1], [0]]);
    expect(session.questionCorrectness).toEqual([true, false]);
    expect(session.questionMarked).toEqual([true, false]);
    expect(session.attemptHistory).toEqual([
      expect.objectContaining({
        attemptNumber: 2,
        elapsedSeconds: 42,
        scorePercentage: 50,
        correctCount: 1,
        totalQuestions: 2,
      }),
    ]);
  });

  it("falls back to a waiting session for malformed legacy data", () => {
    const malformed = {
      startedAt: "not-a-date",
      attemptStarted: true,
      attemptCount: "many",
      attemptOrder: [{ questionIndex: 99, optionOrder: [0] }],
    } as unknown as LyciumQuizProgressRecord;

    const session = restoreQuizSession({
      isEditMode: false,
      questionBank,
      questionsPerAttempt: 2,
      persistedProgress: malformed,
      persistedMarkers: "invalid",
      nowMs: 5_000,
    });

    expect(session.attemptOrder).toEqual([]);
    expect(session.questionMarked).toEqual([]);
    expect(session.attemptCount).toBe(0);
    expect(session.attemptStarted).toBe(false);
    expect(session.startedAtMs).toBe(5_000);
  });
});
