"use client";

import { ArrowRight, FlaskConical, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { COURSE_CATALOG_PATH } from "../../utils/courseRouting";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import { practiceCatalog } from "../Practice/practiceEngine";
import { readSession, type PracticeSession } from "../Practice/practiceSession";
import "./practiceDirectory.css";

function PracticeDirectory() {
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<PracticeSession | null>(null);
  useEffect(() => { setSaved(readSession()); }, []);
  const filter = query.trim().toLowerCase();
  const skills = practiceCatalog.filter(skill => `${skill.category} ${skill.title}`.toLowerCase().includes(filter));
  const categories = Array.from(new Set(skills.map(skill => skill.category)));

  return <section className="practice-directory" aria-labelledby="practice-directory-title">
    <h2 id="practice-directory-title">What would you like to practice?</h2>
    {saved && (!saved.length || saved.index < saved.length) && <p>
      <Link className="learner-text-link" href="/tools/practice">Continue practicing <ArrowRight size={16} aria-hidden="true" /></Link>
      {" · "}{saved.skills[saved.index % saved.skills.length].title} · {saved.completed} solved
    </p>}
    <label className="practice-directory-search">
      <Search size={18} aria-hidden="true" />
      <input type="search" aria-label="Search subjects and skills" placeholder="Search subjects and skills" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    <div className="practice-directory-tiles">
      {categories.map(category => {
        const matches = skills.filter(skill => skill.category === category);
        return <details key={`${category}:${Boolean(filter)}`} open={filter ? true : undefined}>
          <summary>
            <FlaskConical size={23} aria-hidden="true" />
            <strong>{category}</strong>
            <small>{matches.length} {matches.length === 1 ? "skill" : "skills"}</small>
          </summary>
          <ul>
            {matches.map(skill => <li key={skill.id}>
              <Link href={`/tools/practice?skill=${encodeURIComponent(skill.id)}`}>{skill.title}<ArrowRight size={16} aria-hidden="true" /></Link>
            </li>)}
          </ul>
        </details>;
      })}
    </div>
    {categories.length === 0 && <p role="status">No matching subjects or skills.</p>}
  </section>;
}

const pageCopy = {
  practice: {
    title: "Practice",
    description: "Reinforce what you learn through exercises and projects.",
    emptyTitle: "No standalone practice yet",
    emptyDescription: "Open a course to find its practice activities and projects.",
  },
  assessments: {
    title: "Assessments",
    description: "Check your understanding and find what to review next.",
    emptyTitle: "No standalone assessments yet",
    emptyDescription: "Open a course to find its quizzes and assessments.",
  },
};

export default function ActivityLandingPage({ kind }: { kind: keyof typeof pageCopy }) {
  const { title, description, emptyTitle, emptyDescription } = pageCopy[kind];

  return (
    <div className="learner-page-shell">
      <main id="main-content" tabIndex={-1} className="learner-page-inner learner-directory-page">
        <header className="learner-directory-heading">
          <h1 className="learner-display-heading">{title}</h1>
          <p>{description}</p>
        </header>
        {kind === "practice" ? <PracticeDirectory /> : <section className="learner-directory-empty" aria-labelledby="activity-empty-title">
          <h2 id="activity-empty-title">{emptyTitle}</h2>
          <p>{emptyDescription}</p>
          <Link href={COURSE_CATALOG_PATH} className="learner-text-link">
            Browse courses <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>}
      </main>
      <CatalogFooter />
    </div>
  );
}
