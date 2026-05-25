import type { FullCourseModuleSpec } from "../fullCourseScaffold";

const c = (name: string, description: string) => ({ name, description });

export const introToPythonModuleSpecs: FullCourseModuleSpec[] = [
  {
    title: "Programming Environments and Computational Thinking",
    objective: "Use Python as a first programming language while developing precise habits for problem decomposition, execution, and debugging.",
    studio: "Set up a Python workspace, run scripts from the command line, and write a short program that transforms input into formatted output.",
    topics: [
      { title: "Programs and execution", description: "Students learn what a program is, how Python executes source code, and how to reason step by step about state changes.", concepts: [c("Program", "A sequence of instructions written for a computer to execute."), c("Interpreter", "A runtime that reads and executes Python code directly.")] },
      { title: "Development workflow", description: "Students practice editing, running, reading errors, and making small changes instead of treating code as a single fragile artifact.", concepts: [c("Script", "A Python file intended to be run as a program."), c("Terminal", "A text-based interface for running commands and programs.")] },
      { title: "Computational problem solving", description: "Students convert vague tasks into inputs, outputs, constraints, and ordered steps.", concepts: [c("Algorithm", "A finite step-by-step process for solving a problem."), c("Decomposition", "Breaking a larger problem into smaller parts that can be solved and tested separately.")] },
      { title: "Reading errors", description: "Students interpret tracebacks as useful diagnostic information and begin forming debugging hypotheses.", concepts: [c("Traceback", "Python's report showing where an error occurred and how execution reached that point."), c("Debugging", "The process of finding, explaining, and fixing incorrect program behavior.")] },
    ],
  },
  {
    title: "Values, Expressions, and Control Flow",
    objective: "Write programs that compute with values, make decisions, repeat work, and maintain readable control flow.",
    studio: "Build a command-line calculator or rules-based recommender that uses input, numeric expressions, conditionals, and loops.",
    topics: [
      { title: "Values and types", description: "Students use Python's core value types and understand why type determines available operations.", concepts: [c("Value", "A piece of data a program can store, compute with, or display."), c("Type", "A category of value that determines representation and allowed operations.")] },
      { title: "Variables and expressions", description: "Students assign names to values and combine operators, functions, and literals into expressions.", concepts: [c("Variable", "A name that refers to a value in program state."), c("Expression", "Code that evaluates to a value.")] },
      { title: "Conditionals", description: "Students use Boolean logic and if statements to choose behavior based on program state.", concepts: [c("Boolean expression", "An expression that evaluates to true or false."), c("Branch", "A path of execution chosen by a conditional statement.")] },
      { title: "Loops", description: "Students repeat work with for and while loops while avoiding off-by-one and infinite-loop errors.", concepts: [c("Iteration", "Repeated execution of a block of code."), c("Loop invariant", "A condition that should remain true before and after each loop iteration.")] },
    ],
  },
  {
    title: "Functions, Decomposition, and Testing",
    objective: "Design reusable functions with clear inputs, outputs, responsibilities, and tests.",
    studio: "Refactor a script into functions and create tests that cover normal cases, edge cases, and failure cases.",
    topics: [
      { title: "Function definitions", description: "Students define named procedures that accept parameters, return values, and isolate responsibilities.", concepts: [c("Function", "A reusable block of code that performs a defined task."), c("Parameter", "A named input a function expects when it is called.")] },
      { title: "Return values and scope", description: "Students distinguish printing from returning and learn how local names are isolated inside functions.", concepts: [c("Return value", "The value a function sends back to its caller."), c("Scope", "The region of code where a name can be accessed.")] },
      { title: "Functional decomposition", description: "Students split programs into testable pieces and identify when a function is doing too much.", concepts: [c("Single responsibility", "A design guideline that a function or component should have one clear reason to change."), c("Helper function", "A smaller function used by another function to keep logic organized.")] },
      { title: "Testing basics", description: "Students write assertions and basic automated tests to make behavior explicit and repeatable.", concepts: [c("Assertion", "A statement that checks whether an expected condition is true."), c("Unit test", "A small automated test focused on one function or behavior.")] },
    ],
  },
  {
    title: "Strings, Files, and Text Processing",
    objective: "Manipulate text data, parse files, and build programs that transform unstructured input into useful output.",
    studio: "Write a text-analysis tool that reads a file, cleans the data, counts patterns, and writes a short report.",
    topics: [
      { title: "String operations", description: "Students index, slice, search, split, join, and format strings as sequences of characters.", concepts: [c("String", "An ordered sequence of characters used to represent text."), c("Slice", "A subset of a sequence selected by start, stop, and optional step positions.")] },
      { title: "Text normalization", description: "Students prepare text by trimming, lowercasing, replacing, and validating string patterns.", concepts: [c("Normalization", "Transforming data into a consistent form before processing."), c("Delimiter", "A character or sequence used to separate fields in text.")] },
      { title: "File input and output", description: "Students open, read, write, and close files safely while understanding paths and encodings.", concepts: [c("File handle", "An object used by a program to read from or write to a file."), c("Path", "A location string that identifies a file or directory.")] },
      { title: "Structured text formats", description: "Students read CSV and JSON data and identify why structured formats reduce parsing ambiguity.", concepts: [c("CSV", "A tabular text format where rows and fields are separated by delimiters."), c("JSON", "A text format for representing nested data with objects, arrays, strings, numbers, and booleans.")] },
    ],
  },
  {
    title: "Lists, Tuples, and Iteration",
    objective: "Use sequence data structures to store ordered collections and write clear iteration over collections.",
    studio: "Build a gradebook or inventory program that stores records in lists, computes summaries, and reports sorted results.",
    topics: [
      { title: "Lists", description: "Students create, mutate, index, append, remove, and traverse lists as dynamic ordered collections.", concepts: [c("List", "A mutable ordered collection of values."), c("Index", "A numeric position used to access an element in a sequence.")] },
      { title: "Tuples and unpacking", description: "Students use tuples for fixed collections and unpack values to clarify structure.", concepts: [c("Tuple", "An immutable ordered collection of values."), c("Unpacking", "Assigning multiple values from a collection to multiple names in one statement.")] },
      { title: "Iteration patterns", description: "Students compare direct iteration, indexing, enumeration, accumulation, filtering, and transformation.", concepts: [c("Accumulator", "A variable updated repeatedly to build a result across iterations."), c("Enumeration", "Iteration that provides both an element and its position.")] },
      { title: "List comprehensions", description: "Students use concise collection transformations while recognizing when explicit loops are clearer.", concepts: [c("Comprehension", "A compact expression for building a collection from another iterable."), c("Predicate", "A true-or-false condition used to filter values.")] },
    ],
  },
  {
    title: "Dictionaries, Sets, and Structured Data",
    objective: "Represent keyed, unique, and nested data using dictionaries, sets, and combinations of core collections.",
    studio: "Create a contact, catalog, or survey-analysis program using dictionaries and sets to organize records and relationships.",
    topics: [
      { title: "Dictionaries", description: "Students use key-value mapping for lookup, grouping, counting, and structured records.", concepts: [c("Dictionary", "A mutable collection that maps keys to values."), c("Key", "A value used to look up an associated value in a mapping.")] },
      { title: "Sets", description: "Students represent uniqueness and membership while using union, intersection, and difference operations.", concepts: [c("Set", "An unordered collection of unique values."), c("Membership test", "A check for whether a value belongs to a collection.")] },
      { title: "Nested structures", description: "Students combine lists and dictionaries to model real records and learn to traverse nested data safely.", concepts: [c("Nested data", "Data structures stored inside other data structures."), c("Record", "A group of related fields describing one entity or observation.")] },
      { title: "Data modeling choices", description: "Students choose collections based on lookup needs, ordering, uniqueness, mutation, and readability.", concepts: [c("Data model", "A chosen structure for representing the entities and relationships in a problem."), c("Lookup", "Retrieving a value from a collection using a key, index, or condition.")] },
    ],
  },
  {
    title: "Errors, Debugging, and Exceptions",
    objective: "Anticipate failures, use exceptions responsibly, and debug programs with evidence rather than guesswork.",
    studio: "Harden a file-processing program by adding validation, exception handling, logging, and a debugging write-up.",
    topics: [
      { title: "Error categories", description: "Students distinguish syntax errors, runtime errors, logic errors, and environmental errors.", concepts: [c("Syntax error", "An error caused by code that violates the language grammar."), c("Logic error", "A program behavior that runs but produces an incorrect result.")] },
      { title: "Exception handling", description: "Students use try, except, else, and finally blocks to recover from expected failures without hiding bugs.", concepts: [c("Exception", "A runtime signal that normal execution cannot continue in the current path."), c("Exception handler", "Code that catches and responds to a specific class of exception.")] },
      { title: "Input validation", description: "Students check assumptions about user input, files, and data before using values in fragile operations.", concepts: [c("Validation", "Checking whether input meets required format, type, range, or business rules."), c("Precondition", "A condition that must be true before code can safely execute.")] },
      { title: "Debugging strategy", description: "Students isolate faults with small experiments, print/log statements, breakpoints, and minimal reproducible cases.", concepts: [c("Breakpoint", "A marker that pauses program execution so state can be inspected."), c("Minimal reproducible example", "The smallest version of a problem that still demonstrates the bug.")] },
    ],
  },
  {
    title: "Modules, Packages, and Environments",
    objective: "Organize Python projects into modules, use libraries safely, and manage environments for reproducible work.",
    studio: "Convert a single script into a small package-like project with imports, dependencies, configuration, and a README.",
    topics: [
      { title: "Imports and modules", description: "Students split code across files and use imports to reuse definitions without circular confusion.", concepts: [c("Module", "A Python file that can define functions, classes, and values for reuse."), c("Import", "A statement that makes names from another module available.")] },
      { title: "Standard library", description: "Students solve common problems with built-in modules for dates, paths, randomness, math, and command-line arguments.", concepts: [c("Standard library", "The collection of modules included with Python installations."), c("API", "A documented interface that describes how code can be used by other code.")] },
      { title: "Third-party packages", description: "Students install and use external packages while learning dependency risk and documentation habits.", concepts: [c("Package", "A distributable collection of Python modules."), c("Dependency", "External code or a library that a project needs to run.")] },
      { title: "Virtual environments", description: "Students isolate dependencies per project and document environment setup.", concepts: [c("Virtual environment", "An isolated Python environment with its own installed packages."), c("Reproducibility", "The ability to recreate a working project setup and behavior reliably.")] },
    ],
  },
  {
    title: "Object-Oriented Programming",
    objective: "Use classes and objects to model stateful concepts while maintaining clear interfaces and responsibilities.",
    studio: "Design a small object model for a library, game, bank account, or simulation and test the public behavior of the classes.",
    topics: [
      { title: "Classes and instances", description: "Students define classes, instantiate objects, and understand attributes as object state.", concepts: [c("Class", "A blueprint defining the data and behavior shared by a kind of object."), c("Instance", "A specific object created from a class.")] },
      { title: "Methods and encapsulation", description: "Students place behavior with the data it manages and expose safe operations through methods.", concepts: [c("Method", "A function associated with a class or object."), c("Encapsulation", "Bundling state with behavior while controlling how other code interacts with it.")] },
      { title: "Composition and inheritance", description: "Students compare building objects from other objects with reusing behavior through class hierarchies.", concepts: [c("Composition", "Designing an object to contain and delegate to other objects."), c("Inheritance", "Defining a class in terms of another class so it reuses or specializes behavior.")] },
      { title: "Object design tradeoffs", description: "Students avoid overusing classes and choose procedural, functional, or object-oriented styles based on the problem.", concepts: [c("Interface", "The set of operations other code can use without depending on implementation details."), c("Coupling", "The degree to which code pieces depend on each other's details.")] },
    ],
  },
  {
    title: "Data Analysis with Python",
    objective: "Use Python to clean, summarize, visualize, and reason about tabular data while recognizing data-quality limits.",
    studio: "Analyze a small public dataset, produce summary statistics and charts, and explain data-quality concerns.",
    topics: [
      { title: "Tabular data", description: "Students represent rows, columns, fields, and observations and load data from CSV or JSON files.", concepts: [c("Dataframe", "A table-like data structure with labeled rows and columns."), c("Observation", "One recorded case, row, event, or item in a dataset.")] },
      { title: "Cleaning and transformation", description: "Students handle missing values, inconsistent formats, derived columns, filtering, and grouping.", concepts: [c("Missing value", "A data field where an expected value is absent or unknown."), c("Transformation", "A change to data shape, type, scale, or representation to make analysis possible.")] },
      { title: "Summary statistics", description: "Students compute counts, means, medians, ranges, distributions, and grouped summaries.", concepts: [c("Distribution", "The pattern of values and frequencies in a dataset."), c("Aggregate", "A summary value computed from multiple records.")] },
      { title: "Visualization", description: "Students choose charts that match the question and avoid misleading visual encodings.", concepts: [c("Chart encoding", "The mapping from data values to visual properties such as position, length, color, or shape."), c("Outlier", "A value that is unusually far from the rest of the data and may require explanation.")] },
    ],
  },
  {
    title: "Web APIs and Automation",
    objective: "Write Python programs that interact with web services, automate workflows, and handle external data responsibly.",
    studio: "Build a script that calls a public API, validates responses, caches data, and reports useful results.",
    topics: [
      { title: "HTTP requests", description: "Students use Python libraries to make web requests and understand URLs, methods, status codes, and responses.", concepts: [c("HTTP request", "A message sent from a client to a server asking for a resource or action."), c("Status code", "A numeric HTTP response indicator describing success, redirection, client error, or server error.")] },
      { title: "API responses", description: "Students parse JSON responses, check schemas, and handle missing or unexpected fields.", concepts: [c("Response body", "The data returned by a server in response to a request."), c("Schema", "A description of expected data fields, types, and structure.")] },
      { title: "Automation scripts", description: "Students identify repetitive tasks that can be safely automated and add guardrails before changing files or services.", concepts: [c("Automation", "Using software to perform a repeated task with limited manual intervention."), c("Idempotence", "A property where repeating an operation produces the same end state without unwanted side effects.")] },
      { title: "Rate limits and ethics", description: "Students respect service limits, terms, robots policies, privacy, and data ownership when automating online work.", concepts: [c("Rate limit", "A restriction on how many requests can be made in a period of time."), c("Consent", "Permission or authorization to collect, use, or process data.")] },
    ],
  },
  {
    title: "Algorithms and Complexity Basics",
    objective: "Analyze simple algorithms by correctness, clarity, and rough growth of time and memory as input size changes.",
    studio: "Compare two implementations of search or sorting on increasing input sizes and explain the observed tradeoffs.",
    topics: [
      { title: "Algorithmic reasoning", description: "Students reason about why code works for all relevant inputs rather than only examples.", concepts: [c("Correctness", "The property that an algorithm produces the intended result for valid inputs."), c("Edge case", "An unusual or boundary input that can reveal hidden assumptions.")] },
      { title: "Searching and sorting", description: "Students implement and compare basic search and sorting strategies.", concepts: [c("Linear search", "A search method that checks elements one at a time until the target is found or the list ends."), c("Sorting", "Rearranging values into a defined order.")] },
      { title: "Complexity intuition", description: "Students use input size, loops, nesting, and data structure operations to estimate growth.", concepts: [c("Time complexity", "A rough description of how runtime grows as input size grows."), c("Space complexity", "A rough description of how memory use grows as input size grows.")] },
      { title: "Data structure tradeoffs", description: "Students choose lists, dictionaries, sets, and custom structures based on operation costs and readability.", concepts: [c("Operation cost", "The time or memory required to perform a data structure operation."), c("Tradeoff", "A design choice where improving one property may worsen another.")] },
    ],
  },
  {
    title: "Software Engineering with Python",
    objective: "Practice maintainable project structure, version control habits, documentation, reviewability, and quality gates.",
    studio: "Prepare a small Python project for peer review with tests, documentation, dependency notes, and clear command-line usage.",
    topics: [
      { title: "Project organization", description: "Students structure files and folders so code, tests, docs, and data have clear homes.", concepts: [c("Repository", "A version-controlled project directory containing code and related assets."), c("Project structure", "The arrangement of files and folders that supports development, testing, and use.")] },
      { title: "Version control", description: "Students use commits as meaningful change records and learn how history supports collaboration.", concepts: [c("Commit", "A recorded snapshot of changes in a version-control system."), c("Diff", "A comparison showing what changed between versions of files.")] },
      { title: "Documentation", description: "Students write README files, comments, docstrings, and usage examples for future users and maintainers.", concepts: [c("Docstring", "A string in code that documents a module, class, or function."), c("README", "A project document that explains purpose, setup, usage, and important context.")] },
      { title: "Quality checks", description: "Students use formatting, linting, tests, and review to catch issues before release.", concepts: [c("Linting", "Static analysis that flags style, correctness, or maintainability issues."), c("Code review", "A structured examination of changes by another person before integration.")] },
    ],
  },
  {
    title: "Final Project Studio",
    objective: "Synthesize Python fundamentals into a complete, documented, tested project that solves a real problem.",
    studio: "Design, implement, test, and present a Python project with clear requirements, data handling, user interaction, and reflection on tradeoffs.",
    topics: [
      { title: "Project proposal", description: "Students define a feasible project goal, users, requirements, data sources, risks, and milestones.", concepts: [c("Requirement", "A statement of what a program must do or satisfy."), c("Milestone", "A meaningful checkpoint used to plan and evaluate project progress.")] },
      { title: "Implementation plan", description: "Students decompose work into modules, functions, data models, tests, and integration steps.", concepts: [c("Integration", "Combining parts of a program so they work together as one system."), c("Work breakdown", "A decomposition of project work into smaller tasks.")] },
      { title: "Testing and refinement", description: "Students test project behavior, fix defects, simplify code, and improve user experience.", concepts: [c("Regression", "A bug where previously working behavior breaks after a change."), c("Refactoring", "Improving code structure without intentionally changing external behavior.")] },
      { title: "Presentation and reflection", description: "Students explain what they built, how it works, what tradeoffs they made, and what they would improve next.", concepts: [c("Technical demo", "A presentation that shows software behavior and explains key implementation decisions."), c("Reflection", "A written or spoken analysis of learning, choices, evidence, and next steps.")] },
    ],
  },
];
