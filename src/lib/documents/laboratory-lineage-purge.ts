import { createAdminClient } from "@/lib/supabase/admin";

export type LaboratoryLineagePurgeResult = {
  document_id: string;
  locked_observations: number;
  cleared_observations: number;
  deleted_extracted_biomarkers: number;
};

export async function purgeDocumentDerivedLaboratoryLineage(
  documentId: string
): Promise<LaboratoryLineagePurgeResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "purge_document_derived_laboratory_lineage",
    { p_document_id: documentId }
  );
  if (error) throw error;

  const result = (Array.isArray(data) ? data[0] : data) as
    | LaboratoryLineagePurgeResult
    | null
    | undefined;
  if (!result?.document_id) {
    throw new Error("Laboratory lineage purge returned no result");
  }
  return result;
}
