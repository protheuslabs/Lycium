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

type TrackKey =
  | "programming"
  | "intermediate-programming"
  | "math"
  | "computer-science"
  | "systems"
  | "data"
  | "software-design"
  | "web"
  | "backend"
  | "operations"
  | "security"
  | "ai"
  | "mobile"
  | "professional";

type ModuleTemplate = {
  title: string;
  goal: string;
  ideas: [string, string, string, string];
};

type TrackTemplate = {
  context: string;
  artifact: string;
  modules: ModuleTemplate[];
};

const DEFAULT_SOURCE_IDS = ["swebok-v4", "software-engineering-2014", "acm-computing-curricula-2020"];

const TAG_SOURCE_IDS: Array<{ terms: string[]; sourceIds: string[] }> = [
  { terms: ["python"], sourceIds: ["python-tutorial", "cs50-python"] },
  { terms: ["web", "frontend", "react", "angular", "vue", "html", "css"], sourceIds: ["mdn-learn-web-dev", "web-dev-learn"] },
  { terms: ["architecture", "design", "distributed", "events"], sourceIds: ["rw-software-systems-architecture-2e", "iso-iec-ieee-42010-2022"] },
  { terms: ["security", "threat"], sourceIds: ["owasp-wstg", "nist-ai-rmf"] },
  { terms: ["ai", "machine learning", "llm"], sourceIds: ["aima", "mlsys-book", "google-rules-of-ml", "mit-6s191-intro-deep-learning"] },
  { terms: ["testing", "quality"], sourceIds: ["swebok-v4"] },
];

