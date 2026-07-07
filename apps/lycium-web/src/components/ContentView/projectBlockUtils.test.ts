import { describe, expect, it } from "vitest";
import {
  acceptedFileTypesFor,
  formatGradeScore,
  gradingErrorMessage,
  gradingHttpErrorMessage,
  hasSubmissionForType,
  normalizeRubric,
  normalizeSubmissionPolicy,
  parseRubricText,
  resolveSubmissionType,
  rubricToEditableText,
  submissionCommentBody,
  type ProjectSubmissionDraft,
} from "./projectBlockUtils";

const emptyDraft: ProjectSubmissionDraft = { text: "", link: "", fileName: "" };

describe("project block utilities", () => {
  it("supplies a complete default rubric without mutating custom criteria", () => {
    const fallback = normalizeRubric(undefined);
    const customCriteria = [{ id: "accuracy", title: "Accuracy", points: 10 }];
    const custom = normalizeRubric({ id: "custom", title: "Custom rubric", criteria: customCriteria });

    expect(fallback.title).toBe("Project rubric");
    expect(fallback.criteria).toHaveLength(3);
    expect(custom.criteria).toBe(customCriteria);
  });

  it("parses editable rubric text into normalized criteria", () => {
    const criteria = parseRubricText("Accuracy | Uses correct evidence | 20\nReflection");

    expect(criteria).toEqual([
      {
        id: "criterion-1",
        title: "Accuracy",
        description: "Uses correct evidence",
        points: "20",
      },
      {
        id: "criterion-2",
        title: "Reflection",
        description: "Describe what successful work should show.",
        points: undefined,
      },
    ]);
    expect(rubricToEditableText({ criteria })).toContain("Accuracy | Uses correct evidence | 20");
  });

  it("normalizes submission types and combines default file acceptance", () => {
    const policy = normalizeSubmissionPolicy({
      submissionType: "document",
      acceptedFileTypes: [".odt", ".pdf"],
    });

    expect(resolveSubmissionType(policy)).toBe("doc");
    expect(acceptedFileTypesFor(policy)).toEqual([".odt", ".pdf", ".docx"]);
    expect(normalizeSubmissionPolicy(undefined).acceptedTypes).toEqual(["text"]);
  });

  it("validates and summarizes each submission shape", () => {
    const text = { ...emptyDraft, text: "  Analysis  " };
    const link = { ...emptyDraft, link: " https://example.com/work " };
    const file = { ...emptyDraft, fileName: " report.pdf " };

    expect(hasSubmissionForType(emptyDraft, "text")).toBe(false);
    expect(hasSubmissionForType(text, "text")).toBe(true);
    expect(hasSubmissionForType(link, "link")).toBe(true);
    expect(hasSubmissionForType(file, "pdf")).toBe(true);
    expect(submissionCommentBody(text, "text")).toBe("Submitted text response.");
    expect(submissionCommentBody(link, "link")).toBe("Submitted link: https://example.com/work");
    expect(submissionCommentBody(file, "pdf")).toBe("Submitted file: report.pdf");
  });

  it("formats grade outcomes and actionable errors", () => {
    expect(formatGradeScore({ score: 8.5, maxScore: 10, scorePercentage: 85, passed: true }))
      .toBe("8.5/10 85% passed");
    expect(formatGradeScore({ status: "needs_review" })).toBe("Score unavailable needs review");
    expect(gradingHttpErrorMessage(503)).toContain("unavailable");
    expect(gradingHttpErrorMessage(418)).toBe("The grader returned status 418.");
    expect(gradingErrorMessage(new Error("Custom failure"))).toBe("Custom failure");
  });
});
