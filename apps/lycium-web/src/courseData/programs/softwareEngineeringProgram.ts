import type { LyciumProgram, LyciumRequirement } from "@lycium/contracts";

const course = (id: string, title?: string, estimatedHours?: number): LyciumRequirement => ({
  id: `req-${id.replace(/^local-/, "")}`,
  type: "complete_course",
  courseId: id,
  title,
  required: true,
  estimatedHours,
});

const anyOf = (id: string, title: string, requirements: LyciumRequirement[], count?: number): LyciumRequirement => ({
  id,
  type: count ? "requirement_set" : "requirement_set",
  operator: count ? "n_of" : "any",
  count,
  title,
  required: true,
  requirements,
});

const allOf = (id: string, title: string, requirements: LyciumRequirement[]): LyciumRequirement => ({
  id,
  type: "requirement_set",
  operator: "all",
  title,
  required: true,
  requirements,
});

export const softwareEngineeringProgram: LyciumProgram = {
  id: "program-software-engineering",
  title: "Software Engineering",
  description:
    "A full software engineering program organized like a modern university curriculum, with foundations, core CS, engineering practice, application platforms, operations, specialization, and capstone requirements.",
  programType: "degree_equivalent",
  field: "Software Engineering",
  level: "undergraduate",
  targetOutcome:
    "Prepare learners to design, build, test, secure, deploy, operate, and explain substantial software systems in professional team environments.",
  learningOutcomes: [
    { id: "se-outcome-build-systems", statement: "Build maintainable software systems across frontend, backend, data, and operations contexts." },
    { id: "se-outcome-engineer-quality", statement: "Apply requirements, design, testing, security, architecture, and release practices to improve software quality." },
    { id: "se-outcome-reason-about-tradeoffs", statement: "Evaluate technical tradeoffs using evidence, constraints, stakeholder needs, and system quality attributes." },
    { id: "se-outcome-work-professionally", statement: "Collaborate, communicate, document, review, and deliver software in a professional engineering workflow." },
    { id: "se-outcome-demonstrate-capstone", statement: "Produce and present a capstone system that demonstrates implementation, deployment, documentation, and reflection." },
  ],
  entryRequirements: [
    {
      id: "entry-high-school-algebra-and-computer-literacy",
      type: "demonstrate_competency",
      competencyId: "high-school-algebra-and-computer-literacy",
      title: "High school algebra and basic computer literacy",
      required: true,
    },
  ],
  requirementGroups: [
    {
      id: "cluster-programming-foundations",
      displayName: "Programming Foundations",
      groupKind: "foundation",
      purpose: "Establish developer fluency, version-control workflow, and one complete introductory programming sequence.",
      learningOutcomes: [
        { id: "se-foundations-outcome-program", statement: "Write, run, debug, test, and collaborate on small programs in one primary language." },
      ],
      requirements: [
        course("local-se-computing-systems", "Computing systems and developer tools", 25),
        course("local-se-git-collaboration", "Git and collaboration", 25),
        anyOf("req-programming-language-sequence", "Complete one programming language sequence", [
          allOf("req-python-sequence", "Python sequence", [
            course("local-se-python-programming-i", "Programming I: Python", 45),
            course("local-se-python-programming-ii", "Programming II: Python Software Design", 45),
          ]),
          allOf("req-typescript-sequence", "TypeScript sequence", [
            course("local-se-typescript-programming-i", "Programming I: TypeScript", 45),
            course("local-se-typescript-programming-ii", "Programming II: TypeScript Software Design", 45),
          ]),
          allOf("req-java-sequence", "Java sequence", [
            course("local-se-java-programming-i", "Programming I: Java", 45),
            course("local-se-java-programming-ii", "Programming II: Java Software Design", 45),
          ]),
        ]),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 140,
      masteryPolicy: { minimumMasteryPercent: 80, minimumAssessmentPercent: 70, remediationPolicy: "recommended" },
    },
    {
      id: "cluster-math-and-analysis",
      displayName: "Mathematics and Analytical Foundations",
      groupKind: "cluster",
      purpose: "Provide the mathematical reasoning used in algorithms, systems, data, AI, and engineering tradeoff analysis.",
      learningOutcomes: [
        { id: "se-math-outcome-model", statement: "Use discrete, quantitative, linear, and probabilistic reasoning in software engineering contexts." },
      ],
      requirements: [
        course("local-se-discrete-math", "Discrete mathematics", 45),
        course("local-se-calculus-computing", "Calculus for computing", 45),
        course("local-se-linear-algebra", "Linear algebra", 45),
        course("local-se-probability-statistics", "Probability and statistics", 45),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 180,
      masteryPolicy: { minimumMasteryPercent: 75, minimumAssessmentPercent: 70, remediationPolicy: "recommended" },
    },
    {
      id: "cluster-computer-science-core",
      displayName: "Computer Science Core",
      groupKind: "cluster",
      purpose: "Build the core abstractions behind efficient programs, machines, operating systems, networks, and data systems.",
      learningOutcomes: [
        { id: "se-cs-outcome-explain-runtime", statement: "Explain how data structures, algorithms, hardware, operating systems, and networks shape software behavior." },
      ],
      requirements: [
        course("local-se-data-structures", "Data structures", 50),
        course("local-se-algorithms", "Algorithms", 50),
        course("local-se-computer-organization", "Computer organization", 45),
        course("local-se-operating-systems", "Operating systems", 50),
        course("local-se-computer-networks", "Computer networks", 45),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 240,
      masteryPolicy: { minimumMasteryPercent: 80, minimumAssessmentPercent: 75, remediationPolicy: "recommended" },
      prerequisites: ["cluster-programming-foundations", "cluster-math-and-analysis"],
    },
    {
      id: "cluster-software-engineering-core",
      displayName: "Software Engineering Core",
      groupKind: "cluster",
      purpose: "Teach the practices that turn programming ability into durable professional software engineering capability.",
      learningOutcomes: [
        { id: "se-core-outcome-engineer", statement: "Transform requirements into tested, secure, maintainable, documented, and architecturally coherent software." },
      ],
      requirements: [
        course("local-se-requirements-engineering", "Requirements engineering", 35),
        course("local-se-design-patterns", "Software design patterns", 40),
        course("local-se-software-construction", "Software construction", 45),
        course("local-se-testing-quality", "Testing, verification, and quality", 45),
        course("local-se-software-architecture", "Software architecture", 55),
        course("local-se-secure-software", "Secure software engineering", 45),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 265,
      masteryPolicy: { minimumMasteryPercent: 82, minimumAssessmentPercent: 75, remediationPolicy: "recommended" },
      prerequisites: ["cluster-computer-science-core"],
    },
    {
      id: "cluster-application-platforms",
      displayName: "Application Platforms",
      groupKind: "track",
      purpose: "Require web/API foundations while letting learners choose equivalent frontend and backend implementation stacks.",
      learningOutcomes: [
        { id: "se-platform-outcome-build-app", statement: "Build service-backed applications using a selected frontend framework and backend runtime." },
      ],
      requirements: [
        allOf("req-application-platform-bundle", "Web/API bundle with frontend and backend choices", [
          course("local-se-web-platform", "Web platform foundations", 45),
          anyOf("req-one-frontend-framework", "Choose one frontend framework", [
            course("local-se-frontend-react", "React frontend", 45),
            course("local-se-frontend-angular", "Angular frontend", 45),
            course("local-se-frontend-vue", "Vue frontend", 45),
          ]),
          course("local-se-frontend-testing", "Frontend testing", 30),
          course("local-se-api-design", "HTTP APIs and service integration", 40),
          anyOf("req-one-backend-runtime", "Choose one backend runtime", [
            course("local-se-backend-node", "Node.js backend", 45),
            course("local-se-backend-python", "Python backend", 45),
            course("local-se-backend-java", "Java backend", 45),
          ]),
        ]),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 205,
      masteryPolicy: { minimumMasteryPercent: 80, minimumAssessmentPercent: 75, remediationPolicy: "recommended" },
      prerequisites: ["cluster-software-engineering-core"],
    },
    {
      id: "cluster-data-and-persistence",
      displayName: "Data and Persistence",
      groupKind: "cluster",
      purpose: "Cover persistent data modeling, relational systems, query design, privacy, and governance responsibilities.",
      learningOutcomes: [
        { id: "se-data-outcome-persist", statement: "Design, query, evolve, and responsibly govern application data stores." },
      ],
      requirements: [
        course("local-se-database-systems", "Database systems", 45),
        course("local-se-sql-data-modeling", "SQL and relational modeling", 35),
        course("local-se-data-privacy-governance", "Data privacy and governance", 30),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 110,
      masteryPolicy: { minimumMasteryPercent: 80, minimumAssessmentPercent: 75, remediationPolicy: "recommended" },
      prerequisites: ["cluster-computer-science-core"],
    },
    {
      id: "cluster-cloud-and-operations",
      displayName: "Cloud and Operations",
      groupKind: "cluster",
      purpose: "Develop practical delivery, deployment, cloud, observability, and reliability skills.",
      learningOutcomes: [
        { id: "se-ops-outcome-operate", statement: "Package, deploy, monitor, and improve production-style software systems." },
      ],
      requirements: [
        course("local-se-linux-networking", "Linux and networking", 35),
        course("local-se-containers-orchestration", "Containers and orchestration", 35),
        course("local-se-ci-cd-release", "CI/CD and release engineering", 35),
        anyOf("req-one-cloud-provider", "Choose one cloud provider foundation", [
          course("local-se-cloud-aws", "AWS foundations", 35),
          course("local-se-cloud-azure", "Azure foundations", 35),
          course("local-se-cloud-gcp", "Google Cloud foundations", 35),
        ]),
        course("local-se-observability-reliability", "Observability and reliability", 40),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 180,
      masteryPolicy: { minimumMasteryPercent: 80, minimumAssessmentPercent: 75, remediationPolicy: "recommended" },
      prerequisites: ["cluster-application-platforms"],
    },
    {
      id: "cluster-professional-practice",
      displayName: "Professional Practice",
      groupKind: "seminar",
      purpose: "Teach communication, product judgment, team practice, ethics, law, accessibility, and professional responsibility.",
      learningOutcomes: [
        { id: "se-professional-outcome-collaborate", statement: "Communicate, collaborate, and make responsible decisions in software teams." },
      ],
      requirements: [
        course("local-se-technical-communication", "Technical communication", 30),
        course("local-se-product-ux", "Product and UX collaboration", 35),
        course("local-se-agile-studio", "Agile project studio", 35),
        course("local-se-ethics-law-computing", "Ethics, law, and responsible computing", 35),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 135,
      masteryPolicy: { minimumMasteryPercent: 80, minimumAssessmentPercent: 70, remediationPolicy: "recommended" },
    },
    {
      id: "cluster-specialization-concentration",
      displayName: "Specialization Concentration",
      groupKind: "concentration",
      purpose: "Let learners complete one coherent advanced concentration instead of unrelated electives.",
      learningOutcomes: [
        { id: "se-specialization-outcome-depth", statement: "Demonstrate advanced depth in one selected software engineering specialization." },
      ],
      requirements: [
        anyOf("req-one-specialization-track", "Choose one complete specialization track", [
          allOf("req-ai-apps-track", "AI application engineering track", [
            course("local-se-ai-app-engineering", "AI application engineering", 45),
            course("local-se-ml-systems", "ML systems engineering", 50),
            course("local-se-llm-product-patterns", "LLM product patterns", 40),
          ]),
          allOf("req-security-track", "Security engineering track", [
            course("local-se-application-security", "Application security", 45),
            course("local-se-threat-modeling", "Threat modeling", 35),
            course("local-se-security-operations", "Security operations", 35),
          ]),
          allOf("req-distributed-systems-track", "Distributed systems track", [
            course("local-se-distributed-systems", "Distributed systems", 50),
            course("local-se-event-driven-architecture", "Event-driven architecture", 40),
            course("local-se-scalable-data-systems", "Scalable data systems", 40),
          ]),
          allOf("req-mobile-track", "Mobile engineering track", [
            course("local-se-mobile-app-engineering", "Mobile app engineering", 45),
            course("local-se-cross-platform-mobile", "Cross-platform mobile", 40),
            course("local-se-mobile-quality-release", "Mobile quality and release", 35),
          ]),
          allOf("req-data-engineering-track", "Data engineering track", [
            course("local-se-data-engineering", "Data engineering", 45),
            course("local-se-analytics-engineering", "Analytics engineering", 40),
            course("local-se-stream-processing", "Stream processing", 40),
          ]),
        ]),
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 135,
      masteryPolicy: { minimumMasteryPercent: 82, minimumAssessmentPercent: 75, remediationPolicy: "recommended" },
      prerequisites: ["cluster-cloud-and-operations", "cluster-data-and-persistence"],
    },
    {
      id: "cluster-capstone-and-portfolio",
      displayName: "Capstone and Portfolio",
      groupKind: "capstone",
      purpose: "Require a substantial project, production-style delivery evidence, portfolio polish, and final readiness review.",
      learningOutcomes: [
        { id: "se-capstone-outcome-demonstrate", statement: "Design, implement, deploy, document, and present a substantial software engineering artifact." },
      ],
      requirements: [
        course("local-se-capstone-i", "Capstone Studio I", 60),
        course("local-se-capstone-ii", "Capstone Studio II", 60),
        course("local-se-portfolio-career", "Portfolio and career readiness", 30),
        { id: "req-submit-se-capstone-project", type: "submit_project", projectId: "se-capstone-portfolio-project", title: "Submit software engineering capstone project", required: true, estimatedHours: 20 },
        { id: "req-pass-se-readiness-review", type: "pass_assessment", assessmentId: "se-professional-readiness-review", title: "Pass professional readiness review", minScore: 80, required: true, estimatedHours: 5 },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 175,
      masteryPolicy: { minimumMasteryPercent: 85, minimumAssessmentPercent: 80, requiresCapstone: true, remediationPolicy: "required" },
      prerequisites: ["cluster-specialization-concentration", "cluster-professional-practice"],
    },
  ],
  estimatedHours: 1765,
  masteryPolicy: { minimumMasteryPercent: 82, minimumAssessmentPercent: 75, requiresCapstone: true, remediationPolicy: "recommended" },
  credentialPolicy: {
    credentialType: "transcript_record",
    title: "Software Engineering Program Record",
    issuer: "Lycium",
    requiresHumanReview: true,
  },
  dependencyGraph: {
    edges: [
      { fromNodeId: "cluster-programming-foundations", toNodeId: "cluster-computer-science-core", type: "required" },
      { fromNodeId: "cluster-math-and-analysis", toNodeId: "cluster-computer-science-core", type: "required" },
      { fromNodeId: "cluster-computer-science-core", toNodeId: "cluster-software-engineering-core", type: "required" },
      { fromNodeId: "cluster-software-engineering-core", toNodeId: "cluster-application-platforms", type: "required" },
      { fromNodeId: "cluster-application-platforms", toNodeId: "cluster-cloud-and-operations", type: "required" },
      { fromNodeId: "cluster-data-and-persistence", toNodeId: "cluster-specialization-concentration", type: "recommended" },
      { fromNodeId: "cluster-cloud-and-operations", toNodeId: "cluster-specialization-concentration", type: "recommended" },
      { fromNodeId: "cluster-specialization-concentration", toNodeId: "cluster-capstone-and-portfolio", type: "required" },
      { fromNodeId: "cluster-professional-practice", toNodeId: "cluster-capstone-and-portfolio", type: "required" },
    ],
  },
  version: "0.1.0",
  reviewStatus: "draft",
};

export default softwareEngineeringProgram;
