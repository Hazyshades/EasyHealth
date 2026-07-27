import { createAdminClient } from "@/lib/supabase/admin";

export type InstrumentalPublicationPurgeResult = {
  deleted_publications: number;
  deleted_contents: number;
  deleted_measures: number;
  deleted_finding_versions: number;
};

/**
 * PR2 composite ownership FKs use ON DELETE RESTRICT, so document deletion
 * must explicitly purge instrumental publication state before removing the
 * documents row. Durable deletion (PR 3) replaces this with its constrained
 * finalizer.
 */
export async function purgeDocumentInstrumentalPublicationState(
  documentId: string
): Promise<InstrumentalPublicationPurgeResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "purge_document_instrumental_publication_state",
    { p_document_id: documentId }
  );
  if (error) throw error;

  const result = (Array.isArray(data) ? data[0] : data) as
    | InstrumentalPublicationPurgeResult
    | null
    | undefined;
  if (!result || typeof result.deleted_publications !== "number") {
    throw new Error("Instrumental publication purge returned no result");
  }
  return result;
}
