import type { CourseModule } from "../courseTypes";

export type ConceptSpec = {
  name: string;
  description: string;
};

export type LessonTopicSpec = {
  title: string;
  description: string;
  example?: string;
  practice?: string;
  concepts: ConceptSpec[];
  sourceIds?: string[];
  videoSourceIds?: string[];
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

function withSourceIds<T extends object>(value: T, sourceIds?: string[]): T & { sourceIds?: string[] } {
  return sourceIds?.length ? { ...value, sourceIds } : value;
}

function makeQuestionOptions(concept: ConceptSpec, concepts: ConceptSpec[], index: number) {
  const neighborA = concepts[(index + 1) % concepts.length] ?? concept;
  const neighborB = concepts[(index + 2) % concepts.length] ?? concept;
  const neighborC = concepts[(index + 3) % concepts.length] ?? concept;
  const options = [
    concept.description,
    neighborA.description,
    neighborB.description,
    neighborC.description,
  ];

  return Array.from(new Set(options)).concat([
    `A term that belongs to a different part of the course, not ${concept.name}.`,
    `A general project label that does not define ${concept.name}.`,
  ]).slice(0, 4);
}

function makeQuizQuestions(moduleIndex: number, concepts: ConceptSpec[], coursePrefix: string) {
  if (concepts.length === 0) {
    return [];
  }

  const questionConcepts =
    concepts.length >= 10 ? concepts.slice(0, 10) : Array.from({ length: 10 }, (_, index) => concepts[index % concepts.length]);

  return questionConcepts.map((concept, index) => ({
    id: `${coursePrefix}-m${pad(moduleIndex + 1)}-q${pad(index + 1)}`,
    type: "single_choice",
    question: `Which statement best defines ${concept.name}?`,
    options: makeQuestionOptions(concept, concepts, index),
    answers: [0],
    timed: "f" as const,
  }));
}

function makeWorkedExample(moduleSpec: FullCourseModuleSpec, topic: LessonTopicSpec) {
  const primaryConcept = topic.concepts[0]?.name ?? topic.title;
  const supportingConcept = topic.concepts[1]?.name ?? moduleSpec.title;

  return `Worked example: apply ${primaryConcept} to the module studio task. First identify the concrete situation, then name the relevant inputs, constraints, and expected result. Use ${supportingConcept} to explain what would change if the task, user, or environment changed.`;
}

function makePractice(moduleSpec: FullCourseModuleSpec, topic: LessonTopicSpec) {
  const conceptNames = topic.concepts.map((concept) => concept.name).join(", ") || topic.title;

  return `Practice: write a short response that defines ${conceptNames}, connects the ideas to "${moduleSpec.studio}", and names one decision a learner or practitioner would make differently after understanding this topic.`;
}

export function buildFullCourseModules({ coursePrefix, pacingLabel, moduleSpecs, defaultSourceIds }: BuildFullCourseModulesOptions): CourseModule[] {
  return moduleSpecs.map((moduleSpec, moduleIndex) => {
    const moduleNumber = moduleIndex + 1;
    const moduleId = `${coursePrefix}-m${pad(moduleNumber)}`;
    const moduleSourceIds = moduleSpec.sourceIds ?? defaultSourceIds;
    const lessonSections = moduleSpec.topics.map((topic, topicIndex) => {
      const sectionId = `${moduleId}-u${pad(topicIndex + 1)}`;
      const topicSourceIds = topic.sourceIds ?? moduleSourceIds;

      return withSourceIds({
        id: sectionId,
        title: topic.title,
        pageType: "learn" as const,
        sectionType: "lesson",
        content: [
          withSourceIds({
            type: "text",
            heading: "Explanation",
            value: topic.description,
          }, topicSourceIds),
          ...(topic.videoSourceIds?.length
            ? [
                withSourceIds({
                  type: "video",
                  title: `Watch: ${topic.title}`,
                }, topic.videoSourceIds),
              ]
            : []),
          withSourceIds({
            type: "text",
            heading: "Worked example",
            value: topic.example ?? makeWorkedExample(moduleSpec, topic),
          }, topicSourceIds),
          withSourceIds({
            type: "text",
            heading: "Practice",
            value: topic.practice ?? makePractice(moduleSpec, topic),
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
