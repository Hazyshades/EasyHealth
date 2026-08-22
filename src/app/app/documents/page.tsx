import { getSessionProfileId } from "@/lib/auth/session";
import { listDocumentsForProfile } from "@/lib/documents/list";
import { DocumentsHub } from "./documents-hub";

export default async function DocumentsPage() {
  const profileId = await getSessionProfileId();
  const result = profileId
    ? await listDocumentsForProfile(profileId, { type: "lab_result" })
    : { ok: true as const, documents: [] };

  return (
    <DocumentsHub
      initialTab="lab_result"
      initialDocuments={result.ok ? result.documents : []}
      skipInitialFetch={result.ok}
      initialLoadFailed={!result.ok}
    />
  );
}
