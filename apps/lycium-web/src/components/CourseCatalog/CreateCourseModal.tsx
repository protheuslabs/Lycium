import type { FormEvent, MouseEvent } from "react";
import Dropdown from "../Dropdown/Dropdown";

type SelectOption = {
  value: string;
  label: string;
};

type CreateCourseModalProps = {
  prompt: string;
  level: string;
  sourceLinks: string[];
  generateStatus: "idle" | "loading" | "error" | "success";
  generateMessage: string;
  levelOptions: SelectOption[];
  onPromptChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onSourceLinkChange: (index: number, value: string) => void;
  onAddSourceLink: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export default function CreateCourseModal({
  prompt,
  level,
  sourceLinks,
  generateStatus,
  generateMessage,
  levelOptions,
  onPromptChange,
  onLevelChange,
  onSourceLinkChange,
  onAddSourceLink,
  onSubmit,
  onClose,
}: CreateCourseModalProps) {
  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="create-course-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        className="create-course-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-course-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="create-course-close" type="button" aria-label="Close create course" onClick={onClose}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.3 4.3-4.3a1 1 0 1 1 1.4 1.4L13.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
        <div className="create-course-header">
          <p>Create with Lycium</p>
          <h2 id="create-course-title">Create Course</h2>
        </div>
        <form className="create-course-form" onSubmit={onSubmit}>
          <label className="create-course-field">
            <span>Description</span>
            <textarea
              className="create-course-textarea"
              placeholder="Describe the course you want to build..."
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              rows={5}
            />
          </label>
          <div className="create-course-field">
            <span>Links</span>
            <div className="create-course-link-stack">
              {sourceLinks.map((link, index) => (
                <input
                  key={index}
                  className="create-course-input"
                  type="url"
                  placeholder="https://example.com/source"
                  value={link}
                  onChange={(event) => onSourceLinkChange(index, event.target.value)}
                />
              ))}
            </div>
            <button className="create-course-add-link" type="button" onClick={onAddSourceLink}>
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
              </svg>
              Add another link
            </button>
          </div>
          <label className="create-course-field">
            <span>Difficulty level</span>
            <Dropdown
              className="create-course-dropdown"
              value={level}
              options={levelOptions}
              onChange={onLevelChange}
              ariaLabel="Difficulty level"
            />
          </label>
          <div className="create-course-files" aria-label="Add files placeholder">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M7.5 18.5a5 5 0 0 1 0-7.07l6.72-6.72a3.5 3.5 0 0 1 4.95 4.95l-7.08 7.07a2 2 0 0 1-2.83-2.83l6.37-6.36a1 1 0 1 1 1.41 1.41l-6.36 6.37 1.41 1.41 7.07-7.07a5.5 5.5 0 0 0-7.78-7.78l-6.72 6.72a7 7 0 0 0 9.9 9.9l5.31-5.3a1 1 0 0 0-1.42-1.42l-5.3 5.31a5 5 0 0 1-7.07 0Z" />
            </svg>
            <div>
              <strong>Add Files</strong>
              <span>File uploads are coming soon.</span>
            </div>
          </div>
          <button className="create-course-submit" type="submit" disabled={!prompt.trim() || generateStatus === "loading"}>
            {generateStatus === "loading" ? "Generating..." : "Create course"}
          </button>
          {generateMessage && <p className={`generator-status generator-status-${generateStatus}`}>{generateMessage}</p>}
        </form>
      </section>
    </div>
  );
}