const TRACKS: Record<TrackKey, TrackTemplate> = {
  programming: {
    context: "small programs that transform input into reliable output",
    artifact: "working command-line program",
    modules: [
      m("Program model", "read source code as ordered instructions executed by a runtime", ["Source file", "Runtime", "Statement", "Expression"]),
      m("Values and types", "store information accurately and choose representations intentionally", ["Variable binding", "Primitive type", "String operation", "Type conversion"]),
      m("Control flow", "make programs choose paths and repeat work safely", ["Boolean condition", "Branch", "Loop", "Loop invariant"]),
      m("Functions", "package behavior behind names, parameters, and return values", ["Function signature", "Parameter", "Return value", "Side effect"]),
      m("Collections", "organize multiple values and traverse them predictably", ["List", "Dictionary or map", "Index", "Iteration"]),
      m("Input and output", "accept external data and produce useful results", ["Standard input", "File read", "File write", "Parsing"]),
      m("Errors and debugging", "locate failures and make programs explain what went wrong", ["Exception", "Stack trace", "Breakpoint", "Defensive check"]),
      m("Testing basics", "turn expected behavior into repeatable checks", ["Test case", "Assertion", "Boundary value", "Regression"]),
      m("Program decomposition", "split larger work into readable pieces", ["Helper function", "Module", "Cohesion", "Coupling"]),
      m("Final program studio", "combine syntax, data, functions, and tests into a small finished program", ["Program requirement", "Implementation plan", "Manual test", "Code review"]),
    ],
  },
  "intermediate-programming": {
    context: "maintainable programs with modules, errors, tests, and data models",
    artifact: "multi-file application",
    modules: [
      m("Module boundaries", "organize code into files and public interfaces", ["Module export", "Import", "Public function", "Internal helper"]),
      m("Data modeling", "represent domain information with explicit structures", ["Record type", "Class", "Invariant", "Constructor"]),
      m("Collections and algorithms", "choose containers and operations that fit the workload", ["Array list", "Hash map", "Traversal", "Search"]),
      m("Error handling", "separate expected failures from programmer mistakes", ["Exception type", "Validation error", "Recovery path", "Error message"]),
      m("Object design", "assign responsibilities to objects without hiding behavior", ["Object responsibility", "Method", "Encapsulation", "Interface"]),
      m("Files and external data", "load, transform, and save structured information", ["Serialization", "CSV or JSON record", "File handle", "Schema drift"]),
      m("Automated tests", "protect behavior while changing implementation", ["Unit test", "Fixture", "Test double", "Coverage gap"]),
      m("Refactoring", "improve design while preserving behavior", ["Code smell", "Extract function", "Rename", "Behavior preservation"]),
      m("Packaging and tooling", "run, format, lint, and distribute code repeatably", ["Dependency file", "Formatter", "Linter", "Build command"]),
      m("Application studio", "deliver a small application with documentation and tests", ["Feature slice", "Acceptance test", "Release note", "Maintenance note"]),
    ],
  },
  math: {
    context: "formal models used to reason about computing problems",
    artifact: "worked solution set",
    modules: [
      m("Mathematical language", "translate technical statements into precise notation", ["Definition", "Variable", "Set", "Quantifier"]),
      m("Functions and relations", "describe mappings, constraints, and structure", ["Function", "Domain", "Range", "Relation"]),
      m("Proof and justification", "support claims with valid reasoning", ["Direct proof", "Contradiction", "Induction", "Counterexample"]),
      m("Change and rate", "connect formulas to movement, growth, or optimization", ["Limit", "Derivative", "Slope", "Optimization condition"]),
      m("Accumulation and area", "use totals and aggregation to model systems", ["Integral", "Summation", "Approximation", "Error bound"]),
      m("Vectors and transformations", "represent multidimensional data and movement", ["Vector", "Matrix", "Linear transformation", "Basis"]),
      m("Uncertainty", "reason about random variation and noisy evidence", ["Probability", "Random variable", "Distribution", "Expected value"]),
      m("Inference", "estimate unknowns from samples", ["Sample", "Confidence interval", "Hypothesis test", "P-value"]),
      m("Models for computing", "apply mathematics to algorithms, graphics, data, or AI", ["Graph model", "State space", "Cost function", "Numerical stability"]),
      m("Mathematical studio", "write clear solutions that connect notation to software intuition", ["Assumption", "Derivation", "Interpretation", "Verification"]),
    ],
  },
  "computer-science": {
    context: "abstract computational structures and algorithmic problem solving",
    artifact: "analyzed implementation",
    modules: [
      m("Abstraction and representation", "separate logical behavior from implementation details", ["Abstract data type", "Representation invariant", "Interface", "Client code"]),
      m("Complexity", "compare implementations by growth rate", ["Big O", "Worst case", "Average case", "Space complexity"]),
      m("Linear structures", "model ordered data and common access patterns", ["Array", "Linked list", "Stack", "Queue"]),
      m("Trees and maps", "organize hierarchical and key-based data", ["Binary tree", "Heap", "Hash table", "Balanced tree"]),
      m("Graphs", "model relationships and movement through networks", ["Vertex", "Edge", "Traversal", "Shortest path"]),
      m("Recursion", "solve a problem by reducing it to smaller cases", ["Base case", "Recursive case", "Call stack", "Divide and conquer"]),
      m("Algorithmic strategies", "choose a strategy that fits the problem structure", ["Greedy choice", "Dynamic programming", "Backtracking", "Memoization"]),
      m("Correctness", "explain why an algorithm always produces the intended result", ["Loop invariant", "Precondition", "Postcondition", "Proof of correctness"]),
      m("Tradeoff analysis", "select data structures under workload constraints", ["Operation cost", "Memory overhead", "Cache behavior", "Workload pattern"]),
      m("Implementation studio", "build and evaluate a data-structure or algorithmic component", ["Benchmark", "Test oracle", "Edge case", "Complexity report"]),
    ],
  },
  systems: {
    context: "software that depends on hardware, operating systems, networks, and failure behavior",
    artifact: "systems analysis report",
    modules: [
      m("Machine model", "connect code behavior to hardware and runtime execution", ["Instruction", "Register", "Memory address", "Binary representation"]),
      m("Memory", "reason about storage, lifetime, and locality", ["Stack memory", "Heap memory", "Pointer", "Cache locality"]),
      m("Processes and threads", "model concurrent execution safely", ["Process", "Thread", "Context switch", "Race condition"]),
      m("Scheduling and synchronization", "coordinate shared resources", ["Scheduler", "Lock", "Semaphore", "Deadlock"]),
      m("Files and persistence", "treat storage as a system boundary", ["File descriptor", "Filesystem", "Buffer", "Durability"]),
      m("Networking layers", "explain how messages move across machines", ["Packet", "Protocol", "TCP connection", "DNS lookup"]),
      m("Reliability and latency", "analyze delay, failure, retry, and timeout behavior", ["Latency", "Timeout", "Retry", "Backoff"]),
      m("Distributed coordination", "handle partial failure and shared state", ["Replication", "Consensus", "Consistency", "Partition"]),
      m("Observability", "inspect system behavior with evidence", ["Log line", "Metric", "Trace", "Profiling sample"]),
      m("Systems studio", "diagnose a realistic performance or reliability problem", ["Failure scenario", "Root cause", "Mitigation", "Postmortem"]),
    ],
  },
  data: {
    context: "persistent data products, databases, pipelines, and analytical systems",
    artifact: "data model or pipeline design",
    modules: [
      m("Data modeling", "turn domain facts into stable structures", ["Entity", "Attribute", "Relationship", "Constraint"]),
      m("Relational design", "organize data to reduce duplication and preserve meaning", ["Table", "Primary key", "Foreign key", "Normalization"]),
      m("Querying", "ask precise questions of stored data", ["Projection", "Selection", "Join", "Aggregation"]),
      m("Transactions", "protect correctness under concurrent change", ["ACID", "Isolation level", "Commit", "Rollback"]),
      m("Indexes and storage", "trade write cost for read performance", ["Index", "Scan", "Cardinality", "Query plan"]),
      m("Pipelines", "move data from sources to useful destinations", ["Batch job", "Transformation", "Orchestration", "Data contract"]),
      m("Quality and lineage", "detect bad data and trace where it came from", ["Data test", "Freshness", "Lineage", "Anomaly"]),
      m("Streaming", "process records as they arrive", ["Event time", "Window", "Offset", "Delivery guarantee"]),
      m("Governance", "manage privacy, retention, and access", ["Classification", "Retention rule", "Access policy", "Audit log"]),
      m("Data studio", "design a data product with tests and operational checks", ["Metric definition", "Dashboard contract", "Pipeline monitor", "Runbook"]),
    ],
  },
  "software-design": {
    context: "software requirements, design, architecture, construction, testing, and quality",
    artifact: "reviewable design package",
    modules: [
      m("Problem framing", "define the user need, system boundary, and success criteria", ["Stakeholder", "Requirement", "Scope boundary", "Acceptance criterion"]),
      m("Domain modeling", "name the important concepts before choosing implementation details", ["Domain concept", "Entity", "Workflow", "Ubiquitous language"]),
      m("Design principles", "reduce change cost through clear responsibilities", ["Abstraction", "Encapsulation", "Cohesion", "Coupling"]),
      m("Patterns and refactoring", "recognize reusable solutions and improve existing code", ["Design pattern", "Refactoring", "Strategy", "Adapter"]),
      m("Architecture views", "document structure for different stakeholder questions", ["Context view", "Container view", "Component view", "Runtime view"]),
      m("Quality attributes", "make tradeoffs visible and testable", ["Performance", "Reliability", "Security", "Maintainability"]),
      m("Construction practice", "write code that is readable, testable, and reviewable", ["Code review", "Configuration", "Error boundary", "Dependency hygiene"]),
      m("Verification", "choose evidence that matches the risk", ["Unit test", "Integration test", "Contract test", "End-to-end test"]),
      m("Evolution", "change systems without losing control", ["Technical debt", "Migration", "Compatibility", "Deprecation"]),
      m("Design studio", "assemble a design decision with requirements, tests, and tradeoffs", ["Decision record", "Alternative", "Risk", "Validation plan"]),
    ],
  },
  web: {
    context: "browser-based applications and user-facing web interfaces",
    artifact: "interactive web feature",
    modules: [
      m("Web platform model", "explain how browsers fetch, parse, render, and run code", ["URL", "HTTP request", "HTML document", "Render tree"]),
      m("HTML structure", "create semantic documents that machines and people can navigate", ["Element", "Heading hierarchy", "Landmark", "Form control"]),
      m("CSS layout", "control visual hierarchy and responsive structure", ["Cascade", "Specificity", "Flexbox", "Grid"]),
      m("JavaScript in the browser", "respond to events and update page state", ["DOM node", "Event listener", "State variable", "Mutation"]),
      m("Components", "break interfaces into reusable interactive pieces", ["Component", "Props", "State", "Composition"]),
      m("Routing and data", "load views and communicate with services", ["Route", "Fetch", "JSON payload", "Loading state"]),
      m("Forms and validation", "collect input safely and clearly", ["Input constraint", "Client validation", "Server validation", "Error message"]),
      m("Accessibility", "make interfaces usable with assistive technologies", ["Accessible name", "Keyboard focus", "ARIA role", "Color contrast"]),
      m("Frontend quality", "test behavior across users, devices, and browsers", ["Component test", "Visual regression", "Responsive breakpoint", "Performance budget"]),
      m("Web studio", "ship a polished page or feature with tests and accessibility checks", ["Feature route", "Interaction flow", "Accessibility audit", "Release checklist"]),
    ],
  },
  backend: {
    context: "server-side services, APIs, persistence, and integration boundaries",
    artifact: "service slice",
    modules: [
      m("Service model", "separate clients, servers, routes, and data stores", ["Client", "Server", "Route handler", "Service boundary"]),
      m("HTTP API design", "model resources and operations consistently", ["Resource", "HTTP method", "Status code", "Idempotency"]),
      m("Validation and errors", "protect service boundaries with explicit contracts", ["Request schema", "Validation error", "Problem response", "Error code"]),
      m("Persistence", "store and retrieve data without leaking database details", ["Repository", "Transaction", "Migration", "Connection pool"]),
      m("Authentication and authorization", "identify callers and enforce permissions", ["Session", "Token", "Role", "Policy check"]),
      m("Background work", "run delayed or long-running tasks reliably", ["Job queue", "Worker", "Retry", "Dead-letter queue"]),
      m("Integration", "call external services without making the system brittle", ["Client adapter", "Timeout", "Circuit breaker", "Webhook"]),
      m("Testing services", "verify API behavior at useful seams", ["Handler test", "Contract test", "Fixture", "Test database"]),
      m("Deployment readiness", "prepare services for configuration and operations", ["Environment variable", "Health check", "Log context", "Graceful shutdown"]),
      m("Backend studio", "build a complete endpoint with persistence, tests, and operational signals", ["Endpoint contract", "Persistence model", "Integration test", "Runbook note"]),
    ],
  },
  operations: {
    context: "delivery pipelines, infrastructure, containers, cloud services, and production operations",
    artifact: "deployment plan",
    modules: [
      m("Operating environment", "describe where software runs and what it depends on", ["Process", "Port", "Environment variable", "Service account"]),
      m("Linux workflow", "inspect systems from the command line", ["Shell pipeline", "Permission bit", "Process list", "Network socket"]),
      m("Containers", "package applications with repeatable runtime dependencies", ["Image", "Container", "Layer", "Volume"]),
      m("Orchestration", "coordinate multiple services and deployments", ["Replica", "Service discovery", "Rolling update", "Autoscaling"]),
      m("CI pipelines", "automate quality gates before release", ["Build step", "Test gate", "Artifact", "Pipeline secret"]),
      m("Release strategy", "ship changes with rollback and observability", ["Deployment environment", "Feature flag", "Rollback", "Canary"]),
      m("Cloud primitives", "compose compute, storage, networking, and identity", ["Compute instance", "Object storage", "Virtual network", "IAM policy"]),
      m("Monitoring", "detect and explain production behavior", ["Metric", "Alert", "Trace", "SLO"]),
      m("Incident response", "restore service and learn from failure", ["Incident commander", "Timeline", "Mitigation", "Postmortem"]),
      m("Operations studio", "deploy and operate a small service with evidence", ["Deployment manifest", "Health endpoint", "Alert rule", "Recovery procedure"]),
    ],
  },
  security: {
    context: "secure design, implementation, threat analysis, and operational defense",
    artifact: "security review package",
    modules: [
      m("Security goals", "connect confidentiality, integrity, availability, and safety to software choices", ["Asset", "Threat", "Vulnerability", "Control"]),
      m("Trust boundaries", "identify where data crosses between actors or privilege levels", ["Trust boundary", "Attack surface", "Entry point", "Privilege"]),
      m("Input handling", "treat external data as hostile until validated", ["Input validation", "Output encoding", "Injection", "Deserialization"]),
      m("Authentication", "verify identity without leaking secrets", ["Credential", "Session", "MFA", "Password hashing"]),
      m("Authorization", "enforce what authenticated users may do", ["Access control", "Least privilege", "Policy", "Broken object authorization"]),
      m("Secrets and dependencies", "manage sensitive material and third-party risk", ["Secret", "Dependency vulnerability", "SBOM", "Patch window"]),
      m("Threat modeling", "reason about abuse before implementation is fixed", ["Abuse case", "STRIDE", "Mitigation", "Residual risk"]),
      m("Security testing", "look for evidence of exploitable behavior", ["Test payload", "Scanner finding", "Manual verification", "False positive"]),
      m("Security operations", "monitor, respond, and improve after deployment", ["Detection rule", "Incident", "Forensic evidence", "Containment"]),
      m("Security studio", "produce a threat model and secure implementation checklist", ["Threat model diagram", "Control mapping", "Risk rating", "Review finding"]),
    ],
  },
  ai: {
    context: "AI-backed applications, model behavior, data pipelines, evaluation, and user-facing reliability",
    artifact: "AI feature design and evaluation plan",
    modules: [
      m("AI system framing", "separate product goals, model capabilities, and operating constraints", ["Model capability", "User task", "Failure mode", "Human oversight"]),
      m("Data and prompts", "shape model inputs with context, examples, and constraints", ["Prompt contract", "Context window", "Few-shot example", "Input grounding"]),
      m("Retrieval", "connect model output to source-backed information", ["Embedding", "Chunk", "Retriever", "Citation"]),
      m("Evaluation", "measure behavior with repeatable checks", ["Eval dataset", "Rubric", "Pass criterion", "Regression eval"]),
      m("Safety and policy", "reduce harmful, private, or unsupported outputs", ["Safety filter", "PII handling", "Refusal", "Escalation path"]),
      m("ML system lifecycle", "manage training, serving, monitoring, and feedback", ["Training data", "Model serving", "Drift", "Feedback loop"]),
      m("Latency and cost", "make AI features usable under resource constraints", ["Token budget", "Batching", "Caching", "Fallback"]),
      m("UX for uncertainty", "show model limits without abandoning the user", ["Confidence signal", "Editable output", "Review queue", "User correction"]),
      m("Operations", "monitor AI behavior after launch", ["Prompt version", "Eval run", "Trace", "Model incident"]),
      m("AI studio", "design an AI feature with retrieval, evals, safety, and release gates", ["Feature spec", "Source set", "Eval report", "Launch checklist"]),
    ],
  },
  mobile: {
    context: "mobile applications shaped by device constraints, platform APIs, offline behavior, and release channels",
    artifact: "mobile feature slice",
    modules: [
      m("Mobile platform model", "understand lifecycle, device resources, and app boundaries", ["App lifecycle", "Activity or scene", "Permission", "Device capability"]),
      m("Interface structure", "build screens and navigation for small touch devices", ["Screen", "Navigation stack", "Gesture", "Safe area"]),
      m("State and data", "keep local and remote state coherent", ["Local cache", "Remote sync", "Optimistic update", "Conflict"]),
      m("Networking", "handle slow, flaky, and metered connections", ["Request queue", "Retry policy", "Offline mode", "Connectivity state"]),
      m("Native capabilities", "use device APIs safely", ["Camera permission", "Location update", "Push notification", "Background task"]),
      m("Cross-platform architecture", "share logic without hiding platform differences", ["Shared module", "Native bridge", "Platform adapter", "Build target"]),
      m("Performance", "protect responsiveness and battery life", ["Frame budget", "Memory pressure", "Startup time", "Battery drain"]),
      m("Testing", "verify behavior across devices and releases", ["Device matrix", "Simulator", "UI test", "Crash report"]),
      m("Release", "prepare store builds and staged rollout", ["Signing key", "Build number", "Store review", "Phased rollout"]),
      m("Mobile studio", "ship a mobile feature with offline and release considerations", ["Feature flag", "Telemetry event", "Accessibility check", "Release note"]),
    ],
  },
  professional: {
    context: "professional software work, communication, ethics, product collaboration, and capstone delivery",
    artifact: "portfolio-ready professional artifact",
    modules: [
      m("Professional context", "connect engineering work to users, teams, organizations, and society", ["Stakeholder", "Professional duty", "Constraint", "Outcome"]),
      m("Communication", "write technical material that helps others act", ["Audience", "Purpose", "Decision record", "Diagram"]),
      m("Planning", "turn ambiguous goals into scoped work", ["Milestone", "Backlog item", "Estimate", "Risk"]),
      m("Collaboration", "coordinate with peers through review and feedback", ["Pull request", "Review comment", "Retrospective", "Team norm"]),
      m("Product thinking", "connect software choices to user value", ["User need", "Usability issue", "Metric", "Tradeoff"]),
      m("Ethics and law", "recognize privacy, accessibility, fairness, and compliance concerns", ["Privacy principle", "Accessibility requirement", "Bias risk", "License"]),
      m("Portfolio evidence", "turn project work into credible proof of capability", ["Case study", "Architecture note", "Test evidence", "Demo script"]),
      m("Interview readiness", "explain technical choices under questioning", ["Behavioral story", "Technical narrative", "Tradeoff answer", "Whiteboard model"]),
      m("Capstone delivery", "finish, document, and present substantial work", ["Scope change", "Acceptance demo", "Deployment evidence", "Lessons learned"]),
      m("Readiness review", "assess gaps and plan next professional steps", ["Skill gap", "Remediation plan", "Reference artifact", "Career target"]),
    ],
  },
};

