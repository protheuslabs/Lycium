// QuizBlock.jsx
// AI-assisted: interactive quiz with single- and multi-answer support.

import { useState } from "react";
import "./quiz.css"

export default function QuizBlock({ data, name }) {
  const { question, options = [], answer, answers } = data;

  const isMultiple = Array.isArray(answers);
  const correctIndices = isMultiple ? answers : [answer];

  const [selected, setSelected] = useState(isMultiple ? [] : null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  function handleSingleChange(index) {
    if (submitted) return;
    setSelected(index);
  }

  function handleMultiChange(index) {
    if (submitted) return;
    setSelected((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      return [...prev, index];
    });
  }

  function handleSubmit() {
    if (submitted) return;

    let ok = false;

    if (isMultiple) {
      const selectedSorted = [...selected].sort();
      const correctSorted = [...correctIndices].sort();
      ok =
        selectedSorted.length === correctSorted.length &&
        selectedSorted.every((val, i) => val === correctSorted[i]);
    } else {
      ok = selected === correctIndices[0];
    }

    setIsCorrect(ok);
    setSubmitted(true);
  }

  function handleTryAgain() {
    setSubmitted(false);
    setIsCorrect(null);
    setSelected(isMultiple ? [] : null);
  }

  return (
    <div className="quiz-block">
      <h4 className="quiz-question">{question}</h4>

      <div className="quiz-options">
        {options.map((opt, index) => (
          <label key={index} className="quiz-option">
            <input
              type={isMultiple ? "checkbox" : "radio"}
              name={name}
              value={index}
              checked={
                isMultiple ? selected.includes(index) : selected === index
              }
              onChange={() =>
                isMultiple
                  ? handleMultiChange(index)
                  : handleSingleChange(index)
              }
              disabled={submitted && isCorrect}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>

      <div className="quiz-actions">
        {!submitted && (
          <button
            className="quiz-button"
            onClick={handleSubmit}
            disabled={
              (isMultiple && selected.length === 0) ||
              (!isMultiple && selected === null)
            }
          >
            Submit
          </button>
        )}

        {submitted && !isCorrect && (
          <button className="quiz-button secondary" onClick={handleTryAgain}>
            Try Again
          </button>
        )}
      </div>

      {submitted && (
        <p
          className={`quiz-result ${
            isCorrect ? "quiz-correct" : "quiz-incorrect"
          }`}
        >
          {isCorrect ? "Correct! 🎉" : "Not quite. Check your answers and try again."}
        </p>
      )}
    </div>
  );
}
