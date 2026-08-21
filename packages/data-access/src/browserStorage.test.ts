import { describe, expect, it } from "vitest";
import { getQuizMarkerStorageKey, getQuizProgressStorageKey } from "./browserStorage";

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
});