function m(title: string, goal: string, ideas: [string, string, string, string]): ModuleTemplate {
  return { title, goal, ideas };
}

function cleanCoursePrefix(courseKey: string) {
  return courseKey.replace(/^local-/, "");
}

function domainLabel(title: string) {
  return title.replace(/^Programming [IVX]+:\s*/, "").replace(/^Cloud Foundations:\s*/, "").trim();
}

function haystack(input: Pick<SoftwareEngineeringBuildInput, "courseKey" | "title" | "tags">) {
  return `${input.courseKey} ${input.title} ${input.tags.join(" ")}`.toLowerCase();
}

function inferTrack(input: SoftwareEngineeringBuildInput): TrackKey {
  const text = haystack(input);
  if (text.includes("programming ii")) return "intermediate-programming";
  if (text.includes("programming i")) return "programming";
  if (/(discrete|calculus|linear algebra|probability|statistics|math)/.test(text)) return "math";
  if (/(data structures|algorithm)/.test(text)) return "computer-science";
  if (/(organization|operating systems|network|distributed)/.test(text)) return "systems";
  if (/(database|sql|data engineering|analytics|stream|scalable data|privacy|governance)/.test(text)) return "data";
  if (/(web platform|frontend|react|angular|vue|web programming)/.test(text)) return "web";
  if (/(api|backend|server-side|node|python|java)/.test(text)) return "backend";
  if (/(linux|container|orchestration|ci\/cd|cloud|observability|reliability|release|devops)/.test(text)) return "operations";
  if (/(security|secure|threat)/.test(text)) return "security";
  if (/(ai|machine learning|llm|ml systems)/.test(text)) return "ai";
  if (/(mobile|cross-platform)/.test(text)) return "mobile";
  if (/(communication|product|ux|agile|ethics|law|capstone|portfolio|career)/.test(text)) return "professional";
  return "software-design";
}

