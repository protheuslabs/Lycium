import { useEffect, useState } from "react";
import Modal from "../Modal/Modal";
import "./CourseSettingsModal.css";

export type CourseSettingsDraft = {
  orderMandatory: boolean;
  learnersCanFork: boolean;
};

type CourseSettingsModalProps = {
  isOpen: boolean;
  settings: CourseSettingsDraft;
  canEditCourse: boolean;
  onClose: () => void;
  onSave: (settings: CourseSettingsDraft) => void;
};

export default function CourseSettingsModal({
  isOpen,
  settings,
  canEditCourse,
  onClose,
  onSave,
}: CourseSettingsModalProps) {
  const [draftSettings, setDraftSettings] = useState<CourseSettingsDraft>(settings);

  useEffect(() => {
    if (isOpen) {
      setDraftSettings(settings);
    }
  }, [isOpen, settings]);

  return (
    <Modal
      isOpen={isOpen}
      title="Course settings"
      eyebrow="Edit mode"
      labelledById="course-settings-modal-title"
      size="md"
      className="course-settings-modal"
      onClose={onClose}
    >
      <div className="course-settings-list">
        <label className="course-settings-row">
          <span className="course-settings-copy">
            <span className="course-settings-title">Require units in order</span>
            <span className="course-settings-description">
              Learners must complete each previous unit before moving to the next unit.
            </span>
          </span>
          <input
            type="checkbox"
            checked={draftSettings.orderMandatory}
            onChange={(event) => setDraftSettings((current) => ({ ...current, orderMandatory: event.target.checked }))}
          />
        </label>

        <label className="course-settings-row">
          <span className="course-settings-copy">
            <span className="course-settings-title">Allow user forks</span>
            <span className="course-settings-description">
              Learners can create editable local copies of this course from the course info panel.
            </span>
          </span>
          <input
            type="checkbox"
            checked={draftSettings.learnersCanFork}
            onChange={(event) => setDraftSettings((current) => ({ ...current, learnersCanFork: event.target.checked }))}
          />
        </label>

        <div className="course-settings-row course-settings-row--static">
          <span className="course-settings-copy">
            <span className="course-settings-title">Course editing</span>
            <span className="course-settings-description">
              {canEditCourse
                ? "This local course copy can be edited and saved from the sidebar controls."
                : "This course is locked and must be forked before editing."}
            </span>
          </span>
          <span className="course-settings-pill">{canEditCourse ? "Editable" : "Locked"}</span>
        </div>
      </div>

      <div className="course-settings-actions">
        <button type="button" className="course-settings-button course-settings-button--secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="course-settings-button" onClick={() => onSave(draftSettings)}>
          Save settings
        </button>
      </div>
    </Modal>
  );
}
