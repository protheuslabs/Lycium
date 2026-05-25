import type { FullCourseModuleSpec } from "../fullCourseScaffold";

const c = (name: string, description: string) => ({ name, description });

export const webDevModuleSpecs: FullCourseModuleSpec[] = [
  {
    title: "Web Platform and Internet Architecture",
    objective: "Explain how browsers, servers, URLs, HTTP, DNS, and files combine to deliver web experiences.",
    studio: "Trace a webpage request from URL entry to rendered page, then diagram the browser, network, server, and asset interactions.",
    topics: [
      { title: "The web as a platform", description: "Students define the web as an open document, application, and network platform with shared standards.", concepts: [c("Web platform", "The collection of browser technologies and standards used to build websites and web applications."), c("User agent", "Software, usually a browser, that requests, interprets, and presents web content.")] },
      { title: "URLs and DNS", description: "Students parse URLs and explain how names become network locations.", concepts: [c("URL", "An address that identifies a web resource and how to access it."), c("DNS", "The naming system that maps human-readable domain names to network addresses.")] },
      { title: "HTTP request lifecycle", description: "Students connect requests, responses, headers, methods, status codes, and caching to page behavior.", concepts: [c("HTTP", "The protocol used by clients and servers to exchange web requests and responses."), c("Status code", "A numeric indicator describing the result of an HTTP response.")] },
      { title: "Static and dynamic sites", description: "Students compare static files with server-generated and client-rendered applications.", concepts: [c("Static site", "A site served as prebuilt files that do not require server-side rendering per request."), c("Client-side rendering", "Rendering interface content in the browser with JavaScript after initial load.")] },
    ],
  },
  {
    title: "HTML Semantics and Document Structure",
    objective: "Author semantic HTML documents that express content structure, meaning, navigation, and accessibility.",
    studio: "Build a multipage informational site with semantic regions, headings, links, media, and accessible document structure.",
    topics: [
      { title: "Document anatomy", description: "Students use doctype, html, head, body, metadata, headings, paragraphs, lists, and links to structure documents.", concepts: [c("HTML", "A markup language used to describe the structure and meaning of web documents."), c("Element", "A markup unit made of a tag, content, and sometimes attributes.")] },
      { title: "Semantic regions", description: "Students choose elements such as header, nav, main, section, article, aside, and footer based on meaning.", concepts: [c("Semantic HTML", "HTML that uses elements according to their meaning rather than only their default appearance."), c("Landmark", "A meaningful page region that assists navigation for browsers and assistive technologies.")] },
      { title: "Links, media, and assets", description: "Students add internal links, external links, images, alt text, and embedded media responsibly.", concepts: [c("Hyperlink", "An interactive reference from one resource to another."), c("Alternative text", "Text that communicates the purpose or content of an image to users who cannot see it.")] },
      { title: "Forms as documents", description: "Students build simple forms with labels, inputs, fieldsets, validation attributes, and accessible names.", concepts: [c("Form control", "An interactive element used to collect user input."), c("Accessible name", "The text label assistive technologies use to identify an interface element.")] },
    ],
  },
  {
    title: "CSS Styling, Layout, and Responsive Design",
    objective: "Use CSS selectors, cascade, layout systems, and media queries to create responsive, maintainable interfaces.",
    studio: "Style the informational site into a responsive layout with typography, spacing, cards, navigation, and mobile breakpoints.",
    topics: [
      { title: "Selectors and cascade", description: "Students write selectors and reason about inheritance, specificity, source order, and custom properties.", concepts: [c("Selector", "A CSS pattern that targets elements for styling."), c("Specificity", "A weight that helps determine which CSS rule applies when rules conflict.")] },
      { title: "Box model and spacing", description: "Students control content, padding, border, margin, sizing, and overflow deliberately.", concepts: [c("Box model", "The CSS model that treats elements as boxes with content, padding, border, and margin."), c("Overflow", "What happens when content exceeds the space allocated to an element.")] },
      { title: "Flexbox and grid", description: "Students choose one-dimensional and two-dimensional layout systems for navigation, cards, galleries, and page regions.", concepts: [c("Flexbox", "A CSS layout system for distributing space along one primary axis."), c("CSS Grid", "A CSS layout system for rows and columns in two dimensions.")] },
      { title: "Responsive design", description: "Students use fluid sizing, breakpoints, and mobile-first design to adapt layouts across devices.", concepts: [c("Media query", "A CSS condition that applies styles based on features such as viewport width."), c("Breakpoint", "A viewport size where layout or styling changes to fit the available space.")] },
    ],
  },
  {
    title: "JavaScript Fundamentals for the Browser",
    objective: "Use JavaScript values, functions, control flow, objects, and modules to add behavior to web pages.",
    studio: "Add interactive behavior to a static page using functions, events, object data, and browser console debugging.",
    topics: [
      { title: "JavaScript execution", description: "Students understand where browser JavaScript runs and how scripts interact with the loaded document.", concepts: [c("JavaScript", "A programming language used to add behavior to web pages and many other software environments."), c("Runtime", "The environment that executes code and provides available APIs.")] },
      { title: "Values and control flow", description: "Students use variables, types, conditionals, loops, and expressions in browser-oriented tasks.", concepts: [c("Variable", "A named reference to a value in program state."), c("Control flow", "The order in which program statements execute.")] },
      { title: "Functions and objects", description: "Students organize behavior with functions and represent structured data with objects and arrays.", concepts: [c("Function", "A reusable unit of behavior that can accept inputs and return output."), c("Object", "A collection of named properties used to represent structured data or behavior.")] },
      { title: "Modules and scripts", description: "Students connect JavaScript files to pages and learn the difference between classic scripts and modules.", concepts: [c("Script", "A JavaScript file or inline block loaded by a web page."), c("Module", "A JavaScript file that can import and export bindings.")] },
    ],
  },
  {
    title: "DOM, Events, and State",
    objective: "Build interactive browser interfaces by manipulating the DOM, responding to events, and managing UI state.",
    studio: "Create a task list, quiz widget, or filterable gallery that updates the page without reloading.",
    topics: [
      { title: "DOM tree", description: "Students use the DOM as the browser's live object representation of the document.", concepts: [c("DOM", "The document object model representing page structure as programmable nodes."), c("Node", "An object in the DOM tree representing an element, text, document, or other structure.")] },
      { title: "Selecting and changing elements", description: "Students query elements, change text, classes, attributes, and create or remove nodes.", concepts: [c("Query selector", "A browser method for finding elements using CSS selector syntax."), c("Class toggle", "Adding or removing a CSS class to change element state or appearance.")] },
      { title: "Events", description: "Students listen for clicks, input, submits, keyboard actions, and page lifecycle events.", concepts: [c("Event", "A browser signal that something happened, such as a click, input change, or form submission."), c("Event listener", "A function registered to run when a matching event occurs.")] },
      { title: "UI state", description: "Students track data that drives the interface and update the DOM from state changes.", concepts: [c("State", "Data that represents the current condition of an interface or application."), c("Render", "The process of translating data or state into visible interface output.")] },
    ],
  },
  {
    title: "Accessibility and Inclusive UX",
    objective: "Design and test web interfaces that are usable by people with diverse abilities, devices, and contexts.",
    studio: "Audit and improve a page for keyboard navigation, semantic structure, contrast, labels, focus states, and error messages.",
    topics: [
      { title: "Accessibility foundations", description: "Students connect disability, assistive technology, standards, and inclusive design to everyday frontend decisions.", concepts: [c("Accessibility", "The practice of making digital products usable by people with a wide range of abilities and technologies."), c("Assistive technology", "Software or hardware that helps people interact with digital systems.")] },
      { title: "Keyboard and focus", description: "Students ensure interactive controls can be reached, understood, and operated without a mouse.", concepts: [c("Focus order", "The sequence in which interactive elements receive keyboard focus."), c("Focus indicator", "A visible cue showing which element is currently active for keyboard input.")] },
      { title: "ARIA and semantics", description: "Students learn when native HTML is enough and when ARIA can provide missing accessibility semantics.", concepts: [c("ARIA", "Attributes that can add accessibility semantics when native HTML cannot express them."), c("Role", "An accessibility semantic that communicates what kind of interface element something is.")] },
      { title: "Usable feedback", description: "Students design clear labels, instructions, validation messages, and error recovery for many users and contexts.", concepts: [c("Error message", "Interface text that explains what went wrong and how to correct it."), c("Inclusive design", "Design that accounts for human diversity from the beginning rather than treating access as an add-on.")] },
    ],
  },
  {
    title: "Forms, Validation, and Browser Storage",
    objective: "Collect user input safely and persist client-side state using forms, validation, and browser storage APIs.",
    studio: "Build a profile, survey, or settings form with validation, accessible errors, and saved local preferences.",
    topics: [
      { title: "Form architecture", description: "Students group inputs, labels, controls, and submit behavior into coherent form experiences.", concepts: [c("Label", "Text programmatically associated with a form control."), c("Submit event", "An event fired when a form is submitted.")] },
      { title: "Client-side validation", description: "Students use built-in validation and custom validation without relying on it as the only security layer.", concepts: [c("Constraint validation", "Browser-supported checks for form requirements such as required fields and valid formats."), c("Validation state", "Information about whether input currently satisfies expected constraints.")] },
      { title: "Local storage", description: "Students save small client-side values and understand persistence, serialization, and privacy concerns.", concepts: [c("LocalStorage", "A browser key-value storage API that persists across sessions."), c("Serialization", "Converting data into a string or transferable format for storage or transmission.")] },
      { title: "Input security basics", description: "Students recognize that all client input is untrusted and must be validated again on the server when relevant.", concepts: [c("Untrusted input", "Data supplied by users or external systems that must be checked before use."), c("Sanitization", "Cleaning or transforming input to reduce harmful or invalid content.")] },
    ],
  },
  {
    title: "HTTP APIs and Asynchronous JavaScript",
    objective: "Fetch data from APIs, handle asynchronous work, and render loading, success, and error states.",
    studio: "Create a searchable interface backed by a public API or mock API with loading indicators and resilient error handling.",
    topics: [
      { title: "Promises and async flow", description: "Students use promises, async functions, await, and error handling to manage work that finishes later.", concepts: [c("Promise", "A JavaScript object representing a future success or failure value."), c("Async function", "A function that returns a promise and can use await for asynchronous operations.")] },
      { title: "Fetch API", description: "Students make requests, parse JSON, check response status, and handle network failures.", concepts: [c("Fetch", "A browser API for making HTTP requests from JavaScript."), c("JSON parsing", "Converting JSON text into JavaScript values.")] },
      { title: "API-driven rendering", description: "Students render interface state from remote data and handle empty, loading, error, and stale states.", concepts: [c("Loading state", "An interface state shown while data or work is still pending."), c("Error state", "An interface state that tells users something failed and what they can do next.")] },
      { title: "Data contracts", description: "Students treat API shape as a contract and protect the UI from malformed or changed responses.", concepts: [c("API contract", "The agreed shape, behavior, and expectations of an interface between systems."), c("Defensive rendering", "UI logic that handles missing, unexpected, or partial data safely.")] },
    ],
  },
  {
    title: "Tooling, Modules, and Build Workflows",
    objective: "Use modern frontend tooling to organize code, manage dependencies, bundle assets, and run quality checks.",
    studio: "Set up a small frontend project with modules, package scripts, dependency documentation, formatting, linting, and a production build.",
    topics: [
      { title: "Package management", description: "Students install dependencies, read package metadata, and understand lockfiles and scripts.", concepts: [c("Package manager", "A tool that installs dependencies and runs project scripts."), c("Lockfile", "A file that records exact dependency versions for reproducible installs.")] },
      { title: "Modules and bundling", description: "Students understand imports, exports, dependency graphs, and why bundlers transform source files.", concepts: [c("Bundler", "A tool that combines and transforms source modules and assets for browser delivery."), c("Dependency graph", "A network of files and packages connected by import or dependency relationships.")] },
      { title: "Development servers", description: "Students use local servers, hot reload, environment variables, and build previews.", concepts: [c("Development server", "A local server optimized for rapid editing and browser feedback."), c("Hot reload", "Updating a running page after code changes without a full manual refresh.")] },
      { title: "Quality automation", description: "Students add formatters, linters, and scripts that make project quality repeatable.", concepts: [c("Formatter", "A tool that rewrites code layout according to consistent style rules."), c("NPM script", "A named command defined in package metadata for common project tasks.")] },
    ],
  },
  {
    title: "Frontend Application Architecture",
    objective: "Structure larger frontend applications with components, routing, state boundaries, and predictable data flow.",
    studio: "Refactor an interactive page into component-like modules with clear responsibilities, route-like views, and shared state rules.",
    topics: [
      { title: "Components", description: "Students divide interfaces into reusable, testable pieces with inputs, outputs, and local behavior.", concepts: [c("Component", "A reusable interface unit with a defined responsibility and rendering behavior."), c("Props", "Inputs passed into a component to configure its output or behavior.")] },
      { title: "Routing and navigation", description: "Students explain how applications map URLs to screens and preserve shareable state.", concepts: [c("Route", "A mapping between a URL pattern and the interface shown for it."), c("Deep link", "A URL that opens a specific application state or page directly.")] },
      { title: "State management", description: "Students decide where state should live and how updates should flow through an interface.", concepts: [c("Shared state", "State used by multiple interface regions or components."), c("Derived state", "Data computed from other state rather than stored independently.")] },
      { title: "Architecture tradeoffs", description: "Students compare simple scripts, component libraries, frameworks, and server-rendered approaches based on project needs.", concepts: [c("Framework", "A software structure that supplies conventions and tools for building applications."), c("Architecture tradeoff", "A decision where benefits in one area create costs or constraints in another.")] },
    ],
  },
  {
    title: "Backend Foundations for Web Apps",
    objective: "Explain the server-side responsibilities that support web applications, including routing, validation, persistence, and authentication entry points.",
    studio: "Design a minimal backend API contract for a frontend feature, including endpoints, request data, response shape, errors, and persistence needs.",
    topics: [
      { title: "Server responsibilities", description: "Students distinguish frontend concerns from server concerns and describe request handling at a high level.", concepts: [c("Server", "Software that receives requests and returns responses or performs backend work."), c("Endpoint", "A specific API route that accepts requests for a defined resource or action.")] },
      { title: "Request routing", description: "Students map methods and paths to handlers and understand parameters, query strings, and bodies.", concepts: [c("Route handler", "Server code that responds to a matched request route."), c("Request body", "Data sent by a client as part of an HTTP request.")] },
      { title: "Validation and errors", description: "Students describe server-side validation, error responses, and why frontend validation is not enough.", concepts: [c("Server validation", "Checks performed by backend code before accepting or processing input."), c("Error response", "A structured response describing why a request failed.")] },
      { title: "Backend integration", description: "Students design frontend/back-end boundaries that support maintainability and future changes.", concepts: [c("Service boundary", "A separation between responsibilities owned by different parts of a system."), c("Contract testing", "Testing that checks whether two systems agree on an interface.")] },
    ],
  },
  {
    title: "Databases, Auth, and Security Basics",
    objective: "Understand how web applications store data, identify users, protect sessions, and defend against common vulnerabilities.",
    studio: "Model a secure notes, forum, or course app with entities, permissions, authentication flow, and basic threat analysis.",
    topics: [
      { title: "Data modeling", description: "Students identify entities, fields, relationships, and constraints for web application data.", concepts: [c("Entity", "A thing or concept represented in stored application data."), c("Relationship", "An association between entities, such as one-to-many or many-to-many.")] },
      { title: "Authentication and sessions", description: "Students distinguish identity, login, session persistence, and account recovery from authorization.", concepts: [c("Authentication", "The process of verifying who a user or system is."), c("Session", "State that lets a server or application remember an authenticated interaction over time.")] },
      { title: "Authorization", description: "Students define permissions and access rules based on roles, ownership, and actions.", concepts: [c("Authorization", "The process of deciding what an authenticated user or system is allowed to do."), c("Role", "A named permission grouping assigned to users or accounts.")] },
      { title: "Common web vulnerabilities", description: "Students recognize injection, cross-site scripting, cross-site request forgery, weak secrets, and insecure direct object references.", concepts: [c("Cross-site scripting", "A vulnerability where attacker-controlled script runs in another user's browser context."), c("Injection", "A vulnerability where untrusted input is interpreted as code or commands.")] },
    ],
  },
  {
    title: "Testing, Performance, and Deployment",
    objective: "Prepare web applications for release with tests, performance budgets, deployment workflows, and monitoring habits.",
    studio: "Take a project through a release checklist: tests, accessibility checks, performance audit, build, deployment plan, and rollback notes.",
    topics: [
      { title: "Frontend testing", description: "Students compare unit, component, integration, accessibility, and end-to-end testing for web interfaces.", concepts: [c("End-to-end test", "A test that exercises a user flow through the application as a browser would."), c("Test fixture", "Prepared data or setup used to make a test repeatable.")] },
      { title: "Performance", description: "Students measure load, responsiveness, asset size, rendering cost, and network behavior.", concepts: [c("Performance budget", "A defined limit for metrics such as bundle size, load time, or interaction latency."), c("Lazy loading", "Deferring resource loading until it is needed.")] },
      { title: "Deployment", description: "Students describe build artifacts, hosting, environment variables, domains, and release verification.", concepts: [c("Deployment", "The process of making an application available in a target environment."), c("Environment variable", "Configuration supplied outside source code for a specific runtime environment.")] },
      { title: "Monitoring and maintenance", description: "Students plan error reporting, uptime checks, dependency updates, and user feedback loops.", concepts: [c("Monitoring", "Collecting signals about system health, errors, usage, or performance after release."), c("Maintenance", "Ongoing work to keep software secure, useful, compatible, and reliable.")] },
    ],
  },
  {
    title: "Full-Stack Capstone Studio",
    objective: "Synthesize web fundamentals into a complete, accessible, responsive, and source-controlled web application project.",
    studio: "Build and present a capstone web app with semantic HTML, responsive CSS, interactive JavaScript, API integration, validation, testing notes, and deployment evidence.",
    topics: [
      { title: "Capstone scope", description: "Students define a realistic web application idea with users, goals, constraints, success criteria, and risks.", concepts: [c("Scope", "The boundary of what a project will and will not include."), c("Success criterion", "A measurable condition used to judge whether a project goal has been met.")] },
      { title: "Implementation plan", description: "Students divide work into pages, components, data contracts, styles, interactions, and release tasks.", concepts: [c("Milestone", "A project checkpoint with defined deliverables."), c("Task breakdown", "A list of smaller work items that together complete a larger project.")] },
      { title: "Peer review and iteration", description: "Students use feedback to improve usability, accessibility, code structure, and reliability.", concepts: [c("Peer review", "A structured review of work by classmates or teammates."), c("Iteration", "A cycle of improvement based on testing, feedback, or new evidence.")] },
      { title: "Final demo and reflection", description: "Students present the project, explain design choices, document limitations, and propose future improvements.", concepts: [c("Demo", "A live or recorded walkthrough showing how software works."), c("Retrospective", "A reflection on what went well, what was difficult, and what should change next time.")] },
    ],
  },
];
