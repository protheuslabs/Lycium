import { ArrowUpRight, BookOpen } from "lucide-react";
import type { SourceRecord } from "../ContentView/contentViewTypes";
import { isExternalSourceUrl, sourceRecordMeta } from "../ContentView/sourceCitationUtils";

export default function CourseMaterials({ sources }: { sources: SourceRecord[] }) {
  if (!sources.length) return null;
  return (
    <section id="materials" className="overview-materials" aria-labelledby="materials-title">
      <div className="overview-section-heading">
        <h2 id="materials-title">Course materials</h2>
        <span>{sources.length} {sources.length === 1 ? "source" : "sources"}</span>
      </div>
      <ol>
        {sources.map((source) => {
          const meta = sourceRecordMeta(source);
          return (
            <li key={source.id}>
              <BookOpen size={17} aria-hidden="true" />
              <div>
                {isExternalSourceUrl(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={14} aria-hidden="true" /></a> : <strong>{source.title}</strong>}
                {meta && <p>{meta}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
