import { useCallback, useEffect, useState, type FormEvent } from "react";
import Button from "../Button/Button";
import FeedbackControl from "../FeedbackControl/FeedbackControl";
import Modal from "../Modal/Modal";
import { browserStorage, localApiSyncEnabled, lyciumApi } from "../../runtime/appRuntime";
import "./CourseFeedback.css";

export type CourseFeedbackRating = "up" | "down";
export type CourseFeedbackMagnitude = 1 | 2 | 3;

type CourseFeedbackProps = {
  courseKey: string;
  courseTitle: string;
};

const feedbackMagnitudeOptions: Record<
  CourseFeedbackRating,
  Array<{ value: CourseFeedbackMagnitude; emoji: string; label: string }>
> = {
  up: [
    { value: 1, emoji: "🙂", label: "Somewhat helpful" },
    { value: 2, emoji: "😃", label: "Helpful" },
    { value: 3, emoji: "😁", label: "Very helpful" },
  ],
  down: [
    { value: 1, emoji: "😐", label: "Could be better" },
    { value: 2, emoji: "🙁", label: "Needs work" },
    { value: 3, emoji: "😖", label: "Frustrating" },
  ],
};

function makeFeedbackId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
}

export function updateStoredFeedback(
  courseKey: string,
  courseTitle: string,
  update: {
    rating?: CourseFeedbackRating | null;
    feedbackText?: string | null;
    feedbackMagnitude?: CourseFeedbackMagnitude | null;
    sourceUrl?: string | null;
    sourceDescription?: string | null;
  },
) {
  const now = new Date().toISOString();
  const current = browserStorage.readCourseFeedback(courseKey);
  const next = {
    course_key: courseKey,
    course_title: courseTitle || current?.course_title || null,
    rating: update.rating !== undefined ? update.rating : current?.rating ?? null,
    rating_events: [...(current?.rating_events ?? [])],
    feedback_notes: [...(current?.feedback_notes ?? [])],
    source_suggestions: [...(current?.source_suggestions ?? [])],
    updated_at: now,
  };

  if (update.rating) {
    next.rating_events.push({
      id: makeFeedbackId("rating-event"),
      rating: update.rating,
      created_at: now,
    });
  }

  const cleanFeedbackText = update.feedbackText?.trim() ?? "";
  if (cleanFeedbackText || update.feedbackMagnitude) {
    next.feedback_notes.push({
      id: makeFeedbackId("feedback-note"),
      rating: update.rating ?? next.rating,
      feedback_magnitude: update.feedbackMagnitude ?? null,
      text: cleanFeedbackText || null,
      created_at: now,
    });
  }

  const cleanSourceUrl = update.sourceUrl?.trim() ?? "";
  if (cleanSourceUrl) {
    next.source_suggestions.push({
      id: makeFeedbackId("source-suggestion"),
      url: cleanSourceUrl,
      description: update.sourceDescription?.trim() || null,
      created_at: now,
    });
  }

  browserStorage.writeCourseFeedback(courseKey, next);
  return next;
}