function makeExplanation(domain: string, profile: TrackTemplate, module: ModuleTemplate, idea: string) {
  return (
    `${idea} is a core idea in ${domain}. In this course, it belongs to ${profile.context}. ` +
    `The important move is to identify what ${idea.toLowerCase()} controls, what assumptions it depends on, and how it changes ` +
    `the design or implementation decision in front of you. This module uses ${idea.toLowerCase()} to ${module.goal}.`
  );
}

function makeExample(domain: string, profile: TrackTemplate, module: ModuleTemplate, idea: string) {
  return (
    `Consider a team building a ${profile.artifact} for ${domain}. A reviewer asks why the implementation behaves correctly in a ` +
    `normal case, a boundary case, and a failure case. The team points to ${idea.toLowerCase()} and shows how it supports the ` +
    `module goal: to ${module.goal}. That explanation turns the idea from vocabulary into engineering evidence.`
  );
}

function makePractice(domain: string, profile: TrackTemplate, idea: string) {
  return (
    `Create a small ${profile.artifact} note for ${domain}. Define ${idea.toLowerCase()}, give one concrete example, name one ` +
    "failure or edge case, and write the check you would use to know whether your understanding is correct."
  );
}

function makeConcepts(domain: string, module: ModuleTemplate, idea: string) {
  return [
    {
      name: idea,
      description: `${idea} is a named course concept used in ${domain} to reason about ${module.goal}.`,
    },
    {
      name: `${idea} boundary`,
      description: `The point where ${idea.toLowerCase()} starts, stops, or hands responsibility to another part of the system.`,
    },
    {
      name: `${idea} evidence`,
      description: `A test, example, diagram, trace, proof, or review artifact showing that ${idea.toLowerCase()} is understood correctly.`,
    },
  ];
}

