import LegalPage from "../../../components/Legal/LegalPage";
import { getLegalDocument } from "../../../legal/legalDocuments";

export default function AcceptableUsePage() {
  return <LegalPage document={getLegalDocument("acceptable-use")} />;
}
