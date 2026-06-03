import type { LyciumProgram, LyciumRequirement, LyciumRequirementImportance, LyciumRequirementOrigin } from "@lycium/contracts";

type RequirementMeta = {
  importance?: LyciumRequirementImportance;
  origin?: LyciumRequirementOrigin;
  learningOutcomeIds?: string[];
};

const SE_SOURCE_REFS = ["software-engineering-2014", "swebok-v4", "acm-computing-curricula-2020"];
const SE_BENCHMARK_IDS = ["benchmark-software-engineering-degree-core"];

const academicOrigin = (notes: string, frequency = 0.82): LyciumRequirementOrigin => ({
  originType: "common_academic_requirement",
  evidenceRefs: SE_SOURCE_REFS,
  benchmarkIds: SE_BENCHMARK_IDS,
  frequency,
  score: frequency,
  sourceConfidence: 0.86,
  sourceTypeWeight: 0.92,
  reviewStatus: "reviewed",
  notes,
});

const requiredAcademic = (notes: string, frequency?: number): RequirementMeta => ({
  importance: "required",
  origin: academicOrigin(notes, frequency),
});

const course = (id: string, title?: string, estimatedHours?: number, meta: RequirementMeta = {}): LyciumRequirement => ({
  id: `req-${id.replace(/^local-/, "")}`,
  type: "complete_course",
  courseId: id,
  title,
  required: true,
  estimatedHours,
  ...meta,
});

const anyOf = (
  id: string,
  title: string,
  requirements: LyciumRequirement[],
  countOrMeta?: number | RequirementMeta,
  maybeMeta: RequirementMeta = {},
): LyciumRequirement => {
  const count = typeof countOrMeta === "number" ? countOrMeta : undefined;
  const meta = typeof countOrMeta === "object" ? countOrMeta : maybeMeta;
  return {
  id,
  type: "requirement_set",
  operator: count ? "n_of" : "any",
  count,
  title,
  required: true,
  requirements,
  ...meta,
  };
};

