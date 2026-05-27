import { useState, type FormEvent } from "react";
import Button from "../Button/Button";
import Modal from "../Modal/Modal";
import { localApiSyncEnabled, lyciumApi } from "../../runtime/appRuntime";
import { updateStoredFeedback } from "./CourseFeedback";
import "./CourseFeedback.css";

type SourceSuggestionButtonProps = {
  courseKey: string;
  courseTitle: string;
};

export default function SourceSuggestionButton({ courseKey, courseTitle }: SourceSuggestionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [sourceStatus, setSourceStatus] = useState("");
  const [isSavingSource, setIsSavingSource] = useState(false);

  const submitSourceSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!courseKey || !sourceUrl.trim() || isSavingSource) return;

    setIsSavingSource(true);
    setSourceStatus("Saving source suggestion...");
    updateStoredFeedback(courseKey, courseTitle, {
      sourceUrl: sourceUrl.trim(),
      sourceDescription: sourceDescription.trim() || null,
    });

    if (!localApiSyncEnabled) {
      setSourceUrl("");
      setSourceDescription("");
      setSourceStatus("Source suggestion saved.");
      setIsOpen(false);
      setIsSavingSource(false);
      return;
    }

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
      setIsOpen(false);
    } catch {
      setSourceStatus("Source suggestion could not be saved yet.");
    } finally {
      setIsSavingSource(false);
    }
  };

  return (
    <>
      <Button
        className="source-add-button"
        variant="icon"
        iconOnly
        onClick={() => setIsOpen(true)}
        disabled={!courseKey}
        aria-label="Add source"
        title="Add source"
      >
        <PlusIcon />
      </Button>
      <Modal
        isOpen={isOpen}
        title="Add a source for this course"
        eyebrow="Suggested source"
        labelledById="course-source-modal-title"
        size="md"
        onClose={() => setIsOpen(false)}
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
            <Button type="submit" variant="standard" disabled={!sourceUrl.trim() || isSavingSource}>
              {isSavingSource ? "Saving" : "Save source"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
