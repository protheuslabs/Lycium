import SourceSuggestionButton from "../CourseFeedback/SourceSuggestionButton";
import type { SourceRecord } from "./contentViewTypes";
import type { CourseSourceIndex } from "./sourceCitationUtils";
import { isExternalSourceUrl, sourceCitationNumber, sourceRecordMeta } from "./sourceCitationUtils";
import Link from "next/link";
import { getCoursePath } from "../../utils/courseRouting";

type CourseSourcesPageProps = {
  courseKey: string;
  courseTitle: string;
  sources: SourceRecord[];
  courseSourceIndex: CourseSourceIndex;
};

export default function CourseSourcesPage({ courseKey, courseTitle, sources, courseSourceIndex }: CourseSourcesPageProps) {
  return (
    <main className="content-view content-view--sources course-sources-page" id="main-content" tabIndex={-1}>
      <p className="course-name"><Link className="reader-course-link" href={getCoursePath({ key: courseKey, title: courseTitle })}>{courseTitle}</Link></p>
      <h1 className="course-title">Sources</h1>
      <p className="course-sources-intro">
        These are the course-wide source records. Individual sections show the subset they use, while preserving these same citation numbers.
      </p>
      <div className="source-reference-controls course-sources-controls">
        <SourceSuggestionButton courseKey={courseKey} courseTitle={courseTitle} />
      </div>
      {sources.length > 0 ? (
        <ol className="course-sources-list">
          {sources.map((source) => {
            const citationNumber = sourceCitationNumber(source.id, courseSourceIndex);

            return (
              <li id={`course-source-reference-${citationNumber ?? source.id}`} key={source.id}>
                <span className="source-reference-index">[{citationNumber ?? "?"}]</span>
                <div className="course-source-card-body">
                  {isExternalSourceUrl(source.url) ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  ) : (
                    <strong>{source.title}</strong>
                  )}
                  <div className="course-source-meta">{sourceRecordMeta(source)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="course-sources-empty">No source records have been attached to this course yet.</p>
      )}
    </main>
  );
}