function videoSourceIds(sourceIds: string[], track: TrackKey, moduleIndex: number) {
  if (track !== "ai") {
    return [];
  }

  const videos = ["mit-6s191-intro-deep-learning", "stanford-chip-good-ml-systems-design", "stanford-mlflow-industrial-scale"].filter((id) =>
    sourceIds.includes(id),
  );
  return moduleIndex < videos.length ? [videos[moduleIndex]] : [];
}

function buildTopic(input: SoftwareEngineeringBuildInput, profile: TrackTemplate, track: TrackKey, module: ModuleTemplate, moduleIndex: number, idea: string): LessonTopicSpec {
  const domain = domainLabel(input.title);

  return {
    title: idea,
    description: makeExplanation(domain, profile, module, idea),
    example: makeExample(domain, profile, module, idea),
    practice: makePractice(domain, profile, idea),
    concepts: makeConcepts(domain, module, idea),
    sourceIds: input.sourceIds,
    videoSourceIds: videoSourceIds(input.sourceIds, track, moduleIndex),
  };
}

export function selectSoftwareEngineeringSourceIds(input: { title: string; tags: string[] }) {
  const sourceIds = new Set(DEFAULT_SOURCE_IDS);
  const text = haystack({ courseKey: "", title: input.title, tags: input.tags });

  for (const mapping of TAG_SOURCE_IDS) {
    if (mapping.terms.some((term) => text.includes(term))) {
      mapping.sourceIds.forEach((sourceId) => sourceIds.add(sourceId));
    }
  }

  return Array.from(sourceIds);
}

export function buildSoftwareEngineeringCourseModules(input: SoftwareEngineeringBuildInput) {
  const domain = domainLabel(input.title);
  const track = inferTrack(input);
  const profile = TRACKS[track];
  const moduleSpecs: FullCourseModuleSpec[] = profile.modules.map((module, moduleIndex) => ({
    title: module.title,
    objective: `Use ${domain} concepts to ${module.goal}, with enough evidence to explain the result in a software engineering review.`,
    studio: `Build a ${profile.artifact} for ${domain} that applies ${module.ideas.join(", ")} and records examples, edge cases, and checks.`,
    topics: module.ideas.map((idea) => buildTopic(input, profile, track, module, moduleIndex, idea)),
    sourceIds: input.sourceIds,
  }));

  return buildFullCourseModules({
    coursePrefix: cleanCoursePrefix(input.courseKey),
    pacingLabel: "Module",
    moduleSpecs,
    defaultSourceIds: input.sourceIds,
  });
}
