import { LoaderCircle, RotateCcw } from "lucide-react";

export default function CourseLoadState({ error }: { error: boolean }) {
  return (
    <main id="main-content" className="learner-page-shell course-load-state" tabIndex={-1}>
      {error ? <>
        <h1>Courses couldn't be loaded</h1>
        <button className="learner-primary-link" type="button" onClick={() => window.location.reload()}><RotateCcw size={18} aria-hidden="true" />Try again</button>
      </> : <div role="status"><LoaderCircle size={24} aria-hidden="true" /><span>Loading courses</span></div>}
    </main>
  );
}
