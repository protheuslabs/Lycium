export const LYCIUM_COURSE_CONTRACT_VERSION = "0.1.0" as const;

export type LyciumPageType = "learn" | "apply";
export type LyciumSectionType = "lesson" | "assessment" | "summary" | string;

export type LyciumSourceRecord = {
  id: string;
  type?: string;
  title?: string;
  url?: string;
  embedUrl?: string;
  localPath?: string;
  usedByCourseIds?: string[];
  usedByCourseTitles?: string[];
  [key: string]: unknown;
};

export type LyciumConcept = {
  name?: string;
  description?: string;
  sourceSectionId?: string;
};

export type LyciumQuizQuestion = {
  question?: string;
  options?: string[];
  answer?: number;
  answers?: number[];
  timed?: "t" | "f" | boolean;
};

export type LyciumCourseBlock = {
  type: string;
  title?: string;
  value?: string;
  url?: string;
  sourceIds?: string[];
  concepts?: LyciumConcept[];
  question?: string;
  questions?: LyciumQuizQuestion[];
  questionBank?: unknown;
  question_bank?: unknown;
  questionsPerAttempt?: number | string;
  questions_per_attempt?: number | string;
  questionCount?: number | string;
  question_count?: number | string;
  options?: string[];
  answer?: number;
  answers?: number[];
  name?: string;
  description?: string;
  timed?: "t" | "f" | boolean;
  maxAttempts?: number | string;
  max_attempts?: number | string;
  attemptLimit?: number | string;
  attempt_limit?: number | string;
  timeLimit?: number | string;
  time_limit?: number | string;
  timeLimitSeconds?: number | string;
  time_limit_seconds?: number | string;
  passPercentage?: number | string;
  pass_percentage?: number | string;
  passPercent?: number | string;
  pass_percent?: number | string;
  showAnswers?: boolean | string;
  show_answers?: boolean | string;
  showCorrectAnswers?: boolean | string;
  show_correct_answers?: boolean | string;
};

export type LyciumCourseSection = {
  id: string;
  title: string;
  content: LyciumCourseBlock[];
  sourceIds?: string[];
  pageType?: LyciumPageType;
  sectionType?: LyciumSectionType;
};

export type LyciumCourseModule = {
  id: string;
  title: string;
  sections: LyciumCourseSection[];
  sourceIds?: string[];
};

export type LyciumCourseData = {
  title: string;
  shortDescription?: string;
  difficultyLevel?: string;
  category?: string;
  tags?: string[];
  learningTypes?: string[];
  orderMandatory?: boolean;
  sourceIds?: string[];
  sourceRecords?: LyciumSourceRecord[] | Record<string, LyciumSourceRecord | Record<string, unknown>>;
  metadata?: {
    pacingLabel?: "Module" | "Week" | string;
    [key: string]: unknown;
  };
  modules: LyciumCourseModule[];
};

export type LyciumCourseEntry = {
  key: string;
  title: string;
  data: LyciumCourseData;
  snapshotId?: number;
  source: "local" | "remote" | string;
};

export type LyciumSourceRecordLike = {
  id?: unknown;
};

export type LyciumCourseValidationOptions = {
  centralSourceRecords?: ReadonlyArray<LyciumSourceRecordLike>;
  requireSources?: boolean;
};

