import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { API_BASE } from "../../runtime/appRuntime";
import Dropdown from "../Dropdown/Dropdown";
import { EditPencilButton, promptForText } from "./CourseEditControls";
import type { ContentBlock, ProjectSubmissionPolicy, SourceRecord } from "./contentViewTypes";
import {
  SUBMISSION_TYPE_LABELS,
  SUBMISSION_TYPE_OPTIONS,
  acceptedFileTypesFor,
  defaultAcceptedFileTypesFor,
  formatGradeScore,
  gradingErrorMessage,
  gradingHttpErrorMessage,
  hasSubmissionForType,
  isFileSubmissionType,
  normalizeGraderWorkflow,
  normalizeRubric,
  normalizeSubmissionPolicy,
  parseRubricText,
  resolveSubmissionType,
  rubricToEditableText,
  splitLines,
  submissionCommentBody,
  type ProjectGradeReport,
  type ProjectSubmissionDraft,
} from "./projectBlockUtils";
import { projectKeyFor, readProjectSubmissionRecord, writeProjectSubmissionRecord } from "./projectSubmissionStatus";
import { useProjectComments } from "./useProjectComments";

type ProjectBlockProps = {
  block: ContentBlock;
  courseKey: string;
  isEditMode: boolean;
  onChange?: (block: ContentBlock) => void;
  sectionId?: string;
  sectionTitle?: string;
  sourceRecords?: SourceRecord[];
  onSubmissionChange?: (projectKey: string, submitted: boolean) => void;
};

