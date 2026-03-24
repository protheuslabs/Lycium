# Overview

Lyceum is a lightweight learning platform designed to explore how structured JSON data can dynamically drive an interactive front-end application. My goal in building this software was to strengthen my skills as a software engineer by working with component-based UI structure, state management, and and data-driven rendering in React. I wanted to create a modular system where lessons, videos, quizzes, and code examples could be added without touching the core UI logic.

This repository is now organized as a monorepo:

- `apps/lyceum-web` contains the learner-facing web application.
- `services/protheus-api` contains the FastAPI control plane for ingestion, retrieval, course generation, analytics, and catalogs.
- `services/protheus-workers` contains async worker runners for queued ingestion, coverage, generation, and revalidation jobs.
- `packages/*` contains shared contracts, schema, and package stubs for the platform split.

## Current Implementation Status

The backend now includes end-to-end implementations for:

- source ingestion and canonicalization
- knowledge-object decomposition and claim extraction
- trust/freshness/pedagogy/accessibility scoring
- coverage map generation
- hybrid retrieval and modality-balanced learning packets
- prompt-to-outline draft workflow with approve/edit
- full course JSON generation with citations and generation trace
- course section regeneration, forking, and refresh
- learner progress persistence and analytics summaries
- portfolio artifacts, credential records, and program path snapshots
- queue-based job orchestration and worker execution loop

## Running Backend Services

From `services/protheus-api`:

`pip3 install -e '.[test]'`
`protheus-api`

From `services/protheus-workers` (with API running):

`pip3 install -e '.[test]'`
`PROTHEUS_API_URL=http://127.0.0.1:8000 protheus-worker --once`

Run tests:

- API: `cd services/protheus-api && pytest -q`
- Worker: `cd services/protheus-workers && PYTHONPATH=src pytest -q`

The current Lyceum frontend still loads all course content—including modules, sections, text blocks, videos, quizzes, and code examples—from JSON files. React then renders the learning experience dynamically based on user input and navigation.

To run the application locally:
`pnpm install`
`pnpm dev`

Then open the URL that Vite provides from `apps/lyceum-web` to launch the app in your browser.

This project helped me practice designing reusable components, building interactive UI elements, and structuring a scalable front-end architecture that could evolve into a more advanced learning system in the future.

Long-term, Lyceum is intended to move beyond hard-coded courses and become a system that can turn reliable internet knowledge into personalized, structured learning paths.

[Product Vision](./VISION.md)
[Architecture](./ARCHITECTURE.md)
[Software Requirements Specification](./SRS.md)

[Software Demo Video](https://youtu.be/FjGd8ojGa14)

# Web Pages

Although the project uses a single-page React architecture, it functions like a multi-page application through dynamic rendering. I also included 3 sample courses.

## Main Interface

This interface contains several dynamically generated sections:

### Sidebar Navigation
- Displays module headers and automatically numbered sections  
- Highlights the currently active section  
- Updates when the user selects a different course  
- Clicking any section updates the content view dynamically  

### Content View
Displays learning material for the selected section. The content is fully JSON-driven and may include:

- Text content  
- Embedded videos (with a loading indicator)  
- Interactive quizzes (single or multiple choice, includes submit/try again logic)  
- Code examples rendered in formatted `<pre><code>` blocks  

Users can navigate between sections using the sidebar or the built-in “Next” and “Previous” buttons. Course switching also triggers dynamic page updates.

---

# Development Environment

For development, I used:

- Visual Studio Code
- Replit (only for the IDE when I wasn't on my main machine)
- React with functional components and hooks  
- Vite as the build tool and development server  
- JavaScript / JSX for front-end logic  
- CSS for custom component styling  
- JSON files to store course/module/section structures  

React was selected because of its component-driven architecture and ease of rendering dynamic UI based on structured data.

---

# Useful Websites

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [MDN Web Docs – JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [W3Schools HTML & CSS Reference](https://www.w3schools.com/)

---

# Future Work

- Add progress tracking using localStorage or a backend  
- Expand code blocks with real syntax highlighting  
- Create a dedicated “Course List” page for improved navigation  
- Improve mobile responsiveness and make the sidebar collapsible  
- Add more content types (interactive diagrams, drag-and-drop activities, etc.)  
- Build a course-creation interface to generate JSON programmatically  
