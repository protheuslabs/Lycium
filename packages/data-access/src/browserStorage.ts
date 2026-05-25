import type {
  LyciumBookmarkRecord,
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

export function getQuizProgressStorageKey(quizKey: string): string {
  return `lycium-quiz-progress-${quizKey || "quiz"}`;
}

export function getQuizMarkerStorageKey(quizKey: string): string {
  return `lycium-quiz-marker-${quizKey || "quiz"}`;
}

export function createBrowserStorageRepository() {
  return {
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

    readQuizProgress(quizKey: string): LyciumQuizProgressRecord | null {
      return readJson<LyciumQuizProgressRecord>(getQuizProgressStorageKey(quizKey));
    },

    writeQuizProgress(quizKey: string, progress: LyciumQuizProgressRecord): void {
      writeJson(getQuizProgressStorageKey(quizKey), progress);
    },

    readQuizMarkers(quizKey: string): boolean[] | null {
      return readJson<boolean[]>(getQuizMarkerStorageKey(quizKey));
    },

    writeQuizMarkers(quizKey: string, markers: boolean[]): void {
      writeJson(getQuizMarkerStorageKey(quizKey), markers);
    },

    removeQuizMarkers(quizKey: string): void {
      getLocalStorage()?.removeItem(getQuizMarkerStorageKey(quizKey));
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
