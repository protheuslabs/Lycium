import type { LyciumPortfolioArtifactRequirement } from "@lycium/contracts";

export const localPortfolioArtifacts: LyciumPortfolioArtifactRequirement[] = [
  {
    id: "full-stack-portfolio-capstone",
    title: "Full-stack portfolio capstone",
    artifactType: "repo",
    requiredEvidence: [
      "Public or reviewable source repository",
      "Deployed application URL or recorded demo",
      "Architecture decision notes",
      "Test and quality evidence",
      "Setup and operations documentation",
    ],
    rubricId: "rubric-full-stack-capstone-review",
  },
  {
    id: "se-architecture-quality-evidence-package",
    title: "Architecture and quality evidence package",
    artifactType: "case_study",
    requiredEvidence: [
      "Stakeholder and requirement summary",
      "Architecture views or diagrams",
      "Quality attribute scenarios",
      "Tradeoff and risk analysis",
      "Testing strategy evidence",
    ],
    rubricId: "rubric-se-architecture-quality-package",
  },
  {
    id: "se-service-backed-application-slice",
    title: "Service-backed application slice",
    artifactType: "repo",
    requiredEvidence: [
      "Frontend or client workflow",
      "API/service boundary",
      "Persistent data or mocked persistence layer",
      "Automated tests for the core path",
      "Short integration walkthrough",
    ],
    rubricId: "rubric-se-application-slice",
  },
  {
    id: "se-deployed-service-evidence",
    title: "Deployed service evidence",
    artifactType: "demo",
    requiredEvidence: [
      "Deployment target or environment description",
      "Build/release workflow evidence",
      "Observability signal examples",
      "Rollback or incident-response note",
      "Operational risk checklist",
    ],
    rubricId: "rubric-se-deployed-service-evidence",
  },
  {
    id: "se-professional-practice-dossier",
    title: "Professional practice dossier",
    artifactType: "essay",
    requiredEvidence: [
      "Technical communication sample",
      "Team/process reflection",
      "Ethics or responsibility analysis",
      "Accessibility or inclusion consideration",
      "Product/stakeholder tradeoff note",
    ],
    rubricId: "rubric-se-professional-practice",
  },
  {
    id: "se-specialization-evidence-artifact",
    title: "Specialization evidence artifact",
    artifactType: "case_study",
    requiredEvidence: [
      "Selected specialization context",
      "Advanced implementation or design artifact",
      "Tradeoff explanation",
      "Evaluation or review evidence",
      "Connection to capstone direction",
    ],
    rubricId: "rubric-se-specialization-evidence",
  },
  {
    id: "se-capstone-portfolio-project",
    title: "Software engineering capstone portfolio project",
    artifactType: "repo",
    requiredEvidence: [
      "Reviewable source repository",
      "Working deployment or recorded demo",
      "Architecture and requirements package",
      "Automated test evidence",
      "Operations/readiness notes",
      "Final presentation or portfolio case study",
    ],
    rubricId: "rubric-se-capstone-portfolio",
  },
];

export const localPortfolioArtifactMap = new Map(localPortfolioArtifacts.map((artifact) => [artifact.id, artifact]));
export const localPortfolioArtifactIds = localPortfolioArtifacts.map((artifact) => artifact.id);

export default localPortfolioArtifacts;
