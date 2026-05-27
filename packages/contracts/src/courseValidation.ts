import type {
  LyciumCourseBlock,
  LyciumCourseData,
  LyciumCourseEntry,
  LyciumCourseModule,
  LyciumCourseSection,
  LyciumCourseValidationOptions,
  LyciumCourseValidationResult,
  LyciumSourceRecordLike,
} from "./courseTypes";
import { isCourseCategoryId, isCourseDepartmentInCategory } from "./courseTaxonomy";

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

export function validateCourseTaxonomy(course: Pick<LyciumCourseData, "category" | "department">): string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(course.category)) {
    errors.push("Course category is missing.");
    return errors;
  }

  if (!isCourseCategoryId(course.category)) {
    errors.push(`Course category "${course.category}" is not in the taxonomy.`);
    return errors;
  }

  if (!isNonEmptyString(course.department)) {
    errors.push("Course department is missing.");
    return errors;
  }

  if (!isCourseDepartmentInCategory(course.category, course.department)) {
    errors.push(`Course department "${course.department}" is not in category "${course.category}".`);
  }

  return errors;
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

  errors.push(...validateCourseTaxonomy(course));

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