const allOf = (id: string, title: string, requirements: LyciumRequirement[], meta: RequirementMeta = {}): LyciumRequirement => ({
  id,
  type: "requirement_set",
  operator: "all",
  title,
  required: true,
  requirements,
  ...meta,
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
    { id: "se-outcome-build-systems", statement: "Build maintainable software systems across frontend, backend, data, and operations contexts.", sourceIds: SE_SOURCE_REFS },
    { id: "se-outcome-engineer-quality", statement: "Apply requirements, design, testing, security, architecture, and release practices to improve software quality.", sourceIds: SE_SOURCE_REFS },
    { id: "se-outcome-reason-about-tradeoffs", statement: "Evaluate technical tradeoffs using evidence, constraints, stakeholder needs, and system quality attributes.", sourceIds: SE_SOURCE_REFS },
    { id: "se-outcome-work-professionally", statement: "Collaborate, communicate, document, review, and deliver software in a professional engineering workflow.", sourceIds: SE_SOURCE_REFS },
    { id: "se-outcome-demonstrate-capstone", statement: "Produce and present a capstone system that demonstrates implementation, deployment, documentation, and reflection.", sourceIds: SE_SOURCE_REFS },
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
        ], requiredAcademic("Software engineering programs require at least one complete programming sequence before upper-division computing and engineering practice.", 0.94)),
        { id: "req-pass-developer-workflow-readiness", type: "pass_assessment", assessmentId: "se-developer-workflow-readiness", title: "Pass developer workflow readiness check", minScore: 80, required: true, estimatedHours: 5, ...requiredAcademic("Professional programs commonly gate later project work on basic tooling, version control, debugging, and programming fluency.", 0.88) },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 145,
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
        { id: "req-pass-cs-core-checkpoint", type: "pass_assessment", assessmentId: "se-cs-core-checkpoint", title: "Pass systems and algorithms checkpoint", minScore: 78, required: true, estimatedHours: 8, ...requiredAcademic("A degree-equivalent software path needs evidence that learners can reason about algorithms, systems, networks, and runtime behavior before architecture and operations.", 0.86) },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 248,
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
        { id: "req-submit-architecture-quality-package", type: "submit_project", projectId: "se-architecture-quality-evidence-package", title: "Submit architecture and quality evidence package", required: true, estimatedHours: 15, ...requiredAcademic("Software engineering curricula emphasize artifacts such as requirements, design rationale, architecture views, tests, reviews, and quality evidence.", 0.9) },
        { id: "req-pass-software-engineering-design-review", type: "pass_assessment", assessmentId: "se-software-engineering-design-review", title: "Pass software engineering design review", minScore: 80, required: true, estimatedHours: 5, ...requiredAcademic("Design and architecture review verifies that learners can justify tradeoffs rather than only complete implementation tasks.", 0.84) },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 280,
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
        ], requiredAcademic("Equivalent implementation stacks can satisfy the same platform requirement when they demonstrate the same API, frontend, integration, and testing outcomes.", 0.76)),
        { id: "req-submit-service-backed-application-slice", type: "submit_project", projectId: "se-service-backed-application-slice", title: "Submit service-backed application slice", required: true, estimatedHours: 15, ...requiredAcademic("Applied software programs should require a small integrated application before the final capstone.", 0.82) },
        { id: "req-pass-application-integration-review", type: "pass_assessment", assessmentId: "se-application-integration-review", title: "Pass application integration review", minScore: 80, required: true, estimatedHours: 5, ...requiredAcademic("Integration review checks whether frontend, API, backend, and tests work as a coherent system.", 0.8) },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 225,
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
        { id: "req-pass-data-model-review", type: "pass_assessment", assessmentId: "se-data-model-review", title: "Pass data model and governance review", minScore: 78, required: true, estimatedHours: 5, ...requiredAcademic("Software engineering programs increasingly require data design, privacy, and governance judgment alongside implementation ability.", 0.72) },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 115,
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
        { id: "req-submit-deployed-service-evidence", type: "submit_project", projectId: "se-deployed-service-evidence", title: "Submit deployed service evidence", required: true, estimatedHours: 15, ...requiredAcademic("A serious software engineering path should require deployment, operations evidence, and incident-style reasoning before capstone completion.", 0.8) },
        { id: "req-pass-operations-readiness-check", type: "pass_assessment", assessmentId: "se-operations-readiness-check", title: "Pass operations readiness check", minScore: 80, required: true, estimatedHours: 5, ...requiredAcademic("Operations readiness verifies that learners understand packaging, release safety, observability, and reliability tradeoffs.", 0.78) },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 200,
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
        { id: "req-submit-professional-practice-dossier", type: "submit_project", projectId: "se-professional-practice-dossier", title: "Submit professional practice dossier", required: true, estimatedHours: 10, ...requiredAcademic("Software engineering programs require communication, teamwork, ethics, accessibility, and professional responsibility evidence.", 0.84) },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 145,
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
        ], requiredAcademic("Upper-division software programs commonly offer coherent specialization depth rather than unrelated elective sampling.", 0.72)),
        { id: "req-submit-specialization-evidence", type: "submit_project", projectId: "se-specialization-evidence-artifact", title: "Submit specialization evidence artifact", required: true, estimatedHours: 15, ...requiredAcademic("Specialization should create a reviewable artifact that can shape the capstone and portfolio story.", 0.7) },
        { id: "req-pass-specialization-readiness-review", type: "pass_assessment", assessmentId: "se-specialization-readiness-review", title: "Pass specialization readiness review", minScore: 80, required: true, estimatedHours: 5, ...requiredAcademic("A readiness review keeps advanced electives tied to a coherent professional direction.", 0.68) },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 155,
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
        { id: "req-pass-capstone-proposal-review", type: "pass_assessment", assessmentId: "se-capstone-proposal-review", title: "Pass capstone proposal review", minScore: 80, required: true, estimatedHours: 5, ...requiredAcademic("Capstone projects should begin with scope, stakeholder, risk, architecture, and evidence planning before implementation.", 0.82) },
        course("local-se-capstone-ii", "Capstone Studio II", 60),
        course("local-se-portfolio-career", "Portfolio and career readiness", 30),
        { id: "req-submit-se-capstone-project", type: "submit_project", projectId: "se-capstone-portfolio-project", title: "Submit software engineering capstone project", required: true, estimatedHours: 20 },
        { id: "req-pass-se-readiness-review", type: "pass_assessment", assessmentId: "se-professional-readiness-review", title: "Pass professional readiness review", minScore: 80, required: true, estimatedHours: 5 },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 180,
      masteryPolicy: { minimumMasteryPercent: 85, minimumAssessmentPercent: 80, requiresCapstone: true, remediationPolicy: "required" },
      prerequisites: ["cluster-specialization-concentration", "cluster-professional-practice"],
    },
  ],
  estimatedHours: 1888,
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
      { fromNodeId: "req-programming-language-sequence", toNodeId: "req-se-data-structures", type: "required", rationale: "Data structures assume programming fluency in at least one language." },
      { fromNodeId: "req-se-data-structures", toNodeId: "req-se-algorithms", type: "required", rationale: "Algorithm analysis depends on data-structure fluency." },
      { fromNodeId: "req-se-computer-networks", toNodeId: "req-se-api-design", type: "required", rationale: "API design depends on HTTP, networking, and distributed communication basics." },
      { fromNodeId: "req-se-software-architecture", toNodeId: "req-submit-architecture-quality-package", type: "required", rationale: "Architecture evidence should be grounded in architecture views and quality attributes." },
      { fromNodeId: "req-submit-service-backed-application-slice", toNodeId: "req-submit-deployed-service-evidence", type: "required", rationale: "Deployment evidence should begin from an integrated application slice." },
      { fromNodeId: "req-submit-deployed-service-evidence", toNodeId: "req-se-capstone-i", type: "required", rationale: "Capstone planning should build on prior deployment and operations evidence." },
      { fromNodeId: "req-submit-specialization-evidence", toNodeId: "req-pass-capstone-proposal-review", type: "recommended", rationale: "Specialization evidence should inform the capstone proposal when possible." },
    ],
  },
  version: "0.2.0",
  reviewStatus: "reviewed",
};

export default softwareEngineeringProgram;
