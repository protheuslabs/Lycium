import { useCallback, useEffect, useState, type FormEvent } from "react";
import Modal from "../Modal/Modal";
import { lyciumApi } from "../../runtime/appRuntime";
import "./CourseFeedback.css";

type CourseFeedbackRating = "up" | "down";
type CourseFeedbackMagnitude = 1 | 2 | 3;

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

export default function CourseFeedback({ courseKey, courseTitle }: CourseFeedbackProps) {
  const [rating, setRating] = useState<CourseFeedbackRating | null>(null);
  const [status, setStatus] = useState("");
  const [, setIsSavingRating] = useState(false);
  const [feedbackPulse, setFeedbackPulse] = useState<CourseFeedbackRating | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isWrittenFeedbackOpen, setIsWrittenFeedbackOpen] = useState(false);
  const [writtenFeedbackRating, setWrittenFeedbackRating] = useState<CourseFeedbackRating | null>(null);
  const [writtenFeedbackText, setWrittenFeedbackText] = useState("");
  const [writtenFeedbackMagnitude, setWrittenFeedbackMagnitude] = useState<CourseFeedbackMagnitude | null>(null);
  const [writtenFeedbackStatus, setWrittenFeedbackStatus] = useState("");
  const [isSavingWrittenFeedback, setIsSavingWrittenFeedback] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [sourceStatus, setSourceStatus] = useState("");
  const [isSavingSource, setIsSavingSource] = useState(false);

  useEffect(() => {
    if (!courseKey) {
      setRating(null);
      return;
    }

    let cancelled = false;

    lyciumApi
      .loadCourseFeedback(courseKey)
      .then((record) => {
        if (!cancelled) {
          setRating(record?.rating ?? null);
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
      setIsSavingRating(true);
      setStatus("Saving feedback...");

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

  const submitSourceSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!courseKey || !sourceUrl.trim() || isSavingSource) return;

    setIsSavingSource(true);
    setSourceStatus("Saving source suggestion...");

    try {
      await lyciumApi.saveCourseFeedback({
        course_key: courseKey,
        course_title: courseTitle,
        source_url: sourceUrl.trim(),
        source_description: sourceDescription.trim() || null,
      });
      setSourceUrl("");
      setSourceDescription("");
      setSourceStatus("Source suggestion saved.");
      setIsSourceModalOpen(false);
    } catch {
      setSourceStatus("Source suggestion could not be saved yet.");
    } finally {
      setIsSavingSource(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`nav-button course-feedback-nav-button ${rating === "up" ? "course-feedback-nav-button--liked" : ""} ${
          feedbackPulse === "up" ? "course-feedback-nav-button--pulse" : ""
        }`}
        onClick={() => saveRating("up")}
        disabled={!courseKey}
        aria-pressed={rating === "up"}
        aria-label="This course is useful"
      >
        <ThumbsUpIcon />
      </button>
      <button
        type="button"
        className={`nav-button course-feedback-nav-button ${rating === "down" ? "course-feedback-nav-button--disliked" : ""} ${
          feedbackPulse === "down" ? "course-feedback-nav-button--pulse" : ""
        }`}
        onClick={() => saveRating("down")}
        disabled={!courseKey}
        aria-pressed={rating === "down"}
        aria-label="This course needs work"
      >
        <ThumbsDownIcon />
      </button>
      <button
        type="button"
        className="nav-button course-feedback-nav-button"
        onClick={() => setIsSourceModalOpen(true)}
        disabled={!courseKey}
        aria-label="Suggest a new course source"
      >
        <GlobeIcon />
      </button>
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
            <button type="submit" disabled={(!writtenFeedbackText.trim() && writtenFeedbackMagnitude === null) || isSavingWrittenFeedback}>
              {isSavingWrittenFeedback ? "Sending" : "Send Feedback"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isSourceModalOpen}
        title="Add a source for this course"
        eyebrow="Suggested source"
        labelledById="course-source-modal-title"
        size="md"
        onClose={() => setIsSourceModalOpen(false)}
      >
        <form className="course-source-form" onSubmit={submitSourceSuggestion}>
          <label>
            <span>Source link</span>
            <input
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.edu/course-source"
              disabled={isSavingSource}
              required
            />
          </label>
          <label>
            <span>How does it fit?</span>
            <textarea
              value={sourceDescription}
              onChange={(event) => setSourceDescription(event.target.value)}
              placeholder="Optional context for why this belongs in the course."
              disabled={isSavingSource}
              rows={4}
            />
          </label>
          <div className="course-source-form-footer">
            {sourceStatus && <p>{sourceStatus}</p>}
            <button type="submit" disabled={!sourceUrl.trim() || isSavingSource}>
              {isSavingSource ? "Saving" : "Save source"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ThumbsUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 10v11H4.5A2.5 2.5 0 0 1 2 18.5v-6A2.5 2.5 0 0 1 4.5 10H7Z" />
      <path d="M7 10l4.4-7.1c.8-1.2 2.7-.7 2.7.8v4.1h4.2c1.9 0 3.3 1.8 2.8 3.6l-1.8 6.9A3.6 3.6 0 0 1 15.8 21H7V10Z" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 3v11H4.5A2.5 2.5 0 0 1 2 11.5v-6A2.5 2.5 0 0 1 4.5 3H7Z" />
      <path d="M7 14l4.4 7.1c.8 1.2 2.7.7 2.7-.8v-4.1h4.2c1.9 0 3.3-1.8 2.8-3.6L19.3 5.7A3.6 3.6 0 0 0 15.8 3H7v11Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.3 2.4 3.4 5.4 3.4 9S14.3 18.6 12 21c-2.3-2.4-3.4-5.4-3.4-9S9.7 5.4 12 3Z" />
    </svg>
  );
}
