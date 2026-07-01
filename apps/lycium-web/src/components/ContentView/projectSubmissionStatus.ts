import type { ContentBlock } from "./contentViewTypes";

export type ProjectSubmissionRecord = {
  submitted: boolean;
  submittedAt?: string;
  submissionType?: string;
  summary?: string;
};

export function projectKeyFor(courseKey: string, sectionId: string | undefined, block: ContentBlock) {
  const title = block.title ?? block.name ?? block.artifactType ?? "project";
  return `${courseKey}:${sectionId ?? "unknown-section"}:${title}`;
}

export function readProjectSubmissionRecord(projectKey: string): ProjectSubmissionRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(projectSubmissionStorageKey(projectKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    return {
      submitted: record.submitted === true,
      submittedAt: typeof record.submittedAt === "string" ? record.submittedAt : undefined,
      submissionType: typeof record.submissionType === "string" ? record.submissionType : undefined,
      summary: typeof record.summary === "string" ? record.summary : undefined,
    };
  } catch {
    return null;
  }
}

export function hasSubmittedProject(projectKey: string) {
  return readProjectSubmissionRecord(projectKey)?.submitted === true;
}

export function writeProjectSubmissionRecord(projectKey: string, record: ProjectSubmissionRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(projectSubmissionStorageKey(projectKey), JSON.stringify(record));
}

function projectSubmissionStorageKey(projectKey: string) {
  return `lycium:project-submission:${projectKey}`;
}
