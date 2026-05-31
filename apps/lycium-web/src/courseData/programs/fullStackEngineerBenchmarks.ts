import type { LyciumCurriculumBenchmark } from "@lycium/contracts";

export const fullStackEngineerBenchmarks: LyciumCurriculumBenchmark[] = [
  {
    id: "benchmark-full-stack-engineer-curriculum-core",
    sourceType: "expert_reference",
    title: "Full-stack engineering curriculum core from ACM/IEEE and SWEBOK references",
    institution: "ACM, IEEE Computer Society, and IEEE Computer Society SWEBOK",
    programName: "Full-Stack Engineer pathway benchmark",
    department: "Computing and Software Engineering",
    sourceRefs: ["acm-computing-curricula-2020", "software-engineering-2014", "swebok-v4"],
    extractedRequirements: [
      {
        id: "benchmark-req-programming-web-foundations",
        title: "Programming, web, and developer foundations",
        importance: "required",
        topics: ["programming fundamentals", "developer tools", "web platform", "version control"],
      },
      {
        id: "benchmark-req-frontend-engineering",
        title: "Frontend engineering and accessible user interfaces",
        importance: "required",
        topics: ["HTML", "CSS", "JavaScript", "component architecture", "accessibility", "frontend testing"],
      },
      {
        id: "benchmark-req-backend-data",
        title: "Backend services, APIs, and data persistence",
        importance: "required",
        topics: ["HTTP APIs", "databases", "authentication", "security", "server-side applications"],
      },
      {
        id: "benchmark-req-delivery-operations",
        title: "Delivery, operations, and reliability practice",
        importance: "required",
        topics: ["testing", "CI/CD", "containers", "cloud deployment", "observability", "reliability"],
      },
      {
        id: "benchmark-req-capstone-portfolio",
        title: "Capstone and portfolio evidence",
        importance: "required",
        topics: ["project work", "design documentation", "professional communication", "portfolio review"],
      },
    ],
    topics: [
      "software engineering foundations",
      "full-stack web development",
      "backend and data systems",
      "delivery and operations",
      "capstone portfolio evidence",
    ],
    learningOutcomes: [
      "Build and explain production-style full-stack applications.",
      "Use source-backed software engineering practices to make design, testing, delivery, and operations decisions.",
      "Produce portfolio evidence that can be reviewed by humans.",
    ],
    confidence: 0.78,
    notes:
      "Primitive benchmark record used to demonstrate how public curriculum references can seed requirement-level evidence before a dedicated benchmark ingestion UI exists.",
  },
];

export default fullStackEngineerBenchmarks;
