import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { legalDocuments } from "../../legal/legalDocuments";
import { COURSE_CATALOG_PATH, COURSE_CATALOG_PROGRAMS_PATH, LYCIUM_ROUTE_ROOT, MY_LEARNING_PATH, TOOLS_PATH } from "../../utils/courseRouting";

type CatalogFooterProps = { note?: string };

export default function CatalogFooter({ note = "Protheus Labs" }: CatalogFooterProps) {
  return (
    <footer className="catalog-footer" aria-label="Site footer">
      <div className="catalog-footer-inner">
        <div className="catalog-footer-main">
          <div className="catalog-footer-identity">
            <Link className="catalog-footer-brand" href={LYCIUM_ROUTE_ROOT} aria-label="Lycium home">LYCIUM</Link>
            <p>{note}</p>
          </div>
          <nav aria-labelledby="footer-learn-title">
            <h2 id="footer-learn-title">Learn</h2>
            <ul>
              <li><Link href={COURSE_CATALOG_PATH}>Browse courses</Link></li>
              <li><Link href={COURSE_CATALOG_PROGRAMS_PATH}>Explore programs</Link></li>
              <li><Link href={MY_LEARNING_PATH}>My Learning</Link></li>
              <li><Link href={TOOLS_PATH}>Tools</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-project-title">
            <h2 id="footer-project-title">Project</h2>
            <ul>
              <li><a href="https://github.com/protheuslabs/Lycium" target="_blank" rel="noopener noreferrer" aria-label="Lycium GitHub repository">GitHub<ArrowUpRight size={14} aria-hidden="true" /></a></li>
              <li><a href="https://github.com/protheuslabs/Lycium/issues" target="_blank" rel="noopener noreferrer">Report an issue<ArrowUpRight size={14} aria-hidden="true" /></a></li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-legal-title">
            <h2 id="footer-legal-title">Legal</h2>
            <ul>{legalDocuments.map((document) => <li key={document.slug}><Link href={`/legal/${document.slug}`}>{document.navLabel}</Link></li>)}</ul>
          </nav>
        </div>
        <div className="catalog-footer-bottom"><p>&copy; {new Date().getUTCFullYear()} {note}</p><Link href={LYCIUM_ROUTE_ROOT}>Back to home</Link></div>
      </div>
    </footer>
  );
}
