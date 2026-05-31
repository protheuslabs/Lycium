import type { LyciumProgram } from "@lycium/contracts";
import { fullStackEngineerEntryRequirements, fullStackEngineerRequirementGroups } from "./fullStackEngineerProgramRequirements";

export const fullStackEngineerProgram: LyciumProgram = {
  id: "program-full-stack-engineer",
  title: "Full-Stack Engineer",
  description:
    "A source-backed professional pathway that turns programming, web systems, backend services, operations, and capstone work into a coherent full-stack engineering path.",
  programType: "career_path",
  field: "Software Engineering",
  level: "professional",
  targetOutcome:
    "Prepare learners to design, build, test, deploy, document, and explain a production-style full-stack web application with reviewable portfolio evidence.",
  learningOutcomes: [
    {
      id: "outcome-foundations",
      statement: "Use developer tools, version control, programming fundamentals, and web platform concepts inside a modern software project.",
    },
    {
      id: "outcome-frontend",
      statement: "Build accessible, testable, component-based browser interfaces with clear state and routing decisions.",
    },
    {
      id: "outcome-backend-data",
      statement: "Design backend APIs, persistence, authentication boundaries, and data-layer choices that are reliable and explainable.",
    },
    {
      id: "outcome-delivery-operations",
      statement: "Ship software through tests, CI/CD, deployment, observability, and operational feedback loops.",
    },
    {
      id: "outcome-portfolio-evidence",
      statement: "Produce portfolio artifacts that demonstrate implementation, testing, documentation, deployment, and architecture judgment.",
    },
  ],
  entryRequirements: fullStackEngineerEntryRequirements,
  requirementGroups: fullStackEngineerRequirementGroups,
  estimatedHours: 1055,
  masteryPolicy: {
    minimumMasteryPercent: 85,
    minimumAssessmentPercent: 80,
    requiresCapstone: true,
    remediationPolicy: "required",
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
        toNodeId: "cluster-programming-core",
        type: "required",
        rationale: "Programming depth assumes developer tools, version control, and web basics.",
      },
      {
        fromNodeId: "cluster-programming-core",
        toNodeId: "cluster-frontend-engineering",
        type: "required",
        rationale: "Frontend engineering depends on programming fluency and testable software construction.",
      },
      {
        fromNodeId: "cluster-programming-core",
        toNodeId: "cluster-backend-and-data",
        type: "required",
        rationale: "Backend and data work require core programming fluency.",
      },
      {
        fromNodeId: "cluster-frontend-engineering",
        toNodeId: "cluster-delivery-and-operations",
        type: "required",
        rationale: "Delivery work should include at least one complete client application path.",
      },
      {
        fromNodeId: "cluster-backend-and-data",
        toNodeId: "cluster-delivery-and-operations",
        type: "required",
        rationale: "Operations work should include API, data, and security context.",
      },
      {
        fromNodeId: "cluster-delivery-and-operations",
        toNodeId: "cluster-capstone-and-readiness",
        type: "required",
        rationale: "The capstone should demonstrate deployed, observable, and supportable software.",
      },
      {
        fromNodeId: "cluster-specialization-electives",
        toNodeId: "cluster-capstone-and-readiness",
        type: "recommended",
        rationale: "Elective depth can make the capstone more distinctive and job-relevant.",
      },
    ],
  },
  version: "0.2.0",
  reviewStatus: "reviewed",
};

export default fullStackEngineerProgram;
