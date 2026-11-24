import { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import { createBrowserStorageRepository } from "@lycium/data-access";
import "./LessonNotes.css";

const storage = createBrowserStorageRepository();

export default function LessonNotes({ courseKey, sectionId }: { courseKey: string; sectionId: string }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote(storage.readLessonNote(courseKey, sectionId));
  }, [courseKey, sectionId]);

  return (
    <details className="lesson-notes">
      <summary><NotebookPen size={17} aria-hidden="true" /><span>Notes</span></summary>
      <label>
        <span className="sr-only">Lesson notes</span>
        <textarea
          value={note}
          rows={4}
          placeholder="Write a note for this lesson"
          onChange={(event) => {
            setNote(event.target.value);
            storage.writeLessonNote(courseKey, sectionId, event.target.value);
          }}
        />
      </label>
      <p>Saved on this device</p>
    </details>
  );
}