export type LyciumCourseValidationResult = {
  valid: boolean;
  errors: string[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sourceIdsFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
}

function addSourceIds(ids: Set<string>, value: unknown) {
  for (const sourceId of sourceIdsFrom(value)) {
    ids.add(sourceId);
  }
}

function getDeclaredSourceIds(
  course: LyciumCourseData,
  centralSourceRecords: ReadonlyArray<LyciumSourceRecordLike>,
): Set<string> {
  const declared = new Set<string>();

  for (const source of centralSourceRecords) {
    if (isNonEmptyString(source.id)) {
      declared.add(source.id);
    }
  }

  const courseSourceRecords = course.sourceRecords;
  if (Array.isArray(courseSourceRecords)) {
    for (const source of courseSourceRecords) {
      if (source && typeof source === "object" && isNonEmptyString(source.id)) {
        declared.add(source.id);
      }
    }
  } else if (courseSourceRecords && typeof courseSourceRecords === "object") {
    for (const sourceId of Object.keys(courseSourceRecords)) {
      if (sourceId.trim()) {
        declared.add(sourceId);
      }
    }
  }

  return declared;
}

function getQuizQuestions(block: LyciumCourseBlock): unknown[] {
  if (Array.isArray(block.questions)) {
    return block.questions;
  }

  if (Array.isArray(block.questionBank)) {
    return block.questionBank;
  }

  if (Array.isArray(block.question_bank)) {
    return block.question_bank;
  }

  return [];
}

function validateConceptCards(block: LyciumCourseBlock, location: string, errors: string[]) {
  if (!Array.isArray(block.concepts) || block.concepts.length === 0) {
    errors.push(`${location} conceptCards block must include concepts.`);
    return;
  }

  block.concepts.forEach((concept, conceptIndex) => {
    if (!concept || typeof concept !== "object") {
      errors.push(`${location} concept ${conceptIndex + 1} must be an object.`);
      return;
    }

    if (!isNonEmptyString(concept.name)) {
      errors.push(`${location} concept ${conceptIndex + 1} is missing name.`);
    }

    if (!isNonEmptyString(concept.description)) {
      errors.push(`${location} concept ${conceptIndex + 1} is missing description.`);
    }
  });
}

function validateQuizBlock(block: LyciumCourseBlock, location: string, errors: string[]) {
  const questions = getQuizQuestions(block);
  if (questions.length === 0) {
    errors.push(`${location} quiz must include questions or questionBank.`);
    return;
  }

  questions.forEach((question, questionIndex) => {
    if (!question || typeof question !== "object") {
      errors.push(`${location} question ${questionIndex + 1} must be an object.`);
      return;
    }

    const candidate = question as { answers?: unknown; options?: unknown };
    if (!Array.isArray(candidate.options) || candidate.options.length < 2) {
      errors.push(`${location} question ${questionIndex + 1} must include at least two options.`);
    }

    if (!Array.isArray(candidate.answers)) {
      errors.push(`${location} question ${questionIndex + 1} must use an answers array.`);
    }
  });
}

function validateSection(
  section: LyciumCourseSection,
  sectionLocation: string,
  pacingLabel: string,
  referencedSourceIds: Set<string>,
  errors: string[],
) {
  if (!isNonEmptyString(section.id)) {
    errors.push(`${sectionLocation} is missing id.`);
  }

  if (!isNonEmptyString(section.title)) {
    errors.push(`${sectionLocation} is missing title.`);
  }

  if (section.pageType !== "learn" && section.pageType !== "apply") {
    errors.push(`${sectionLocation} must set pageType to learn or apply.`);
  }

  if (!Array.isArray(section.content) || section.content.length === 0) {
    errors.push(`${sectionLocation} must include content blocks.`);
    return;
  }

  addSourceIds(referencedSourceIds, section.sourceIds);

  const quizBlocks = section.content.filter((block) => block.type === "quiz");
  const conceptBlocks = section.content.filter((block) => block.type === "conceptCards");

  for (const block of section.content) {
    addSourceIds(referencedSourceIds, block.sourceIds);
    if (block.type === "video" && isNonEmptyString(block.url) && sourceIdsFrom(block.sourceIds).length === 0) {
      errors.push(`${sectionLocation} video block must reference a sourceId.`);
    }
  }

  if (quizBlocks.length > 0) {
    if (section.pageType !== "apply" || section.sectionType !== "assessment") {
      errors.push(`${sectionLocation} quiz section must be an assessment apply page.`);
    }

    if (quizBlocks.length !== section.content.length) {
      errors.push(`${sectionLocation} mixes quiz blocks with non-quiz content.`);
    }

    quizBlocks.forEach((block, quizIndex) =>
      validateQuizBlock(block, `${sectionLocation} quiz ${quizIndex + 1}`, errors)
    );
    return;
  }

  if (section.sectionType === "summary") {
    const expectedTitle = `${pacingLabel} concepts`;
    if (section.pageType !== "learn") {
      errors.push(`${sectionLocation} summary must be a learn page.`);
    }

    if (conceptBlocks.length !== 1 || conceptBlocks[0]?.title !== expectedTitle) {
      errors.push(`${sectionLocation} summary must include one ${expectedTitle} block.`);
    }

    conceptBlocks.forEach((block) => validateConceptCards(block, sectionLocation, errors));
    return;
  }

  if (section.pageType === "learn") {
    if (conceptBlocks.length === 0) {
      errors.push(`${sectionLocation} learn page must include conceptCards.`);
      return;
    }

    const finalBlock = section.content[section.content.length - 1];
    if (finalBlock?.type !== "conceptCards" || finalBlock.title !== "Concepts introduced") {
      errors.push(`${sectionLocation} learn page must end with Concepts introduced conceptCards.`);
    }

    conceptBlocks.forEach((block) => validateConceptCards(block, sectionLocation, errors));
  }
}

function validateModule(
  module: LyciumCourseModule,
  moduleLocation: string,
  pacingLabel: string,
  referencedSourceIds: Set<string>,
  errors: string[],
) {
  if (!isNonEmptyString(module.id)) {
    errors.push(`${moduleLocation} is missing id.`);
  }

  if (!isNonEmptyString(module.title)) {
    errors.push(`${moduleLocation} is missing title.`);
  }

  addSourceIds(referencedSourceIds, module.sourceIds);

  if (!Array.isArray(module.sections) || module.sections.length === 0) {
    errors.push(`${moduleLocation} must include sections.`);
    return;
  }

  const lastSection = module.sections[module.sections.length - 1];
  if (lastSection?.sectionType !== "summary") {
    errors.push(`${moduleLocation} must end with a summary section.`);
  }

  module.sections.forEach((section, sectionIndex) =>
    validateSection(section, `${moduleLocation} section ${sectionIndex + 1}`, pacingLabel, referencedSourceIds, errors)
  );
}

export function validateLyciumCourseEntry(
  courseEntry: LyciumCourseEntry,
  options: LyciumCourseValidationOptions = {},
): LyciumCourseValidationResult {
  const errors: string[] = [];
  const course = courseEntry.data;
  const pacingLabel = course.metadata?.pacingLabel === "Week" ? "Week" : "Module";
  const referencedSourceIds = new Set<string>();
  const declaredSourceIds = getDeclaredSourceIds(course, options.centralSourceRecords ?? []);

  if (!isNonEmptyString(course.title)) {
    errors.push("Course is missing title.");
  }

  if (!isNonEmptyString(course.shortDescription)) {
    errors.push("Course is missing shortDescription.");
  }

  if (!Array.isArray(course.modules) || course.modules.length === 0) {
    errors.push("Course must include at least one module.");
    return { valid: false, errors };
  }

  if (course.metadata?.pacingLabel && course.metadata.pacingLabel !== "Module" && course.metadata.pacingLabel !== "Week") {
    errors.push("Course metadata.pacingLabel must be Module or Week.");
  }

  addSourceIds(referencedSourceIds, course.sourceIds);

  course.modules.forEach((module, moduleIndex) =>
    validateModule(module, `module ${moduleIndex + 1}`, pacingLabel, referencedSourceIds, errors)
  );

  if (options.requireSources && referencedSourceIds.size === 0) {
    errors.push("Generated courses must reference at least one sourceId.");
  }

  const missingSourceIds = [...referencedSourceIds].filter((sourceId) => !declaredSourceIds.has(sourceId));
  if (missingSourceIds.length > 0) {
    errors.push(`Referenced sourceIds are missing source records: ${missingSourceIds.slice(0, 8).join(", ")}.`);
  }

  return { valid: errors.length === 0, errors };
}

export const validateCourseEntry = validateLyciumCourseEntry;

export function formatCourseValidationErrors(errors: string[]): string {
  return errors.slice(0, 6).join("; ");
}

export type LearningBlockType = LyciumCourseBlock["type"];
export type SourceReference = LyciumSourceRecord;
export type LearningBlock = LyciumCourseBlock;
export type CourseSection = LyciumCourseSection;
export type CourseSnapshot = LyciumCourseData;
