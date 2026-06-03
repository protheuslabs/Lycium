import type { LyciumCurriculumBenchmark } from "@lycium/contracts";

export const softwareEngineeringProgramBenchmarks: LyciumCurriculumBenchmark[] = [
  {
    id: "benchmark-software-engineering-degree-core",
    sourceType: "expert_reference",
    title: "Software engineering degree-equivalent curriculum core",
    institution: "ACM, IEEE Computer Society, and IEEE Computer Society SWEBOK",
    programName: "Software Engineering",
    department: "Software Engineering",
    sourceRefs: ["software-engineering-2014", "swebok-v4", "acm-computing-curricula-2020"],
    extractedRequirements: [
      {
        id: "benchmark-req-programming-foundations",
        title: "Programming foundations and developer workflow",
        importance: "required",
        topics: ["programming fundamentals", "developer tools", "version control", "debugging"],
      },
      {
        id: "benchmark-req-math-cs-core",
        title: "Mathematics and computer science core",
        importance: "required",
        topics: ["discrete mathematics", "algorithms", "data structures", "systems", "networks", "databases"],
      },
      {
        id: "benchmark-req-se-practice",
        title: "Software engineering practice and quality",
        importance: "required",
        topics: ["requirements", "design", "construction", "testing", "architecture", "security", "quality assurance"],
      },
      {
        id: "benchmark-req-platforms-operations",
        title: "Application platforms, delivery, and operations",
        importance: "required",
        topics: ["web applications", "APIs", "cloud", "CI/CD", "observability", "reliability"],
      },
      {
        id: "benchmark-req-professional-practice",
        title: "Professional practice and responsible computing",
        importance: "required",
        topics: ["technical communication", "teamwork", "ethics", "law", "accessibility", "product collaboration"],
      },
      {
        id: "benchmark-req-specialization",
        title: "Advanced specialization or concentration",
        importance: "recommended",
        topics: ["AI applications", "security", "distributed systems", "mobile engineering", "data engineering"],
      },
      {
        id: "benchmark-req-capstone-evidence",
        title: "Capstone and portfolio evidence",
        importance: "required",
        topics: ["capstone", "portfolio", "deployment evidence", "architecture evidence", "professional readiness review"],
      },
    ],
    topics: [
      "software engineering degree-equivalent path",
      "curriculum benchmark requirements",
      "portfolio and capstone evidence",
      "professional software practice",
    ],
    learningOutcomes: [
      "Build and explain substantial software systems using professional engineering practices.",
      "Use requirements, design, architecture, quality, security, delivery, and operations evidence to justify engineering decisions.",
      "Produce a reviewable capstone and portfolio record that demonstrates vertical software engineering capability.",
    ],
    prerequisites: ["High school algebra", "Basic computer literacy"],
    assessmentTypes: ["course quizzes", "readiness checkpoints", "project evidence packages", "capstone review"],
    confidence: 0.84,
    notes:
      "Primitive benchmark record that anchors the flagship Software Engineering program in public computing curriculum guidance and SWEBOK-style professional practice categories.",
  },
];

export default softwareEngineeringProgramBenchmarks;
