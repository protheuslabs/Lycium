import { useMemo, useState, type ChangeEvent } from "react";
import { API_BASE } from "../../runtime/appRuntime";
import { EditPencilButton, promptForText } from "./CourseEditControls";
import type {
  ContentBlock,
  ProjectGraderWorkflow,
  ProjectRubric,
  ProjectRubricCriterion,
  ProjectSubmissionPolicy,
  SourceRecord,
} from "./contentViewTypes";

type ProjectBlockProps = {
  block: ContentBlock;
  isEditMode: boolean;
  onChange?: (block: ContentBlock) => void;
  sectionId?: string;
  sectionTitle?: string;
  sourceRecords?: SourceRecord[];
};

type ProjectSubmissionDraft = {
  text: string;
  link: string;
  fileName: string;
};

type ProjectGradeReport = {
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
};

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  docx: "DOCX",
  file: "File",
  image: "Image",
  link: "Link",
  pdf: "PDF",
  text: "Text",
};

export default function ProjectBlock({ block, isEditMode, onChange, sectionId, sectionTitle, sourceRecords = [] }: ProjectBlockProps) {
  const [submission, setSubmission] = useState<ProjectSubmissionDraft>({ text: "", link: "", fileName: "" });
  const [submitted, setSubmitted] = useState(false);
  const [gradeMessage, setGradeMessage] = useState("");
  const [gradeReport, setGradeReport] = useState<ProjectGradeReport | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const rubric = useMemo(() => normalizeRubric(block.rubric), [block.rubric]);
  const submissionPolicy = useMemo(() => normalizeSubmissionPolicy(block.submission), [block.submission]);
  const graderWorkflow = normalizeGraderWorkflow(block.graderWorkflow);
  const acceptedTypes = submissionPolicy.acceptedTypes ?? ["text", "link"];
  const acceptsText = acceptedTypes.includes("text");
  const acceptsLink = acceptedTypes.includes("link");
  const fileAccept = acceptedFileTypesFor(submissionPolicy);
  const acceptsFile = fileAccept.length > 0 || acceptedTypes.some((type) => ["pdf", "docx", "image", "file"].includes(type));
  const hasSubmission = Boolean(submission.text.trim() || submission.link.trim() || submission.fileName.trim());
  const title = block.title ?? "Project title";
  const instructions = block.instructions ?? block.description ?? block.value ?? block.text ?? "Complete the project and submit the required evidence.";
  const requiredEvidence = Array.isArray(block.requiredEvidence) ? block.requiredEvidence : [];

  const updateBlock = (patch: Partial<ContentBlock>) => onChange?.({ ...block, ...patch });
  const updateSubmissionPolicy = (patch: Partial<ProjectSubmissionPolicy>) =>
    updateBlock({ submission: { ...submissionPolicy, ...patch } });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileName = event.target.files?.[0]?.name ?? "";
    setSubmission((current) => ({ ...current, fileName }));
  };

  const submitProject = () => {
    if (!hasSubmission) {
      return;
    }

    setSubmitted(true);
    setGradeMessage("");
    setGradeReport(null);
  };

  const requestAgentGrade = async () => {
    if (!submitted) {
      return;
    }

    setIsGrading(true);
    setGradeMessage("");
    try {
      const response = await fetch(`${API_BASE}/v1/submissions/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: undefined,
          sectionId,
          sectionTitle,
          projectBlock: block,
          submission,
          sourceRecords,
          grader: graderWorkflow.grader ?? "agent",
        }),
      });

      if (!response.ok) {
        throw new Error(`Grading failed with status ${response.status}.`);
      }

      const report = await response.json() as ProjectGradeReport;
      setGradeReport(report);
      setGradeMessage(report.summary ?? "Submission graded.");
    } catch (error) {
      setGradeMessage(error instanceof Error ? error.message : "Agent grading workflow unavailable.");
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <section className="project-block" aria-label={title}>
      <div className="project-block-header">
        <div>
          <p className="project-block-kicker">{block.artifactType ?? "Project"}</p>
          <h3>{title}</h3>
        </div>
        {isEditMode && (
          <EditPencilButton
            label="Edit project title"
            onClick={() => promptForText("Edit project title", title, (nextTitle) => updateBlock({ title: nextTitle }))}
          />
        )}
      </div>

      <div className="project-block-section">
        <div className="project-block-section-title">
          <h4>Instructions</h4>
          {isEditMode && (
            <EditPencilButton
              label="Edit project instructions"
              onClick={() => promptForText("Edit project instructions", instructions, (nextInstructions) => updateBlock({ instructions: nextInstructions }))}
            />
          )}
        </div>
        <p>{instructions}</p>
      </div>

      <div className="project-block-section">
        <div className="project-block-section-title">
          <h4>Required evidence</h4>
          {isEditMode && (
            <EditPencilButton
              label="Edit required evidence"
              onClick={() =>
                promptForText("Edit required evidence", requiredEvidence.join("\n"), (value) =>
                  updateBlock({ requiredEvidence: splitLines(value) }),
                )
              }
            />
          )}
        </div>
        {requiredEvidence.length > 0 ? (
          <ul className="project-evidence-list">
            {requiredEvidence.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ul>
        ) : (
          <p className="project-muted">No required evidence has been listed yet.</p>
        )}
      </div>

      <div className="project-block-section">
        <div className="project-block-section-title">
          <h4>{rubric.title}</h4>
          {isEditMode && (
            <EditPencilButton
              label="Edit rubric"
              onClick={() =>
                promptForText("Edit rubric", rubricToEditableText(rubric), (value) =>
                  updateBlock({ rubric: { ...rubric, criteria: parseRubricText(value) } }),
                )
              }
            />
          )}
        </div>
        <div className="project-rubric-table-wrap">
          <table className="project-rubric-table">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Expectations</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {rubric.criteria.map((criterion) => (
                <tr key={criterion.id ?? criterion.title ?? criterion.criterion}>
                  <td>{criterion.title ?? criterion.criterion ?? "Criterion"}</td>
                  <td>
                    <span>{criterion.description ?? "Describe what successful work should show."}</span>
                    {Array.isArray(criterion.levels) && criterion.levels.length > 0 && (
                      <div className="project-rubric-levels">
                        {criterion.levels.map((level, index) => (
                          <span key={`${level.label}-${index}`}>{level.label ?? `Level ${index + 1}`}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{criterion.points ?? "Mastery"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="project-block-section project-submission-box">
        <div className="project-block-section-title">
          <h4>Submission</h4>
          {isEditMode && (
            <EditPencilButton
              label="Edit accepted submission types"
              onClick={() =>
                promptForText("Edit accepted submission types", acceptedTypes.join(", "), (value) =>
                  updateSubmissionPolicy({ acceptedTypes: splitCsv(value) }),
                )
              }
            />
          )}
        </div>
        {submissionPolicy.instructions && <p>{submissionPolicy.instructions}</p>}
        <div className="project-submission-types" aria-label="Accepted submission types">
          {acceptedTypes.map((type) => <span key={type}>{SUBMISSION_TYPE_LABELS[type] ?? type}</span>)}
        </div>
        <div className="project-submission-fields">
          {acceptsText && (
            <label>
              <span>Text submission</span>
              <textarea
                disabled={isEditMode}
                value={submission.text}
                onChange={(event) => setSubmission((current) => ({ ...current, text: event.target.value }))}
                placeholder="Write or paste the project submission text."
              />
            </label>
          )}
          {acceptsLink && (
            <label>
              <span>Link submission</span>
              <input
                disabled={isEditMode}
                type="url"
                value={submission.link}
                onChange={(event) => setSubmission((current) => ({ ...current, link: event.target.value }))}
                placeholder="https://example.com/project"
              />
            </label>
          )}
          {acceptsFile && (
            <label>
              <span>File submission</span>
              <input
                disabled={isEditMode}
                type="file"
                accept={fileAccept.join(",")}
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>
        <div className="project-submission-actions">
          <button type="button" disabled={isEditMode || !hasSubmission} onClick={submitProject}>
            Submit project
          </button>
          <button type="button" disabled={isEditMode || !submitted || isGrading} onClick={requestAgentGrade}>
            {isGrading ? "Grading..." : "Grade with agent"}
          </button>
        </div>
        <p className="project-grader-status">
          Grader: {graderWorkflow.grader ?? "agent"} · Rubric: {graderWorkflow.rubricId ?? rubric.id ?? "rubric"} · Status: {gradeReport ? "graded" : submitted ? "submitted" : graderWorkflow.status ?? "ready"}
        </p>
        {gradeMessage && <p className="project-grader-message">{gradeMessage}</p>}
        {gradeReport && (
          <div className="project-grade-report" aria-label="Project grade report">
            <strong>{formatGradeScore(gradeReport)}</strong>
            {gradeReport.feedback && <p>{gradeReport.feedback}</p>}
            {Array.isArray(gradeReport.criterionResults) && gradeReport.criterionResults.length > 0 && (
              <ul>
                {gradeReport.criterionResults.map((result) => (
                  <li key={result.criterionId}>
                    <span>{result.title}</span>
                    <em>{result.score}/{result.maxScore} · {result.level}</em>
                    <small>{result.feedback}</small>
                  </li>
                ))}
              </ul>
            )}
            {Array.isArray(gradeReport.nextSteps) && gradeReport.nextSteps.length > 0 && (
              <ol>
                {gradeReport.nextSteps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
              </ol>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function formatGradeScore(report: ProjectGradeReport) {
  const score = typeof report.scorePercentage === "number" ? `${report.scorePercentage}%` : "Score unavailable";
  return `${score}${report.passed === undefined ? "" : report.passed ? " passed" : " needs revision"}`;
}

function normalizeRubric(rawRubric: ContentBlock["rubric"]): Required<ProjectRubric> {
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
    criteria: Array.isArray(rawRubric?.criteria) && rawRubric.criteria.length > 0 ? rawRubric.criteria : defaultCriteria(),
  };
}

function normalizeSubmissionPolicy(rawPolicy: ContentBlock["submission"]): ProjectSubmissionPolicy {
  return {
    acceptedTypes: rawPolicy?.acceptedTypes?.length ? rawPolicy.acceptedTypes : ["text", "link"],
    acceptedFileTypes: rawPolicy?.acceptedFileTypes ?? [],
    instructions: rawPolicy?.instructions ?? "Submit the artifact in one accepted format.",
    maxFiles: rawPolicy?.maxFiles,
    maxFileSizeMb: rawPolicy?.maxFileSizeMb,
  };
}

function normalizeGraderWorkflow(rawWorkflow: ContentBlock["graderWorkflow"]): ProjectGraderWorkflow {
  return {
    grader: rawWorkflow?.grader ?? "agent",
    rubricId: rawWorkflow?.rubricId,
    status: rawWorkflow?.status ?? "ready",
    allowedContext: rawWorkflow?.allowedContext,
    feedbackPolicy: rawWorkflow?.feedbackPolicy,
  };
}

function acceptedFileTypesFor(policy: ProjectSubmissionPolicy) {
  const explicit = policy.acceptedFileTypes ?? [];
  const fromTypes = (policy.acceptedTypes ?? []).flatMap((type) => {
    if (type === "pdf") return [".pdf"];
    if (type === "docx") return [".docx"];
    if (type === "image") return ["image/*"];
    if (type === "file") return ["*/*"];
    return [];
  });

  return Array.from(new Set([...explicit, ...fromTypes]));
}

function splitLines(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function splitCsv(value: string) {
  return value.split(/[,\n]+/).map((line) => line.trim().toLowerCase()).filter(Boolean);
}

function rubricToEditableText(rubric: ProjectRubric) {
  return (rubric.criteria ?? [])
    .map((criterion) =>
      [criterion.title ?? criterion.criterion ?? "Criterion", criterion.description ?? "", criterion.points ?? ""].join(" | "),
    )
    .join("\n");
}

function parseRubricText(value: string): ProjectRubricCriterion[] {
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
