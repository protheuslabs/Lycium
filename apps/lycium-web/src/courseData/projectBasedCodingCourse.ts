import type { CourseBlock, CourseData, CourseEntry, CourseModule, CourseSection } from "../courseTypes";

const COURSE_ID = "local-project-based-coding";
const COURSE_TITLE = "Project-Based Coding: Web App Studio";

const PYTHON = "python-tutorial";
const CS50 = "cs50-python";
const MDN = "mdn-learn-web-dev";
const WEBDEV = "web-dev-learn";
const SWEBOK = "swebok-v4";
const OWASP = "owasp-wstg";

const SOURCE_IDS = [PYTHON, CS50, MDN, WEBDEV, SWEBOK, OWASP];

type ConceptSpec = {
  title: string;
  description: string;
};

type LessonSpec = {
  title: string;
  explanation: string;
  example: string;
  practice: string;
  concepts: ConceptSpec[];
  sourceIds: string[];
};

type ProjectSpec = {
  title: string;
  artifactType: string;
  instructions: string;
  requiredEvidence: string[];
  submissionType: string;
  submissionMethods?: string[];
  acceptedFileTypes?: string[];
  rubricCriteria?: Array<{ id: string; title: string; description: string; points: number }>;
  sourceIds: string[];
};

type ModuleSpec = {
  title: string;
  objective: string;
  sourceIds: string[];
  lessons: LessonSpec[];
  extraProjects?: ProjectSpec[];
  project: ProjectSpec;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function textBlock(title: string, value: string, sourceIds: string[]): CourseBlock {
  return { type: "text", title, value, sourceIds } as CourseBlock;
}

function conceptCard(concept: ConceptSpec, sourceIds: string[], sourceSectionId?: string): CourseBlock {
  return {
    type: "conceptCard",
    title: concept.title,
    description: concept.description,
    sourceIds,
    ...(sourceSectionId ? { sourceSectionId } : {}),
  } as CourseBlock;
}

function projectBlock(project: ProjectSpec, sectionId: string): CourseBlock {
  const rubricId = `${sectionId}-rubric`;
  return {
    type: "project",
    title: project.title,
    instructions: project.instructions,
    artifactType: project.artifactType,
    requiredEvidence: project.requiredEvidence,
    sourceIds: project.sourceIds,
    rubric: {
      id: rubricId,
      title: "Project rubric",
      criteria: project.rubricCriteria ?? [
        {
          id: "working-artifact",
          title: "Working artifact",
          description: "The submitted work runs or renders and satisfies the stated user-facing behavior.",
          points: 4,
        },
        {
          id: "code-structure",
          title: "Code structure",
          description: "The solution is decomposed into understandable files, functions, components, or sections.",
          points: 4,
        },
        {
          id: "evidence-and-explanation",
          title: "Evidence and explanation",
          description: "The submission explains design choices, cites relevant course concepts, and includes reviewable evidence.",
          points: 3,
        },
        {
          id: "quality-pass",
          title: "Quality pass",
          description: "The learner checks usability, errors, accessibility, security, or maintainability before submitting.",
          points: 3,
        },
      ],
    },
    submission: {
      submissionType: project.submissionType,
      submissionMethods: project.submissionMethods,
      acceptedTypes: [project.submissionType],
      acceptedFileTypes: project.acceptedFileTypes,
      instructions: "Submit the project in one accepted format. Include enough context for the grader to inspect what changed and why.",
      maxFiles: 3,
      maxFileSizeMb: 25,
    },
    graderWorkflow: {
      grader: "agent",
      rubricId,
      status: "ready",
      allowedContext: ["course", "sources", "rubric", "submission"],
      feedbackPolicy: "Grade against each rubric criterion, name one strength, one blocking issue if present, and one concrete next revision.",
    },
  } as CourseBlock;
}

function makeQuizQuestions(concepts: ConceptSpec[]) {
  const bank = concepts.length >= 10
    ? concepts.slice(0, 10)
    : Array.from({ length: 10 }, (_, index) => concepts[index % concepts.length]);

  return bank.map((concept, index) => {
    const neighborA = concepts[(index + 1) % concepts.length] ?? concept;
    const neighborB = concepts[(index + 2) % concepts.length] ?? concept;
    const neighborC = concepts[(index + 3) % concepts.length] ?? concept;
    return {
      question: `Which statement best describes ${concept.title}?`,
      options: [concept.description, neighborA.description, neighborB.description, neighborC.description],
      answers: [0],
      timed: "f" as const,
    };
  });
}

function buildProjectSection(project: ProjectSpec, moduleNumber: number, projectIndex = 0): CourseSection {
  const sectionId = projectIndex > 0 ? `coding-studio-m${pad(moduleNumber)}-project-${pad(projectIndex)}` : `coding-studio-m${pad(moduleNumber)}-project`;
  return {
    id: sectionId,
    title: project.title,
    pageType: "apply",
    sectionType: "project",
    estimatedMinutes: 90,
    sourceIds: project.sourceIds,
    content: [projectBlock(project, sectionId)],
  };
}

function buildModule(spec: ModuleSpec, moduleIndex: number): CourseModule {
  const moduleNumber = moduleIndex + 1;
  const moduleId = `coding-studio-m${pad(moduleNumber)}`;
  const lessonSections = spec.lessons.map((lesson, lessonIndex) => {
    const sectionId = `${moduleId}-u${pad(lessonIndex + 1)}`;
    return {
      id: sectionId,
      title: lesson.title,
      pageType: "learn" as const,
      estimatedMinutes: 35,
      sourceIds: lesson.sourceIds,
      content: [
        textBlock("Explanation", lesson.explanation, lesson.sourceIds),
        textBlock("Example", lesson.example, lesson.sourceIds),
        textBlock("Practice", lesson.practice, lesson.sourceIds),
        { type: "heading", title: "Concepts introduced", sourceIds: lesson.sourceIds } as CourseBlock,
        ...lesson.concepts.map((concept) => conceptCard(concept, lesson.sourceIds)),
      ],
    };
  });
  const conceptsWithSections = spec.lessons.flatMap((lesson, lessonIndex) =>
    lesson.concepts.map((concept) => ({
      concept,
      sourceIds: lesson.sourceIds,
      sectionId: `${moduleId}-u${pad(lessonIndex + 1)}`,
    })),
  );
  const assessmentSection: CourseSection = {
    id: `${moduleId}-quiz`,
    title: `Quiz: ${spec.title.replace(/^Module \d+:\s*/, "")}`,
    pageType: "apply",
    sectionType: "assessment",
    estimatedMinutes: 25,
    sourceIds: spec.sourceIds,
    content: [
      {
        type: "quiz",
        title: `Module ${moduleNumber} quiz`,
        sourceIds: spec.sourceIds,
        maxAttempts: 3,
        passPercentage: 80,
        showAnswers: false,
        questions: makeQuizQuestions(conceptsWithSections.map(({ concept }) => concept)),
      } as CourseBlock,
    ],
  };
  const summarySection: CourseSection = {
    id: `${moduleId}-summary`,
    title: `Module ${moduleNumber}: Concept review`,
    sectionType: "summary",
    pageType: "learn",
    estimatedMinutes: 15,
    sourceIds: spec.sourceIds,
    content: [
      { type: "heading", title: "Module concepts", sourceIds: spec.sourceIds } as CourseBlock,
      ...conceptsWithSections.map(({ concept, sourceIds, sectionId }) => conceptCard(concept, sourceIds, sectionId)),
    ],
  };

  return {
    id: moduleId,
    title: spec.title,
    estimatedMinutes: 200,
    sourceIds: spec.sourceIds,
    sections: [
      ...lessonSections,
      ...(spec.extraProjects ?? []).map((project, index) => buildProjectSection(project, moduleNumber, index + 1)),
      buildProjectSection(spec.project, moduleNumber),
      assessmentSection,
      summarySection,
    ],
  };
}

const modules: ModuleSpec[] = [
  {
    title: "Module 1: Program behavior and decomposition",
    objective: "Build a small command-line program from observable behavior, inputs, functions, and test cases.",
    sourceIds: [PYTHON, CS50, SWEBOK],
    lessons: [
      {
        title: "Program inputs, outputs, and state",
        sourceIds: [PYTHON, CS50],
        explanation: "A useful program transforms inputs into outputs while keeping enough state to remember what has happened. In Python, input values, variables, functions, and printed output give a beginner a concrete way to see that transformation. The goal is not to memorize syntax first; it is to describe the behavior, then choose the smallest code structures that make the behavior repeatable [1].",
        example: "A task tracker can accept a task name, store it in a list, and print the list back to the user. The input is the task name, the state is the list, and the output is the displayed task inventory.",
        practice: "Sketch a command-line task tracker with three commands: add, list, and complete. Write the input, state change, and output for each command before writing code.",
        concepts: [
          { title: "Program input", description: "Data supplied to a program by a user, file, network request, or another process." },
          { title: "Program output", description: "Visible or stored result produced by a program after processing input." },
          { title: "Program state", description: "Information a program keeps while it runs so later behavior can depend on earlier actions." },
          { title: "Function boundary", description: "A named unit of behavior with inputs, internal logic, and a return value or side effect." },
        ],
      },
      {
        title: "Readable functions and small tests",
        sourceIds: [PYTHON, CS50, SWEBOK],
        explanation: "A project becomes easier to grade and revise when behavior is divided into named functions. Small tests are examples with expected outcomes: if `complete_task(2)` is called, task 2 should become complete and the remaining list should still be readable. This links coding to software engineering practice because the artifact is not only code; it is code plus evidence that the code behaves as intended [5].",
        example: "Instead of one long loop, a task tracker might have `add_task`, `complete_task`, `format_tasks`, and `run_command`. Each function can be checked separately before the full command loop is tested.",
        practice: "Name four functions for the task tracker. For each function, write one example input and one expected result.",
        concepts: [
          { title: "Decomposition", description: "Breaking a program into smaller parts that each have a focused responsibility." },
          { title: "Test case", description: "A specific input or action paired with the output or state change expected from the program." },
          { title: "Readable code", description: "Code whose names, structure, and local decisions help another person understand its purpose." },
          { title: "Review evidence", description: "Notes, tests, screenshots, or links that let a reviewer inspect whether a project satisfies the task." },
        ],
      },
    ],
    extraProjects: [
      {
        title: "Project: Explain function boundaries",
        artifactType: "concept-explanation",
        sourceIds: [PYTHON, CS50, SWEBOK],
        submissionType: "text",
        instructions: "Write a short explanation of function boundaries for another beginner. Use the task tracker idea as your example and explain why separating behavior into named functions makes the project easier to test, revise, and grade.",
        requiredEvidence: [
          "A plain-language definition of function boundary.",
          "One task tracker example with at least two named functions.",
          "One explanation of how function boundaries help testing or review.",
          "One sentence naming a possible weak function boundary and how to improve it.",
        ],
        rubricCriteria: [
          {
            id: "concept-accuracy",
            title: "Concept accuracy",
            description: "The explanation defines function boundary accurately and connects it to inputs, behavior, and outputs.",
            points: 4,
          },
          {
            id: "example-quality",
            title: "Example quality",
            description: "The task tracker example uses named functions or responsibilities that make the concept concrete.",
            points: 4,
          },
          {
            id: "review-reasoning",
            title: "Review reasoning",
            description: "The response explains how function boundaries improve testing, revision, grading, or code review.",
            points: 3,
          },
        ],
      },
    ],
    project: {
      title: "Project: Command-line task tracker",
      artifactType: "repo-or-text",
      sourceIds: [PYTHON, CS50, SWEBOK],
      submissionType: "link",
      instructions: "Build or outline a command-line task tracker with add, list, and complete behavior. If you submit code, include a repository or paste the code. If you submit a design document, include pseudocode detailed enough for another learner to implement.",
      requiredEvidence: [
        "A command list or user-flow description.",
        "At least four named functions or responsibilities.",
        "Three test cases with expected outcomes.",
        "A short reflection naming one behavior that was hardest to make reliable.",
      ],
    },
  },
  {
    title: "Module 2: Web pages as user interfaces",
    objective: "Create a static web interface that uses semantic structure, styling, and basic interaction.",
    sourceIds: [MDN, WEBDEV, SWEBOK],
    lessons: [
      {
        title: "Semantic HTML and page structure",
        sourceIds: [MDN, WEBDEV],
        explanation: "HTML gives a page meaning before it gives it appearance. A button, heading, form, list, and main region tell the browser and assistive technologies what each part does. Semantic structure makes the project easier to style, test, and explain because the code mirrors the user's mental model of the page [3].",
        example: "A study planner page might use a `main` region, an `h1`, a form for new goals, and a list of saved goals. Those elements communicate purpose before CSS is added.",
        practice: "Draft the HTML structure for a one-page study planner. Use semantic elements before choosing colors or layout.",
        concepts: [
          { title: "Semantic HTML", description: "HTML that uses elements according to their meaning and role, not only their default appearance." },
          { title: "Document structure", description: "The ordered hierarchy of headings, landmarks, forms, lists, and content sections on a page." },
          { title: "Form control", description: "An interactive HTML element that lets a user enter, choose, or submit data." },
          { title: "Accessible name", description: "The text or label that exposes an interactive element's purpose to assistive technology." },
        ],
      },
      {
        title: "CSS layout and responsive constraints",
        sourceIds: [MDN, WEBDEV],
        explanation: "CSS turns structure into visual communication. Layout rules such as grid, flexbox, spacing, and max-width decide how the interface responds to different screens. Good beginner styling is not decoration first; it is hierarchy, readability, and constraints so the same page remains usable on desktop and mobile [4].",
        example: "A planner card grid can use `display: grid`, a minimum card width, and a gap. On narrow screens, the same cards naturally stack without a separate mobile rewrite.",
        practice: "Choose three layout constraints for your study planner: max page width, card spacing, and mobile stacking behavior.",
        concepts: [
          { title: "Layout constraint", description: "A rule that limits size, spacing, or placement so an interface remains readable across contexts." },
          { title: "Responsive layout", description: "A layout that adapts to available viewport size without losing content or interaction." },
          { title: "Visual hierarchy", description: "The use of size, spacing, contrast, and grouping to show what matters most on a page." },
          { title: "CSS grid", description: "A CSS layout system for arranging content in rows and columns with explicit spacing rules." },
        ],
      },
    ],
    project: {
      title: "Project: Responsive study planner page",
      artifactType: "web-page",
      sourceIds: [MDN, WEBDEV],
      submissionType: "image",
      acceptedFileTypes: [".png", ".jpg", ".jpeg"],
      instructions: "Build a static study planner page or submit a screenshot/mockup of one. The page should contain a clear heading, one form-like input area, a list or card region, and responsive layout decisions.",
      requiredEvidence: [
        "A link, screenshot, or PDF of the page.",
        "One note explaining the semantic elements used.",
        "One note explaining the responsive layout rule.",
        "One accessibility check, such as labels, heading order, or contrast.",
      ],
    },
  },
  {
    title: "Module 3: Data-backed interaction",
    objective: "Model data as structured records and use it to drive a small interactive application.",
    sourceIds: [PYTHON, MDN, WEBDEV],
    lessons: [
      {
        title: "Data records and rendering",
        sourceIds: [PYTHON, MDN],
        explanation: "Interactive applications usually separate data from the way it is displayed. A goal, task, or habit can be represented as a record with fields. Rendering means turning those fields into visible text, controls, and status indicators. This habit keeps the interface from becoming a pile of unrelated strings [1].",
        example: "A habit record might contain `title`, `targetDays`, `completedDays`, and `notes`. The page can render the title, show progress, and display the notes from one source of truth.",
        practice: "Design a data record for a habit tracker. Include at least four fields and describe how each field appears in the interface.",
        concepts: [
          { title: "Data record", description: "A structured object that groups fields describing one entity or item in an application." },
          { title: "Source of truth", description: "The authoritative data structure from which visible interface state is derived." },
          { title: "Rendering", description: "The process of turning data into visible user interface elements." },
          { title: "Derived display", description: "A visible value calculated from underlying data instead of stored separately." },
        ],
      },
      {
        title: "Event flow and validation",
        sourceIds: [MDN, WEBDEV, SWEBOK],
        explanation: "An interaction has an event, a decision, a state update, and a visible response. Validation checks whether the input is acceptable before the update is committed. Describing this flow before coding helps prevent invisible bugs such as saving blank items, duplicating records, or showing stale output [3].",
        example: "When a user submits a habit title, the app checks that the title is not blank, adds a habit record, clears the input, and re-renders the list.",
        practice: "Write the event flow for adding a habit, marking it complete, and deleting it. Include one validation rule for each action.",
        concepts: [
          { title: "Event flow", description: "The ordered path from user action to validation, state update, and visible feedback." },
          { title: "Input validation", description: "A check that user-provided data meets the requirements before it changes application state." },
          { title: "State update", description: "A deliberate change to the data an application uses to determine its next display." },
          { title: "User feedback", description: "Visible or textual confirmation that helps the user understand what happened after an action." },
        ],
      },
    ],
    project: {
      title: "Project: Habit tracker interaction",
      artifactType: "interactive-prototype",
      sourceIds: [PYTHON, MDN, WEBDEV],
      submissionType: "file",
      acceptedFileTypes: [".html", ".css", ".js", ".py", ".zip"],
      instructions: "Create an interactive habit tracker prototype or submit a detailed implementation plan. It should define habit records, support at least two user actions, and include validation.",
      requiredEvidence: [
        "A running link, source file, zip, or pasted implementation plan.",
        "The habit record shape with field names.",
        "Two event flows with validation and visible feedback.",
        "One bug or edge case you tested or reasoned through.",
      ],
    },
  },
  {
    title: "Module 4: Review, security, and portfolio readiness",
    objective: "Prepare a coding project for review by checking quality, basic security, documentation, and submission evidence.",
    sourceIds: [SWEBOK, OWASP, MDN],
    lessons: [
      {
        title: "Code review and maintainability",
        sourceIds: [SWEBOK],
        explanation: "A finished learning project should be understandable by someone who did not watch it being built. Reviewable code has purposeful names, small sections, comments where decisions are not obvious, and a README or explanation that tells the reviewer how to run or inspect it. This turns a class exercise into portfolio evidence [5].",
        example: "A README for the habit tracker can describe the goal, list features, explain how data is represented, and name one limitation that remains.",
        practice: "Write a README outline for one project from this course. Include setup, feature list, design choices, and known limitations.",
        concepts: [
          { title: "Maintainability", description: "The ease with which a project can be understood, changed, tested, and repaired over time." },
          { title: "README", description: "A project document that explains purpose, setup, usage, design notes, and limitations." },
          { title: "Known limitation", description: "A consciously documented weakness, omission, or constraint in the current project version." },
          { title: "Portfolio evidence", description: "Reviewable work that demonstrates a skill through artifacts rather than only completion claims." },
        ],
      },
      {
        title: "Basic web security and responsible submission",
        sourceIds: [OWASP, MDN],
        explanation: "Even beginner applications should avoid unsafe habits. Do not trust raw user input, do not expose secrets, and do not treat client-side checks as real protection. For this course, the goal is basic awareness: name what input exists, where it is displayed, and what would need stronger validation before the project became public [6].",
        example: "If a habit tracker displays user-entered text, the learner should explain how the project avoids injecting untrusted markup or why a future implementation would need sanitization.",
        practice: "Make a security note for one submitted project. Name one input, one possible misuse, and one mitigation or future hardening step.",
        concepts: [
          { title: "Untrusted input", description: "Data supplied by users or external systems that should be checked before use." },
          { title: "Secret exposure", description: "Accidentally revealing API keys, passwords, tokens, or private configuration in source or output." },
          { title: "Client-side check", description: "A browser-side validation or behavior rule that improves UX but should not be treated as a security boundary." },
          { title: "Mitigation", description: "A design or implementation choice that reduces the likelihood or impact of a specific risk." },
        ],
      },
    ],
    project: {
      title: "Project: Portfolio-ready coding submission",
      artifactType: "portfolio-package",
      sourceIds: [SWEBOK, OWASP, MDN],
      submissionType: "doc",
      submissionMethods: ["file_upload", "google_docs_future"],
      acceptedFileTypes: [".pdf", ".doc", ".docx"],
      instructions: "Choose one earlier project and prepare it as a portfolio-ready submission. Improve the explanation, add review evidence, and include a quality/security note.",
      requiredEvidence: [
        "A project link, document, or pasted portfolio package.",
        "A README-style project explanation.",
        "A short quality checklist with at least four checks.",
        "A basic security note naming input, risk, and mitigation.",
      ],
    },
  },
];

export const projectBasedCodingCourseData = {
  title: COURSE_TITLE,
  shortDescription: "A project-first coding studio where learners build, submit, and receive rubric feedback on small programming and web app artifacts.",
  difficultyLevel: "undergrad",
  category: "computing-information-sciences",
  department: "software-engineering",
  tags: ["software-engineering", "computer-science", "web-development", "projects"],
  learningTypes: [],
  estimatedHours: 14,
  orderMandatory: false,
  sourceIds: SOURCE_IDS,
  courseEquivalencies: [
    {
      institution: "Harvard University",
      department: "Computer Science",
      courseCode: "CS50P",
      title: "CS50's Introduction to Programming with Python",
      url: "https://cs50.harvard.edu/python/",
      notes: "Open course benchmark for beginner programming practice, not a transfer-credit claim.",
    },
    {
      institution: "Mozilla Developer Network",
      department: "Web Development",
      title: "MDN Learn Web Development",
      url: "https://developer.mozilla.org/en-US/docs/Learn",
      notes: "Open web-development reference used for semantic HTML, CSS, and interaction topics.",
    },
  ],
  prerequisites: [
    {
      type: "competency",
      title: "Basic computer use and file management",
      required: true,
      rationale: "Learners need to create files, follow instructions, and submit links, text, or documents.",
    },
  ],
  metadata: {
    pacingLabel: "Module",
    courseType: "practical_training_course",
    learningMethod: ["project-first", "text-heavy", "assessment-heavy"],
    scope: {
      audience: "Beginning programmers who want a practical course for testing Lycium project submissions and grader feedback.",
      level: "introductory undergraduate",
      duration: "4 project modules",
      outcome: "Build, document, submit, and revise small coding artifacts with rubric-based feedback.",
      prerequisites: ["basic computer use", "willingness to read code examples"],
      exclusions: ["advanced frameworks", "production deployment", "database administration"],
      assessmentStyle: "Each module includes a rubric-graded project submission plus a short concept quiz.",
    },
    editPolicy: {
      editable: true,
      ownerCanEdit: true,
      learnersCanFork: true,
      publishGateRequired: true,
    },
    snapshotLifecycle: {
      lineageId: "project-based-coding-web-app-studio",
      canonicalSlug: "project-based-coding-web-app-studio",
      snapshotId: "project-based-coding-web-app-studio-v1",
      version: 1,
      status: "review",
    },
    sourceCoveragePolicy: {
      minimumCourseSources: 4,
      minimumSourcesPerModule: 1,
      minimumRequiredConceptCoveragePercent: 80,
      requireAssessmentCoverage: true,
    },
    generationReadiness: {
      contractVersion: "course-generation-readiness-v1",
      status: "ready",
      ready: true,
      sourceEvidence: {
        sourceUrlCount: SOURCE_IDS.length,
        usableInputArtifactCount: SOURCE_IDS.length,
        submittedEvidenceCount: SOURCE_IDS.length,
        minimumCourseSources: 4,
      },
      conceptCoverage: {
        status: "ready",
        coverageRatio: 1,
        minimumCoverageRatio: 0.8,
      },
      issues: [],
    },
    generationPlan: {
      status: ["scoped", "modules_planned", "sources_mapped", "content_drafted"],
      generatedBy: "codex-agent",
      moduleCount: modules.length,
      sourceMap: {
        programming: [PYTHON, CS50],
        webInterface: [MDN, WEBDEV],
        engineeringPractice: [SWEBOK],
        security: [OWASP],
      },
    },
  },
  modules: modules.map(buildModule),
} satisfies CourseData;

export const projectBasedCodingCourseEntry: CourseEntry = {
  key: COURSE_ID,
  title: projectBasedCodingCourseData.title,
  data: projectBasedCodingCourseData,
  source: "local",
  status: "ready_for_review",
};
