import { useCallback, useMemo, useState } from "react";

export type ProjectComment = {
  id: string;
  authorRole: "grader" | "learner";
  authorLabel: string;
  body: string;
  createdAt: string;
};

function commentStorageKey(projectKey: string) {
  return `lycium:project-comments:${projectKey}`;
}

function readComments(projectKey: string): ProjectComment[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(commentStorageKey(projectKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isProjectComment) : [];
  } catch {
    return [];
  }
}

function writeComments(projectKey: string, comments: ProjectComment[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(commentStorageKey(projectKey), JSON.stringify(comments));
}

export function useProjectComments(projectKey: string) {
  const [comments, setComments] = useState<ProjectComment[]>(() => readComments(projectKey));
  const [draftComment, setDraftComment] = useState("");

  const addComment = useCallback(
    (authorRole: ProjectComment["authorRole"], body: string) => {
      const cleanBody = body.trim();
      if (!cleanBody) return;

      setComments((current) => {
        const next = [
          ...current,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            authorRole,
            authorLabel: authorRole === "grader" ? "Grader" : "Learner",
            body: cleanBody,
            createdAt: new Date().toISOString(),
          },
        ];
        writeComments(projectKey, next);
        return next;
      });
    },
    [projectKey],
  );

  return useMemo(
    () => ({ addComment, comments, draftComment, setDraftComment }),
    [addComment, comments, draftComment],
  );
}

function isProjectComment(value: unknown): value is ProjectComment {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (record.authorRole === "grader" || record.authorRole === "learner") &&
    typeof record.authorLabel === "string" &&
    typeof record.body === "string" &&
    typeof record.createdAt === "string"
  );
}
