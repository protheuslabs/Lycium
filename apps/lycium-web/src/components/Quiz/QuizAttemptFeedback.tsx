import { CircleCheck, CircleAlert } from "lucide-react";
import type { AttemptHistoryItem } from "./quizTypes";

export default function QuizAttemptFeedback({ attempt, passPercentage }: {
  attempt: AttemptHistoryItem;
  passPercentage: number | null;
}) {
  const passed = passPercentage === null ? null : attempt.scorePercentage >= passPercentage;
  const Icon = passed === false ? CircleAlert : CircleCheck;
  const total = attempt.totalQuestions ?? attempt.questionCorrectness?.length;
  const correct = attempt.correctCount ?? attempt.questionCorrectness?.filter(Boolean).length;
  return (
    <section className="quiz-attempt-feedback" data-outcome={passed === null ? "submitted" : passed ? "passed" : "retry"} role="status" aria-label={`Attempt ${attempt.attemptNumber} result`}>
      <Icon size={24} aria-hidden="true" />
      <div>
        <h3>{passed === null ? "Attempt submitted" : passed ? "Passing score met" : "Below passing score"}</h3>
        <p>{Math.round(attempt.scorePercentage)}%{typeof correct === "number" && typeof total === "number" ? ` · ${correct} of ${total} correct` : ""}</p>
      </div>
      {passPercentage !== null && <span>{passPercentage}% required</span>}
    </section>
  );
}
