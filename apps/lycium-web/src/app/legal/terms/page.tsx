import LegalPage from "../../../components/Legal/LegalPage";
import { getLegalDocument } from "../../../legal/legalDocuments";

export default function TermsPage() {
  return <LegalPage document={getLegalDocument("terms")} />;
}
