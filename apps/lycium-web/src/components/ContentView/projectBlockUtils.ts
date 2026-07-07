import type {
  ContentBlock,
  ProjectGraderWorkflow,
  ProjectRubric,
  ProjectRubricCriterion,
  ProjectSubmissionPolicy,
} from "./contentViewTypes";

export type ProjectSubmissionDraft = {
  text: string;
  link: string;
  fileName: string;
  fileMimeType?: string;
  fileDataBase64?: string;
};

export type ProjectGradeReport = {
  status?: string;
  grader?: string;
  score?: number;
  maxScore?: number;
  scorePercentage?: number;
  passed?: boolean;
  summary?: string;
  feedback?: string;
  criterionResults?: Array<{
    criterionId: string;
    title: string;
    score: number;
    maxScore: number;
    level: string;
    feedback: string;
  }>;
  nextSteps?: string[];
  errors?: Array<{
    code: string;
    message: string;
    severity?: string;
    retryable?: boolean;
  }>;
};

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  doc: "Document",
  document: "Document",
  docx: "DOCX",
  file: "File",
  image: "Image",
  link: "Link",
  pdf: "PDF",
  text: "Text",
};

export const SUBMISSION_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "link", label: "Link" },
  { value: "doc", label: "Document" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "image", label: "Image" },
  { value: "file", label: "File" },
];

export function formatGradeScore(report: ProjectGradeReport) {
  const { score, maxScore } = report;
  const hasPointScore = typeof score === "number" && typeof maxScore === "number";
  const points = hasPointScore
    ? `${formatGradeNumber(score)}/${formatGradeNumber(maxScore)}`
    : "Score unavailable";
  const percent = typeof report.scorePercentage === "number" ? ` ${report.scorePercentage}%` : "";
  const status = report.status === "needs_review"
    ? " needs review"
    : report.passed === undefined
      ? ""
      : report.passed
        ? " passed"
        : " needs revision";
  return `${points}${percent}${status}`;
}

export function normalizeRubric(rawRubric: ContentBlock["rubric"]): Required<ProjectRubric> {
  if (Array.isArray(rawRubric)) {
    return {
      id: "project-rubric",
      title: "Project rubric",
      criteria: rawRubric.length > 0 ? rawRubric : defaultCriteria(),
    };
  }

  return {
    id: rawRubric?.id ?? "project-rubric",
    title: rawRubric?.title ?? "Project rubric",
    criteria: Array.isArray(rawRubric?.criteria) && rawRubric.criteria.length > 0
      ? rawRubric.criteria
      : defaultCriteria(),
  };
}

export function normalizeSubmissionPolicy(rawPolicy: ContentBlock["submission"]): ProjectSubmissionPolicy {
  return {
    submissionType: rawPolicy?.submissionType,
    submissionMethods: rawPolicy?.submissionMethods,
    acceptedTypes: rawPolicy?.acceptedTypes?.length ? rawPolicy.acceptedTypes : ["text"],
    acceptedFileTypes: rawPolicy?.acceptedFileTypes ?? [],
    instructions: rawPolicy?.instructions ?? "Submit the artifact in the accepted format.",
    maxFiles: rawPolicy?.maxFiles,
    maxFileSizeMb: rawPolicy?.maxFileSizeMb,
  };
}

export function normalizeGraderWorkflow(rawWorkflow: ContentBlock["graderWorkflow"]): ProjectGraderWorkflow {
  return {
    grader: rawWorkflow?.grader ?? "agent",
    rubricId: rawWorkflow?.rubricId,
    status: rawWorkflow?.status ?? "ready",
    allowedContext: rawWorkflow?.allowedContext,
    feedbackPolicy: rawWorkflow?.feedbackPolicy,
  };
}

export function acceptedFileTypesFor(policy: ProjectSubmissionPolicy) {
  const explicit = policy.acceptedFileTypes ?? [];
  return Array.from(new Set([...explicit, ...defaultAcceptedFileTypesFor(resolveSubmissionType(policy))]));
}

export function defaultAcceptedFileTypesFor(submissionType: string) {
  if (submissionType === "doc" || submissionType === "document") return [".pdf", ".docx"];
  if (submissionType === "pdf") return [".pdf"];
  if (submissionType === "docx") return [".docx"];
  if (submissionType === "image") return ["image/*"];
  if (submissionType === "file") return [".txt", ".md", ".csv", ".pdf", ".docx", "image/*"];
  return [];
}

export function resolveSubmissionType(policy: ProjectSubmissionPolicy) {
  const submissionType = (policy.submissionType ?? policy.acceptedTypes?.[0] ?? "text").toLowerCase();
  return submissionType === "document" ? "doc" : submissionType;
}

export function isFileSubmissionType(submissionType: string) {
  return ["doc", "document", "docx", "file", "image", "pdf"].includes(submissionType);
}

export function hasSubmissionForType(submission: ProjectSubmissionDraft, submissionType: string) {
  if (submissionType === "text") return Boolean(submission.text.trim());
  if (submissionType === "link") return Boolean(submission.link.trim());
  if (isFileSubmissionType(submissionType)) return Boolean(submission.fileName.trim());
  return Boolean(submission.text.trim() || submission.link.trim() || submission.fileName.trim());
}

export function submissionCommentBody(submission: ProjectSubmissionDraft, submissionType: string) {
  if (submissionType === "link" && submission.link.trim()) return `Submitted link: ${submission.link.trim()}`;
  if (isFileSubmissionType(submissionType) && submission.fileName.trim()) {
    return `Submitted file: ${submission.fileName.trim()}`;
  }
  if (submissionType === "text" && submission.text.trim()) return "Submitted text response.";
  return "Submitted project.";
}

export function gradingHttpErrorMessage(status: number) {
  if (status === 400 || status === 422) return "The grading request is missing required submission or rubric data.";
  if (status === 503) return "The grading service is unavailable. Try again after the grader is connected.";
  if (status >= 500) return "The grader failed while evaluating this submission. Try again or request review.";
  return `The grader returned status ${status}.`;
}

export function gradingErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "The grading service could not be reached. Check that the Lycium API is running.";
  }
  if (error instanceof Error) return error.message;
  return "Agent grading workflow unavailable.";
}

export function splitLines(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

export function rubricToEditableText(rubric: ProjectRubric) {
  return (rubric.criteria ?? [])
    .map((criterion) =>
      [criterion.title ?? criterion.criterion ?? "Criterion", criterion.description ?? "", criterion.points ?? ""].join(" | "),
    )
    .join("\n");
}

export function parseRubricText(value: string): ProjectRubricCriterion[] {
  return splitLines(value).map((line, index) => {
    const [title, description, points] = line.split("|").map((part) => part.trim());
    return {
      id: `criterion-${index + 1}`,
      title: title || `Criterion ${index + 1}`,
      description: description || "Describe what successful work should show.",
      points: points || undefined,
    };
  });
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function defaultCriteria(): ProjectRubricCriterion[] {
  return [
    {
      id: "criterion-understanding",
      title: "Concept understanding",
      description: "Applies the relevant course concepts accurately.",
      points: 40,
    },
    {
      id: "criterion-evidence",
      title: "Required evidence",
      description: "Includes enough artifact evidence for grading.",
      points: 35,
    },
    {
      id: "criterion-reflection",
      title: "Reflection",
      description: "Explains tradeoffs, limitations, and next improvements.",
      points: 25,
    },
  ];
}
