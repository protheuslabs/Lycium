import type { FullCourseModuleSpec, LessonTopicSpec } from "../fullCourseScaffold";
import { buildFullCourseModules } from "../fullCourseScaffold";

type SoftwareEngineeringBuildInput = {
  courseKey: string;
  title: string;
  shortDescription: string;
  tags: string[];
  difficultyLevel: string;
  estimatedHours: number;
  sourceIds: string[];
};

const DEFAULT_SOURCE_IDS = ["swebok-v4", "software-engineering-2014", "acm-computing-curricula-2020"];

const TAG_SOURCE_IDS: Array<{ terms: string[]; sourceIds: string[] }> = [
  { terms: ["python"], sourceIds: ["python-tutorial", "cs50-python"] },
  { terms: ["web", "frontend", "react", "angular", "vue", "html", "css"], sourceIds: ["mdn-learn-web-dev", "web-dev-learn"] },
  { terms: ["architecture", "design", "distributed", "events"], sourceIds: ["rw-software-systems-architecture-2e", "iso-iec-ieee-42010-2022"] },
  { terms: ["security", "threat"], sourceIds: ["owasp-wstg", "nist-ai-rmf"] },
  { terms: ["ai", "machine learning", "llm"], sourceIds: ["aima", "mlsys-book", "google-rules-of-ml"] },
  { terms: ["testing", "quality"], sourceIds: ["swebok-v4"] },
];

const MODULE_ARC = [
  { title: "Orientation and Professional Context", focus: "purpose, expectations, and professional roles" },
  { title: "Core Vocabulary and Mental Models", focus: "terms, abstractions, and system boundaries" },
  { title: "Representations, Data, and Artifacts", focus: "models, data shapes, diagrams, and engineering artifacts" },
  { title: "Tools, Environments, and Workflow", focus: "toolchains, local setup, automation, and repeatable workflow" },
  { title: "Design Decisions and Tradeoffs", focus: "alternatives, constraints, quality attributes, and decision records" },
  { title: "Implementation Techniques", focus: "construction practices, decomposition, interfaces, and maintainable code" },
  { title: "Integration and Collaboration", focus: "interfaces, reviews, teamwork, dependency management, and coordination" },
  { title: "Testing, Feedback, and Quality", focus: "verification strategy, evidence, quality signals, and defect prevention" },
  { title: "Security, Reliability, and Operations", focus: "risk, failure modes, safeguards, monitoring, and lifecycle ownership" },
  { title: "Portfolio Studio and Course Synthesis", focus: "capstone-style application, documentation, presentation, and reflection" },
];

const TOPIC_ARC = [
  "Conceptual foundations",
  "Working model",
  "Applied procedure",
  "Reviewable artifact",
];

function cleanCoursePrefix(courseKey: string) {
  return courseKey.replace(/^local-/, "");
}

function domainLabel(title: string) {
  return title.replace(/^Programming [IVX]+:\s*/, "").replace(/^Cloud Foundations:\s*/, "").trim();
}

function primaryTag(tags: string[]) {
  return tags.find((tag) => tag !== "software engineering") ?? tags[0] ?? "software engineering";
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTopic(input: SoftwareEngineeringBuildInput, moduleIndex: number, topicIndex: number): LessonTopicSpec {
  const domain = domainLabel(input.title);
  const tag = primaryTag(input.tags);
  const module = MODULE_ARC[moduleIndex];
  const topic = TOPIC_ARC[topicIndex];
  const moduleNumber = moduleIndex + 1;
  const topicNumber = topicIndex + 1;
  const focus = `${topic.toLowerCase()} for ${domain}`;

  return {
    title: `${topic}: ${domain}`,
    description:
      `${topic} studies ${focus}. Learners define the important terms, connect them to ${module.focus}, ` +
      `and practice explaining how the idea changes real engineering choices in ${tag}.`,
    concepts: [
      {
        name: `${domain} ${topic.toLowerCase()}`,
        description: `The specific ${topic.toLowerCase()} knowledge needed to reason about ${domain} work.`,
      },
      {
        name: `${titleCase(tag)} constraint`,
        description: `A limiting condition that shapes choices when applying ${domain} in a software system.`,
      },
      {
        name: `${domain} artifact ${moduleNumber}.${topicNumber}`,
        description: `A reviewable work product that records decisions, evidence, or implementation details for ${domain}.`,
      },
    ],
    sourceIds: input.sourceIds,
  };
}

export function selectSoftwareEngineeringSourceIds(input: { title: string; tags: string[] }) {
  const sourceIds = new Set(DEFAULT_SOURCE_IDS);
  const haystack = `${input.title} ${input.tags.join(" ")}`.toLowerCase();

  for (const mapping of TAG_SOURCE_IDS) {
    if (mapping.terms.some((term) => haystack.includes(term))) {
      mapping.sourceIds.forEach((sourceId) => sourceIds.add(sourceId));
    }
  }

  return Array.from(sourceIds);
}

export function buildSoftwareEngineeringCourseModules(input: SoftwareEngineeringBuildInput) {
  const domain = domainLabel(input.title);
  const moduleSpecs: FullCourseModuleSpec[] = MODULE_ARC.map((module, moduleIndex) => ({
    title: module.title,
    objective:
      `Use ${domain} to explain ${module.focus}, produce reviewable engineering artifacts, ` +
      `and make decisions appropriate for a ${input.difficultyLevel.toLowerCase()} software engineering course.`,
    studio:
      `Create a short ${domain} studio artifact for this module: define the context, list assumptions, ` +
      "compare at least two alternatives, identify risks, and record the evidence a reviewer would need.",
    topics: TOPIC_ARC.map((_, topicIndex) => buildTopic(input, moduleIndex, topicIndex)),
    sourceIds: input.sourceIds,
  }));

  return buildFullCourseModules({
    coursePrefix: cleanCoursePrefix(input.courseKey),
    pacingLabel: "Module",
    moduleSpecs,
    defaultSourceIds: input.sourceIds,
  });
}