export default function ProjectBlock({
  block,
  courseKey,
  isEditMode,
  onChange,
  sectionId,
  sectionTitle,
  sourceRecords = [],
  onSubmissionChange,
}: ProjectBlockProps) {
  const [submission, setSubmission] = useState<ProjectSubmissionDraft>({ text: "", link: "", fileName: "" });
  const [submitted, setSubmitted] = useState(() => readProjectSubmissionRecord(projectKeyFor(courseKey, sectionId, block))?.submitted === true);
  const [gradeMessage, setGradeMessage] = useState("");
  const [gradeReport, setGradeReport] = useState<ProjectGradeReport | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const textSubmissionRef = useRef<HTMLTextAreaElement | null>(null);
  const linkSubmissionRef = useRef<HTMLInputElement | null>(null);
  const rubric = useMemo(() => normalizeRubric(block.rubric), [block.rubric]);
  const submissionPolicy = useMemo(() => normalizeSubmissionPolicy(block.submission), [block.submission]);
  const graderWorkflow = normalizeGraderWorkflow(block.graderWorkflow);
  const submissionType = resolveSubmissionType(submissionPolicy);
  const fileAccept = acceptedFileTypesFor(submissionPolicy);
  const title = block.title ?? "Project title";
  const instructions = block.instructions ?? block.description ?? block.value ?? block.text ?? "Complete the project and submit the required evidence.";
  const requiredEvidence = Array.isArray(block.requiredEvidence) ? block.requiredEvidence : [];
  const projectKey = projectKeyFor(courseKey, sectionId, block);
  const { addComment, comments, draftComment, setDraftComment } = useProjectComments(projectKey);
  const submitButtonLabel = isGrading ? "Submitting..." : submitted ? "Resubmit" : "Submit";

  useEffect(() => {
    onSubmissionChange?.(projectKey, submitted);
  }, [onSubmissionChange, projectKey, submitted]);

  const updateBlock = (patch: Partial<ContentBlock>) => onChange?.({ ...block, ...patch });
  const updateSubmissionPolicy = (patch: Partial<ProjectSubmissionPolicy>) =>
    updateBlock({ submission: { ...submissionPolicy, ...patch } });
  const getCurrentSubmission = (): ProjectSubmissionDraft => ({
    text: textSubmissionRef.current?.value ?? submission.text,
    link: linkSubmissionRef.current?.value ?? submission.link,
    fileName: submission.fileName,
    fileMimeType: submission.fileMimeType,
    fileDataBase64: submission.fileDataBase64,
  });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSubmission((current) => ({ ...current, fileName: "", fileMimeType: undefined, fileDataBase64: undefined }));
      return;
    }

    const fileDataBase64 = await fileToBase64(file);
    setSubmission((current) => ({
      ...current,
      fileName: file.name,
      fileMimeType: file.type || undefined,
      fileDataBase64,
    }));
  };

  const gradeSubmission = async (submissionToGrade: ProjectSubmissionDraft) => {
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
          submission: { ...submissionToGrade, submissionType },
          sourceRecords,
          grader: graderWorkflow.grader ?? "agent",
        }),
      });

      if (!response.ok) throw new Error(gradingHttpErrorMessage(response.status));

      const report = await response.json() as ProjectGradeReport;
      setGradeReport(report);
      setGradeMessage(report.summary ?? "Submission graded.");
      addComment("grader", [report.summary, report.feedback].filter(Boolean).join("\n\n") || "Submission graded.");
    } catch (error) {
      setGradeMessage(gradingErrorMessage(error));
    } finally {
      setIsGrading(false);
    }
  };

  const submitProject = async () => {
    const currentSubmission = getCurrentSubmission();
    if (!hasSubmissionForType(currentSubmission, submissionType)) {
      setGradeMessage("Add a submission before submitting.");
      return;
    }
    setSubmission(currentSubmission);
    setSubmitted(true);
    const commentBody = submissionCommentBody(currentSubmission, submissionType);
    writeProjectSubmissionRecord(projectKey, {
      submitted: true,
      submittedAt: new Date().toISOString(),
      submissionType,
      summary: commentBody,
    });
    addComment("learner", commentBody);
    setGradeMessage((graderWorkflow.grader ?? "agent") === "agent" ? "Submission received. Grading..." : "Submission received.");
    setGradeReport(null);
    if ((graderWorkflow.grader ?? "agent") === "agent") await gradeSubmission(currentSubmission);
  };

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addComment("learner", draftComment);
    setDraftComment("");
  };

  return (
    <section className="project-block" aria-label={title}>
      <div className="project-block-layout">
        <div className="project-block-main">
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
                <Dropdown
                  className="project-submission-type-dropdown"
                  value={submissionType}
                  options={SUBMISSION_TYPE_OPTIONS}
                  onChange={(nextType) =>
                    updateSubmissionPolicy({
                      submissionType: nextType,
                      acceptedTypes: [nextType],
                      acceptedFileTypes: defaultAcceptedFileTypesFor(nextType),
                    })
                  }
                  ariaLabel="Project submission type"
                />
              )}
            </div>
            {submissionPolicy.instructions && <p>{submissionPolicy.instructions}</p>}
            <div className="project-submission-types" aria-label="Accepted submission type">
              <span>{SUBMISSION_TYPE_LABELS[submissionType] ?? submissionType}</span>
            </div>
            <div
              className="project-submission-form"
            >
              <div className="project-submission-fields">
                {submissionType === "text" && (
                  <label>
                    <span>Text submission</span>
                    <textarea
                      ref={textSubmissionRef}
                      disabled={isEditMode}
                      value={submission.text}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setSubmission((current) => ({ ...current, text: nextValue }));
                      }}
                      placeholder="Write or paste the project submission text."
                    />
                  </label>
                )}
                {submissionType === "link" && (
                  <label>
                    <span>Link submission</span>
                    <input
                      ref={linkSubmissionRef}
                      disabled={isEditMode}
                      type="url"
                      value={submission.link}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setSubmission((current) => ({ ...current, link: nextValue }));
                      }}
                      placeholder="https://example.com/project"
                    />
                  </label>
                )}
                {isFileSubmissionType(submissionType) && (
                  <label>
                    <span>{SUBMISSION_TYPE_LABELS[submissionType] ?? "File"} submission</span>
                    <input disabled={isEditMode} type="file" accept={fileAccept.join(",")} onChange={handleFileChange} />
                  </label>
                )}
              </div>
              <div className="project-submission-actions">
                <button type="button" disabled={isEditMode || isGrading} onClick={() => void submitProject()}>
                  {submitButtonLabel}
                </button>
              </div>
            </div>
            {gradeMessage && <p className="project-grader-message">{gradeMessage}</p>}
            {gradeReport && (
              <div className="project-grade-report" aria-label="Project grade report">
                <strong>{formatGradeScore(gradeReport)}</strong>
                {gradeReport.feedback && <p>{gradeReport.feedback}</p>}
                {Array.isArray(gradeReport.errors) && gradeReport.errors.length > 0 && (
                  <ul>
                    {gradeReport.errors.map((error) => (
                      <li key={error.code}>
                        <span>{error.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
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
        </div>

        <aside className="project-comments-panel" aria-label="Project comments">
          <h4>Comments</h4>
          <div className="project-comment-list">
            {comments.length === 0 ? (
              <p className="project-muted">No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <article className={`project-comment project-comment--${comment.authorRole}`} key={comment.id}>
                  <p>{comment.body}</p>
                  <div className="project-comment-meta">
                    <span>{comment.authorLabel}</span>
                    <time dateTime={comment.createdAt}>{formatCommentTime(comment.createdAt)}</time>
                  </div>
                </article>
              ))
            )}
          </div>
          <form className="project-comment-form" onSubmit={submitComment}>
            <label>
              <span className="project-comment-label">Comment</span>
              <textarea
                disabled={isEditMode}
                value={draftComment}
                onChange={(event) => setDraftComment(event.currentTarget.value)}
                placeholder="Add comment"
              />
            </label>
            <button type="submit" disabled={isEditMode || !draftComment.trim()}>
              Add comment
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function formatCommentTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const now = new Date();
  const isToday =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();

  return new Intl.DateTimeFormat(undefined, isToday ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}
