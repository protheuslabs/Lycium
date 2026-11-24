import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { COURSE_CATALOG_PATH } from "../../utils/courseRouting";
import CatalogFooter from "../CatalogFooter/CatalogFooter";

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
        <section className="learner-directory-empty" aria-labelledby="activity-empty-title">
          <h2 id="activity-empty-title">{emptyTitle}</h2>
          <p>{emptyDescription}</p>
          <Link href={COURSE_CATALOG_PATH} className="learner-text-link">
            Browse courses <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <CatalogFooter />
    </div>
  );
}
