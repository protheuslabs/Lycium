import { describe, expect, it } from "vitest";
import { getLessonNoteStorageKey, getQuizMarkerStorageKey, getQuizProgressStorageKey, getVideoProgressStorageKey } from "./browserStorage";

describe("quiz storage keys", () => {
  it("isolates quiz progress and markers by course", () => {
    const quizKey = "quiz-module-1-section-1-0";

    expect(getQuizProgressStorageKey("course-a", quizKey)).not.toBe(
      getQuizProgressStorageKey("course-b", quizKey),
    );
    expect(getQuizMarkerStorageKey("course-a", quizKey)).not.toBe(
      getQuizMarkerStorageKey("course-b", quizKey),
    );
  });

  it("isolates notes and video positions by course and section", () => {
    expect(getLessonNoteStorageKey("course-a", "lesson-1")).not.toBe(getLessonNoteStorageKey("course-b", "lesson-1"));
    expect(getVideoProgressStorageKey("course-a", "lesson-1", "video-1")).not.toBe(getVideoProgressStorageKey("course-a", "lesson-2", "video-1"));
  });
});
