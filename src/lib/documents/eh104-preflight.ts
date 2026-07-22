import { getMeasurementDefinition } from "@/lib/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";

export type Eh104PreflightFinding = {
  finding_code: string;
  subject_type: string;
  subject_id: string;
  details: Record<string, unknown>;
};

type VerifiedRevision = {
  id: string;
  measurement_definition_key: string | null;
  verification_status: string;
};

const VERIFIED_STATUSES = ["auto_verified", "user_verified", "manually_corrected"];

export async function readEh104ResolutionVerificationPreflight(): Promise<Eh104PreflightFinding[]> {
  const supabase = createAdminClient();
  const { data: databaseFindings, error: databaseError } = await supabase.rpc(
    "eh104_resolution_verification_preflight"
  );
  if (databaseError) throw databaseError;

  const { data: verifiedRevisions, error: revisionError } = await supabase
    .from("observation_normalization_revisions")
    .select("id, measurement_definition_key, verification_status")
    .in("verification_status", VERIFIED_STATUSES);
  if (revisionError) throw revisionError;

  const registryFindings: Eh104PreflightFinding[] = ((verifiedRevisions ?? []) as VerifiedRevision[])
    .flatMap((revision) => {
      const definition = revision.measurement_definition_key
        ? getMeasurementDefinition(revision.measurement_definition_key)
        : null;
      if (definition?.maturity === "reviewed") return [];

      return [{
        finding_code: "verified_non_reviewed_definition",
        subject_type: "normalization_revision",
        subject_id: revision.id,
        details: {
          verification_status: revision.verification_status,
          measurement_definition_key: revision.measurement_definition_key,
          definition_maturity: definition?.maturity ?? null,
        },
      }];
    });

  return [...((databaseFindings ?? []) as Eh104PreflightFinding[]), ...registryFindings];
}
