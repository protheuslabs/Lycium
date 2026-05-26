import type { CourseModule } from "../courseTypes";

type ConceptSpec = {
  name: string;
  description: string;
};

export type LessonTopicSpec = {
  title: string;
  description: string;
  concepts: ConceptSpec[];
  sourceIds?: string[];
};

export type FullCourseModuleSpec = {
  title: string;
  objective: string;
  studio: string;
  topics: LessonTopicSpec[];
  sourceIds?: string[];
};

type BuildFullCourseModulesOptions = {
  coursePrefix: string;
  pacingLabel: "Module" | "Week" | string;
  moduleSpecs: FullCourseModuleSpec[];
  defaultSourceIds?: string[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function makeQuestionOptions(concept: ConceptSpec, neighborA: ConceptSpec, neighborB: ConceptSpec) {
  return [
    concept.description,
    `A project-management label for work about ${neighborA.name}.`,
    `A visual styling technique unrelated to ${concept.name}.`,
    `A deployment setting used only after studying ${neighborB.name}.`,
  ];
}

function makeQuizQuestions(moduleIndex: number, concepts: ConceptSpec[], coursePrefix: string) {
  const questionConcepts = concepts.length >= 10 ? concepts.slice(0, 10) : Array.from({ length: 10 }, (_, index) => concepts[index % concepts.length]);

  return questionConcepts.map((concept, index) => {
    const neighborA = concepts[(index + 1) % concepts.length] ?? concept;
    const neighborB = concepts[(index + 2) % concepts.length] ?? concept;

    return {
      id: `${coursePrefix}-m${pad(moduleIndex + 1)}-q${pad(index + 1)}`,
      type: "single_choice",
      question: `Which statement best describes ${concept.name}?`,
      options: makeQuestionOptions(concept, neighborA, neighborB),
      answers: [0],
      timed: "f" as const,
    };
  });
}

function withSourceIds<T extends object>(value: T, sourceIds?: string[]): T & { sourceIds?: string[] } {
  return sourceIds?.length ? { ...value, sourceIds } : value;
}

export function buildFullCourseModules({ coursePrefix, pacingLabel, moduleSpecs, defaultSourceIds }: BuildFullCourseModulesOptions): CourseModule[] {
  return moduleSpecs.map((moduleSpec, moduleIndex) => {
    const moduleNumber = moduleIndex + 1;
    const moduleId = `${coursePrefix}-m${pad(moduleNumber)}`;
    const moduleSourceIds = moduleSpec.sourceIds ?? defaultSourceIds;
    const lessonSections = moduleSpec.topics.map((topic, topicIndex) => {
      const sectionId = `${moduleId}-u${pad(topicIndex + 1)}`;
      const conceptNames = topic.concepts.map((concept) => concept.name).join(", ");
      const topicSourceIds = topic.sourceIds ?? moduleSourceIds;

      return withSourceIds({
        id: sectionId,
        title: topic.title,
        pageType: "learn" as const,
        sectionType: "lesson",
        content: [
          withSourceIds({
            type: "text",
            value: `${topic.description} This lesson supports the module objective: ${moduleSpec.objective} Students should connect the lesson to these working concepts: ${conceptNames}.`,
          }, topicSourceIds),
          withSourceIds({
            type: "text",
            heading: "College-style practice",
            value: moduleSpec.studio,
          }, topicSourceIds),
          withSourceIds({
            type: "conceptCards",
            title: "Concepts introduced",
            concepts: topic.concepts,
          }, topicSourceIds),
        ],
      }, topicSourceIds);
    });

    const summaryConcepts = moduleSpec.topics.flatMap((topic, topicIndex) =>
      topic.concepts.map((concept) => ({
        ...concept,
        sourceSectionId: `${moduleId}-u${pad(topicIndex + 1)}`,
      })),
    );

    return withSourceIds({
      id: moduleId,
      title: `${pacingLabel} ${moduleNumber}: ${moduleSpec.title}`,
      sections: [
        ...lessonSections,
        withSourceIds({
          id: `${moduleId}-apply`,
          title: `Quiz: ${moduleSpec.title}`,
          pageType: "apply" as const,
          sectionType: "assessment",
          content: [
            withSourceIds({
              type: "quiz",
              questions: makeQuizQuestions(moduleIndex, summaryConcepts, coursePrefix),
              passPercentage: 70,
              maxAttempts: "",
              timeLimitSeconds: "",
            }, moduleSourceIds),
          ],
        }, moduleSourceIds),
        withSourceIds({
          id: `${moduleId}-summary`,
          title: `${pacingLabel} ${moduleNumber} Concept Review`,
          pageType: "learn" as const,
          sectionType: "summary",
          content: [
            withSourceIds({
              type: "conceptCards",
              title: `${pacingLabel} concepts`,
              concepts: summaryConcepts,
            }, moduleSourceIds),
          ],
        }, moduleSourceIds),
      ],
    }, moduleSourceIds);
  });
}
