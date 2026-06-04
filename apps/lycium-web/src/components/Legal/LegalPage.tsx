import CatalogFooter from "../CatalogFooter/CatalogFooter";
import TopBar from "../TopBar/TopBar";
import type { LegalDocument } from "../../legal/legalDocuments";

type LegalPageProps = {
  document: LegalDocument;
};

export default function LegalPage({ document }: LegalPageProps) {
  return (
    <div className="legal-shell">
      <TopBar />
      <main className="legal-page">
        <article className="legal-document">
          <h1>{document.title}</h1>
          <p className="legal-summary">{document.summary}</p>
          <div className="legal-meta" aria-label="Document metadata">
            <span>Last updated: {document.lastUpdated}</span>
          </div>
          {document.sections.map((section) => (
            <section className="legal-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          <p className="legal-footnote">
            These documents are operational product drafts for transparency and planning. They should be reviewed by
            qualified counsel before production hosted use.
          </p>
        </article>
      </main>
      <CatalogFooter />
    </div>
  );
}
