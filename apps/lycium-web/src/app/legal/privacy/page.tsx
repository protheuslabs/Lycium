import LegalPage from "../../../components/Legal/LegalPage";
import { getLegalDocument } from "../../../legal/legalDocuments";

export default function PrivacyPage() {
  return <LegalPage document={getLegalDocument("privacy")} />;
}
