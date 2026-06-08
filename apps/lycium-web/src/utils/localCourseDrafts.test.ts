import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseEntry } from "../courseTypes";
import { saveLocalCourseDraftConflictSafe } from "./localCourseDrafts";

const storageKey = "lycium-local-course-drafts";

function storageStub() {
  const store = new Map<string, string>();

  return {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  };
}

function course(title: string, revision: number): CourseEntry {
  const now = "2026-06-06T00:00:00.000Z";

  return {
    key: "draft-course",
    title,
    source: "local",
    status: "draft",
    data: {
      title,
      metadata: {
        localDraft: {
          isLocalDraft: true,
          schemaVersion: 1,
          draftId: "draft-course-draft",
          origin: "local_edit",
          createdAt: now,
          updatedAt: now,
          revision,
        },
      },
      modules: [],
    },
  };
}

describe("local course draft conflict-safe saves", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: storageStub() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a newer persisted revision with matching content as an idempotent save", () => {
    const persistedCourse = course("Saved Draft", 2);
    const staleCourse = course("Original Draft", 1);
    const dataToSave = { ...persistedCourse.data };
    window.localStorage.setItem(storageKey, JSON.stringify([persistedCourse]));

    const result = saveLocalCourseDraftConflictSafe(staleCourse, dataToSave);
    const persistedTitles = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]").map(
      (draft: { title?: string }) => draft.title ?? "",
    );

    expect(result.conflictDetected).toBe(false);
    expect(result.course.title).toBe("Saved Draft");
    expect(persistedTitles).toEqual(["Saved Draft"]);
  });

  it("creates a conflict copy when a newer persisted revision has different content", () => {
    const persistedCourse = course("Other Draft", 2);
    const staleCourse = course("Original Draft", 1);
    const dataToSave = { ...staleCourse.data, title: "My Draft" };
    window.localStorage.setItem(storageKey, JSON.stringify([persistedCourse]));

    const result = saveLocalCourseDraftConflictSafe(staleCourse, dataToSave);
    const persistedTitles = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]").map(
      (draft: { title?: string }) => draft.title ?? "",
    );

    expect(result.conflictDetected).toBe(true);
    expect(result.course.title).toBe("My Draft (conflict copy)");
    expect(persistedTitles).toContain("Other Draft");
    expect(persistedTitles).toContain("My Draft (conflict copy)");
  });
});