export default function CourseFeedback({ courseKey, courseTitle }: CourseFeedbackProps) {
  const [rating, setRating] = useState<CourseFeedbackRating | null>(null);
  const [status, setStatus] = useState("");
  const [, setIsSavingRating] = useState(false);
  const [feedbackPulse, setFeedbackPulse] = useState<CourseFeedbackRating | null>(null);
  const [isWrittenFeedbackOpen, setIsWrittenFeedbackOpen] = useState(false);
  const [writtenFeedbackRating, setWrittenFeedbackRating] = useState<CourseFeedbackRating | null>(null);
  const [writtenFeedbackText, setWrittenFeedbackText] = useState("");
  const [writtenFeedbackMagnitude, setWrittenFeedbackMagnitude] = useState<CourseFeedbackMagnitude | null>(null);
  const [writtenFeedbackStatus, setWrittenFeedbackStatus] = useState("");
  const [isSavingWrittenFeedback, setIsSavingWrittenFeedback] = useState(false);
  useEffect(() => {
    if (!courseKey) {
      setRating(null);
      return;
    }

    const localRecord = browserStorage.readCourseFeedback(courseKey);
    setRating(localRecord?.rating ?? null);
    if (!localApiSyncEnabled) {
      return;
    }

    let cancelled = false;

    lyciumApi
      .loadCourseFeedback(courseKey)
      .then((record) => {
        if (!cancelled) {
          setRating(record?.rating ?? null);
          if (record) {
            browserStorage.writeCourseFeedback(courseKey, record);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("Feedback unavailable while the local API is offline.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courseKey]);

  const saveRating = useCallback(
    async (nextRating: CourseFeedbackRating) => {
      if (!courseKey) return;

      const nextValue = nextRating;
      setRating(nextValue);
      setWrittenFeedbackRating(nextValue);
      setWrittenFeedbackText("");
      setWrittenFeedbackMagnitude(null);
      setWrittenFeedbackStatus("");
      setIsWrittenFeedbackOpen(true);
      setFeedbackPulse(null);
      window.requestAnimationFrame(() => setFeedbackPulse(nextValue));
      updateStoredFeedback(courseKey, courseTitle, { rating: nextValue });
      setIsSavingRating(true);
      setStatus("Saving feedback...");

      if (!localApiSyncEnabled) {
        setStatus("Feedback saved.");
        setIsSavingRating(false);
        return;
      }

      try {
        const saved = await lyciumApi.saveCourseFeedback({
          course_key: courseKey,
          course_title: courseTitle,
          rating: nextValue,
        });
        setRating(saved.rating ?? nextValue);
        setStatus("Feedback saved.");
      } catch {
        setStatus("Feedback could not be saved yet.");
      } finally {
        setIsSavingRating(false);
      }
    },
    [courseKey, courseTitle],
  );

  const submitWrittenFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !courseKey ||
      !writtenFeedbackRating ||
      (!writtenFeedbackText.trim() && writtenFeedbackMagnitude === null) ||
      isSavingWrittenFeedback
    ) {
      return;
    }

    setIsSavingWrittenFeedback(true);
    setWrittenFeedbackStatus("Saving feedback...");
    updateStoredFeedback(courseKey, courseTitle, {
      feedbackText: writtenFeedbackText.trim() || null,
      feedbackMagnitude: writtenFeedbackMagnitude,
    });

    if (!localApiSyncEnabled) {
      setWrittenFeedbackText("");
      setWrittenFeedbackMagnitude(null);
      setWrittenFeedbackStatus("Feedback saved.");
      setIsWrittenFeedbackOpen(false);
      setIsSavingWrittenFeedback(false);
      return;
    }

    try {
      await lyciumApi.saveCourseFeedback({
        course_key: courseKey,
        course_title: courseTitle,
        rating: writtenFeedbackRating,
        feedback_text: writtenFeedbackText.trim() || null,
        feedback_magnitude: writtenFeedbackMagnitude,
      });
      setWrittenFeedbackText("");
      setWrittenFeedbackMagnitude(null);
      setWrittenFeedbackStatus("Feedback saved.");
      setIsWrittenFeedbackOpen(false);
    } catch {
      setWrittenFeedbackStatus("Written feedback could not be saved yet.");
    } finally {
      setIsSavingWrittenFeedback(false);
    }
  };

  return (
    <>
      <FeedbackControl
        rating={rating}
        pulse={feedbackPulse}
        disabled={!courseKey}
        onLike={() => saveRating("up")}
        onDislike={() => saveRating("down")}
      />
      {status && <span className="course-feedback-status" aria-live="polite">{status}</span>}

      <Modal
        isOpen={isWrittenFeedbackOpen}
        title="Optional feedback"
        labelledById="course-written-feedback-title"
        size="md"
        onClose={() => setIsWrittenFeedbackOpen(false)}
      >
        <form className="course-source-form" onSubmit={submitWrittenFeedback}>
          {writtenFeedbackRating && (
            <fieldset className="course-feedback-magnitude-group">
              <legend className="course-feedback-sr-only">Feedback strength</legend>
              <div className="course-feedback-magnitude-row">
                {feedbackMagnitudeOptions[writtenFeedbackRating].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`course-feedback-magnitude-option ${
                      writtenFeedbackMagnitude === option.value ? `course-feedback-magnitude-option-selected course-feedback-magnitude-option-selected-${writtenFeedbackRating}` : ""
                    }`}
                    onClick={() => setWrittenFeedbackMagnitude(option.value)}
                    disabled={isSavingWrittenFeedback}
                    aria-pressed={writtenFeedbackMagnitude === option.value}
                    aria-label={option.label}
                  >
                    <span aria-hidden="true">{option.emoji}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <label>
            <span>{writtenFeedbackRating === "down" ? "What should improve?" : "What worked well?"}</span>
            <textarea
              value={writtenFeedbackText}
              onChange={(event) => setWrittenFeedbackText(event.target.value)}
              placeholder="Optional context that can help improve course quality."
              disabled={isSavingWrittenFeedback}
              rows={4}
            />
          </label>
          <div className="course-source-form-footer">
            {writtenFeedbackStatus && <p>{writtenFeedbackStatus}</p>}
            <Button type="submit" variant="standard" disabled={(!writtenFeedbackText.trim() && writtenFeedbackMagnitude === null) || isSavingWrittenFeedback}>
              {isSavingWrittenFeedback ? "Sending" : "Send Feedback"}
            </Button>
          </div>
        </form>
      </Modal>

    </>
  );
}
