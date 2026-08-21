import type {
  LyciumBookmarkRecord,
  LyciumCourseEntry,
  LyciumCourseFeedbackRecord,
  LyciumEvidenceArtifactSubmission,
  LyciumProgressRecord,
  LyciumQuizProgressRecord,
  LyciumThemeMode,
  ProgressRepository,
} from "./types";

function getLocalStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function readJson<T>(key: string): T | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

export function getCourseProgressStorageKey(courseKey: string): string {
  return `lycium-progress-${courseKey}`;
}

export function getCourseBookmarkStorageKey(courseKey: string): string {
  return `lycium-bookmark-${courseKey}`;
}

export function getCourseFeedbackStorageKey(courseKey: string): string {
  return `lycium-course-feedback-${courseKey}`;
}

export function getQuizProgressStorageKey(courseKey: string, quizKey: string): string {
  return `lycium-quiz-progress-${courseKey || "course"}-${quizKey || "quiz"}`;
}

export function getQuizMarkerStorageKey(courseKey: string, quizKey: string): string {
  return `lycium-quiz-marker-${courseKey || "course"}-${quizKey || "quiz"}`;
}

export function getLocalCourseDraftsStorageKey(): string {
  return "lycium-local-course-drafts";
}

export function getProgramArtifactsStorageKey(): string {
  return "lycium-program-artifacts";
}

export function createBrowserStorageRepository() {
  return {
    readLocalCourseDrafts(): LyciumCourseEntry[] {
      return readJson<LyciumCourseEntry[]>(getLocalCourseDraftsStorageKey()) ?? [];
    },

    writeLocalCourseDrafts(courses: LyciumCourseEntry[]): void {
      writeJson(getLocalCourseDraftsStorageKey(), courses);
    },

    removeLocalCourseDraft(courseKey: string): void {
      const next = this.readLocalCourseDrafts().filter((course) => course.key !== courseKey);
      this.writeLocalCourseDrafts(next);
    },

    upsertLocalCourseDraft(course: LyciumCourseEntry): void {
      const current = this.readLocalCourseDrafts();
      const next = [course, ...current.filter((draft) => draft.key !== course.key)];
      this.writeLocalCourseDrafts(next);
    },

    readProgramArtifacts(): LyciumEvidenceArtifactSubmission[] {
      return readJson<LyciumEvidenceArtifactSubmission[]>(getProgramArtifactsStorageKey()) ?? [];
    },

    writeProgramArtifacts(artifacts: LyciumEvidenceArtifactSubmission[]): void {
      writeJson(getProgramArtifactsStorageKey(), artifacts);
    },

    upsertProgramArtifact(artifact: LyciumEvidenceArtifactSubmission): void {
      const current = this.readProgramArtifacts();
      const next = [artifact, ...current.filter((existing) => existing.id !== artifact.id)];
      this.writeProgramArtifacts(next);
    },

    removeProgramArtifact(artifactId: string): void {
      const next = this.readProgramArtifacts().filter((artifact) => artifact.id !== artifactId);
      this.writeProgramArtifacts(next);
    },

    readProgress(courseKey: string): LyciumProgressRecord | null {
      return readJson<LyciumProgressRecord>(getCourseProgressStorageKey(courseKey));
    },

    writeProgress(courseKey: string, progress: LyciumProgressRecord): void {
      writeJson(getCourseProgressStorageKey(courseKey), progress);
    },

    readBookmark(courseKey: string): LyciumBookmarkRecord | null {
      return readJson<LyciumBookmarkRecord>(getCourseBookmarkStorageKey(courseKey));
    },

    writeBookmark(courseKey: string, bookmark: LyciumBookmarkRecord): void {
      writeJson(getCourseBookmarkStorageKey(courseKey), bookmark);
    },

    readCourseFeedback(courseKey: string): LyciumCourseFeedbackRecord | null {
      return readJson<LyciumCourseFeedbackRecord>(getCourseFeedbackStorageKey(courseKey));
    },

    writeCourseFeedback(courseKey: string, feedback: LyciumCourseFeedbackRecord): void {
      writeJson(getCourseFeedbackStorageKey(courseKey), feedback);
    },

    readLearnerId(): number | null {
      const value = getLocalStorage()?.getItem("lycium-learner-id");
      return value ? Number(value) : null;
    },

    writeLearnerId(learnerId: string | number): void {
      getLocalStorage()?.setItem("lycium-learner-id", String(learnerId));
    },

    readThemeMode(): LyciumThemeMode | null {
      const value = getLocalStorage()?.getItem("lycium-theme-mode");
      return value === "light" || value === "dark" || value === "auto" ? value : null;
    },

    writeThemeMode(mode: LyciumThemeMode): void {
      getLocalStorage()?.setItem("lycium-theme-mode", mode);
    },

    readQuizProgress(courseKey: string, quizKey: string): LyciumQuizProgressRecord | null {
      return readJson<LyciumQuizProgressRecord>(getQuizProgressStorageKey(courseKey, quizKey));
    },

    writeQuizProgress(courseKey: string, quizKey: string, progress: LyciumQuizProgressRecord): void {
      writeJson(getQuizProgressStorageKey(courseKey, quizKey), progress);
    },

    readQuizMarkers(courseKey: string, quizKey: string): boolean[] | null {
      return readJson<boolean[]>(getQuizMarkerStorageKey(courseKey, quizKey));
    },

    writeQuizMarkers(courseKey: string, quizKey: string, markers: boolean[]): void {
      writeJson(getQuizMarkerStorageKey(courseKey, quizKey), markers);
    },

    removeQuizMarkers(courseKey: string, quizKey: string): void {
      getLocalStorage()?.removeItem(getQuizMarkerStorageKey(courseKey, quizKey));
    },
  };
}

export function createBrowserProgressRepository(): ProgressRepository {
  const storage = createBrowserStorageRepository();

  return {
    async getProgress(courseKey) {
      return storage.readProgress(courseKey);
    },

    async saveProgress(courseKey, progress) {
      storage.writeProgress(courseKey, progress);
    },
  };
}
