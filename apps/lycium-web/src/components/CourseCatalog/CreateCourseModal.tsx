import type { FormEvent, MouseEvent } from "react";
import Dropdown from "../Dropdown/Dropdown";
import Modal from "../Modal/Modal";
import { SETTINGS_PATH } from "../../utils/courseRouting";
import AiConnectionLockCallout from "../AiConnectionLockCallout/AiConnectionLockCallout";
import type { CreateCourseMode } from "./useCreateCourseModal";

type SelectOption = {
  value: string;
  label: string;
};

type CreateCourseModalProps = {
  prompt: string;
  level: string;
  sourceLinks: string[];
  canCreateCourse: boolean;
  aiLockedReason: string;
  generateStatus: "idle" | "loading" | "error" | "success";
  generateMessage: string;
  levelOptions: SelectOption[];
  college: string;
  department: string;
  collegeOptions: SelectOption[];
  departmentOptions: SelectOption[];
  mode: CreateCourseMode;
  onPromptChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onCollegeChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onSourceLinkChange: (index: number, value: string) => void;
  onAddSourceLink: () => void;
  onModeChange: (mode: CreateCourseMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenSettings: (event: MouseEvent<HTMLAnchorElement>) => void;
  onClose: () => void;
};

export default function CreateCourseModal({
  prompt,
  level,
  sourceLinks,
  canCreateCourse,
  aiLockedReason,
  generateStatus,
  generateMessage,
  levelOptions,
  college,
  department,
  collegeOptions,
  departmentOptions,
  mode,
  onPromptChange,
  onLevelChange,
  onCollegeChange,
  onDepartmentChange,
  onSourceLinkChange,
  onAddSourceLink,
  onModeChange,
  onSubmit,
  onOpenSettings,
  onClose,
}: CreateCourseModalProps) {
  const canSubmitCourse =
    mode === "manual" ||
    (canCreateCourse && Boolean(prompt.trim()) && Boolean(college) && Boolean(department) && generateStatus !== "loading");

  return (
    <Modal
      isOpen
      title="Create Course"
      eyebrow="Create with Lycium"
      labelledById="create-course-title"
      size="md"
      onClose={onClose}
    >
        <form className="create-course-form" onSubmit={onSubmit}>
          <div className="create-course-tabs" role="tablist" aria-label="Course creation mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "ai"}
              className={`create-course-tab ${mode === "ai" ? "create-course-tab--active" : ""}`}
              onClick={() => onModeChange("ai")}
            >
              AI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "manual"}
              className={`create-course-tab ${mode === "manual" ? "create-course-tab--active" : ""}`}
              onClick={() => onModeChange("manual")}
            >
              Manual
            </button>
          </div>
          {mode === "ai" && !canCreateCourse && (
            <AiConnectionLockCallout
              title="AI course creation is locked."
              titleId="create-course-ai-lock-title"
              message={`${aiLockedReason} You can also use the Manual tab to start with a blank editable course.`}
              messageId="create-course-ai-lock-description"
              href={SETTINGS_PATH}
              onOpenSettings={onOpenSettings}
            />
          )}
          {mode === "ai" ? (
          <div className={`create-course-controls ${canCreateCourse ? "" : "create-course-controls--locked"}`}>
            <label className="create-course-field">
              <span>Description</span>
              <textarea
                className="create-course-textarea"
                placeholder="Describe the course you want to build..."
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                rows={5}
                disabled={!canCreateCourse}
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
                    disabled={!canCreateCourse}
                  />
                ))}
              </div>
              <button className="create-course-add-link" type="button" onClick={onAddSourceLink} disabled={!canCreateCourse}>
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
                disabled={!canCreateCourse}
              />
            </label>
            <label className="create-course-field">
              <span>College</span>
              <Dropdown
                className="create-course-dropdown"
                value={college}
                options={collegeOptions}
                onChange={onCollegeChange}
                ariaLabel="College"
                disabled={!canCreateCourse}
                placeholder="Select college"
              />
            </label>
            <label className="create-course-field">
              <span>Department</span>
              <Dropdown
                className="create-course-dropdown"
                value={department}
                options={departmentOptions}
                onChange={onDepartmentChange}
                ariaLabel="Department"
                disabled={!canCreateCourse || !college}
                emptyLabel="Select a college first"
                placeholder={college ? "Select department" : "Select college first"}
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
            <button className="create-course-submit" type="submit" disabled={!canSubmitCourse}>
              {generateStatus === "loading" ? "Generating..." : "Create course"}
            </button>
            {generateMessage && <p className={`generator-status generator-status-${generateStatus}`}>{generateMessage}</p>}
          </div>
          ) : (
            <div className="create-course-controls create-course-manual-panel">
              <p className="create-course-manual-note">
                Start with one blank module and one blank section. You can build the course in edit mode after it opens.
              </p>
              <button className="create-course-submit" type="submit" disabled={!canSubmitCourse}>
                Create blank course
              </button>
            </div>
          )}
        </form>
    </Modal>
  );
}
