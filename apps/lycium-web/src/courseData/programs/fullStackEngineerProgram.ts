import type { LyciumProgram } from "@lycium/contracts";

export const fullStackEngineerProgram: LyciumProgram = {
  id: "program-full-stack-engineer",
  title: "Full-Stack Engineer",
  description:
    "A professional pathway that combines programming foundations, web development, architecture, systems thinking, and a portfolio capstone.",
  programType: "career_path",
  field: "Software Engineering",
  level: "professional",
  targetOutcome:
    "Prepare learners to design, build, explain, and improve production-style full-stack applications with source-backed evidence of mastery.",
  learningOutcomes: [
    {
      id: "outcome-build-web-apps",
      statement: "Build interactive web applications using browser, programming, and deployment foundations.",
    },
    {
      id: "outcome-reason-about-architecture",
      statement: "Explain architectural tradeoffs across frontend, backend, data, operations, and reliability concerns.",
    },
    {
      id: "outcome-produce-portfolio-evidence",
      statement: "Produce portfolio artifacts that demonstrate implementation, testing, documentation, and review readiness.",
    },
  ],
  entryRequirements: [
    {
      id: "entry-basic-computer-literacy",
      type: "demonstrate_competency",
      competencyId: "basic-computer-literacy",
      title: "Basic computer literacy",
      required: true,
    },
  ],
  requirementGroups: [
    {
      id: "cluster-programming-and-web-foundations",
      displayName: "Programming and Web Foundations",
      groupKind: "foundation",
      purpose:
        "Give learners the baseline programming and browser knowledge needed before deeper frontend or backend specialization.",
      learningOutcomes: [
        {
          id: "cluster-outcome-use-programming-basics",
          statement: "Use programming fundamentals and web platform concepts to implement small interactive features.",
        },
      ],
      requirements: [
        {
          id: "req-complete-python-foundations",
          type: "complete_course",
          courseId: "local-python",
          title: "Complete Intro to Python",
          required: true,
          estimatedHours: 45,
        },
        {
          id: "req-complete-web-foundations",
          type: "complete_course",
          courseId: "local-web",
          title: "Complete Intro to Web Development",
          required: true,
          estimatedHours: 45,
        },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 90,
      masteryPolicy: {
        minimumMasteryPercent: 80,
        minimumAssessmentPercent: 70,
        remediationPolicy: "recommended",
      },
    },
    {
      id: "cluster-architecture-and-systems",
      displayName: "Architecture and Systems Thinking",
      groupKind: "cluster",
      purpose:
        "Move learners from feature implementation into durable design judgment, system boundaries, and operational tradeoffs.",
      learningOutcomes: [
        {
          id: "cluster-outcome-design-systems",
          statement: "Analyze software systems using views, quality attributes, constraints, and documented design decisions.",
        },
      ],
      requirements: [
        {
          id: "req-complete-software-architecture",
          type: "complete_course",
          courseId: "local-software-architecture",
          title: "Complete Software Architecture",
          required: true,
          estimatedHours: 60,
        },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 60,
      masteryPolicy: {
        minimumMasteryPercent: 80,
        minimumAssessmentPercent: 75,
        remediationPolicy: "recommended",
      },
      prerequisites: ["cluster-programming-and-web-foundations"],
    },
    {
      id: "cluster-intelligent-systems-elective",
      displayName: "Intelligent Systems Elective",
      groupKind: "elective_pool",
      purpose:
        "Let learners add AI or ML systems context without making the full-stack pathway depend on one specialization.",
      learningOutcomes: [
        {
          id: "cluster-outcome-evaluate-ai-context",
          statement: "Explain where AI or ML systems affect product architecture, reliability, and user experience.",
        },
      ],
      requirements: [
        {
          id: "req-complete-one-ai-elective",
          type: "complete_n_of_courses",
          count: 1,
          courseIds: ["local-ai", "local-mlsys"],
          title: "Complete one AI or ML systems elective",
          required: true,
          estimatedHours: 45,
        },
      ],
      completionRule: { type: "complete_n_of", count: 1 },
      estimatedHours: 45,
      masteryPolicy: {
        minimumMasteryPercent: 75,
        remediationPolicy: "optional",
      },
    },
    {
      id: "cluster-capstone-and-readiness",
      displayName: "Capstone and Readiness",
      groupKind: "capstone",
      purpose:
        "Convert completed learning into a reviewable portfolio artifact and final readiness evidence.",
      learningOutcomes: [
        {
          id: "cluster-outcome-present-capstone",
          statement: "Build, document, and present a production-style full-stack portfolio project.",
        },
      ],
      requirements: [
        {
          id: "req-submit-full-stack-capstone",
          type: "submit_project",
          projectId: "full-stack-portfolio-capstone",
          title: "Submit full-stack portfolio capstone",
          required: true,
          estimatedHours: 30,
        },
        {
          id: "req-pass-readiness-review",
          type: "pass_assessment",
          assessmentId: "full-stack-readiness-review",
          title: "Pass job-readiness review",
          minScore: 80,
          required: true,
          estimatedHours: 5,
        },
      ],
      completionRule: { type: "complete_all" },
      estimatedHours: 35,
      masteryPolicy: {
        minimumMasteryPercent: 85,
        minimumAssessmentPercent: 80,
        requiresCapstone: true,
        remediationPolicy: "required",
      },
      prerequisites: ["cluster-architecture-and-systems"],
    },
  ],
  estimatedHours: 230,
  masteryPolicy: {
    minimumMasteryPercent: 80,
    minimumAssessmentPercent: 75,
    requiresCapstone: true,
    remediationPolicy: "recommended",
  },
  credentialPolicy: {
    credentialType: "portfolio_record",
    title: "Full-Stack Engineer Pathway Record",
    issuer: "Lycium",
    requiresHumanReview: true,
  },
  dependencyGraph: {
    edges: [
      {
        fromNodeId: "cluster-programming-and-web-foundations",
        toNodeId: "cluster-architecture-and-systems",
        type: "required",
        rationale: "Architectural reasoning assumes the learner can already reason about programming and web applications.",
      },
      {
        fromNodeId: "cluster-architecture-and-systems",
        toNodeId: "cluster-capstone-and-readiness",
        type: "required",
        rationale: "The capstone should demonstrate design decisions, not just feature completion.",
      },
      {
        fromNodeId: "cluster-intelligent-systems-elective",
        toNodeId: "cluster-capstone-and-readiness",
        type: "recommended",
        rationale: "AI context can strengthen capstone scope without being mandatory for all learners.",
      },
    ],
  },
  version: "0.1.0",
  reviewStatus: "draft",
};

export default fullStackEngineerProgram;
