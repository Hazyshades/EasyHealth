import { createHash } from "node:crypto";
import type {
  MappingChangeClassification,
  MeasurementResolution,
  MeasurementResolutionInput,
  VerificationActorType,
  ResolverDecisionTrace,
  VerificationStatus,
} from "@/lib/biomarkers";
import type { MeasurementOverride } from "./observation-measurement-correction";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compatibleManualDefinitions,
  decideAutomaticPromotion,
  type PromotionDecision,
} from "./normalization-policy";

export {
  compatibleManualDefinitions,
  decideAutomaticPromotion,
  type PromotionDecision,
};

export type NormalizationRevision = {
  id: string;
  extracted_biomarker_id: string;
  observation_id: string | null;
  measurement_definition_key: string | null;
  analyte_key: string | null;
  resolver_result: MeasurementResolution["result"];
  mapping_confidence: number;
  mapping_confidence_band: MeasurementResolution["mappingConfidenceBand"] | null;
  verification_status: VerificationStatus;
  verification_decided_at: string | null;
  verification_actor_type: VerificationActorType | null;
  verification_actor_id: string | null;
  is_active: boolean;
  mapping_change_classification: MappingChangeClassification | null;
  resolver_evidence: ResolverDecisionTrace;
  /**
   * EH-119: the reviewer's restatement of the reported measurement, or null
   * when the revision reports the extraction as read. Its presence is what
   * marks a row as user-corrected; verification status stays EH-120's.
   */
  measurement_override: MeasurementOverride | null;
};

/**
 * The raw-resolution input identity used by the service-only atomic writer.
 * It intentionally excludes user action state; the writer has a separate
 * request hash for idempotent acceptance/correction attempts.
 */
export function buildInputEvidenceHash(input: MeasurementResolutionInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        rawLabel: input.rawLabel,
        rawUnit: input.rawUnit ?? null,
        rawValueText: input.rawValueText ?? null,
        valueKind: input.valueKind ?? null,
        specimen: input.specimen ?? null,
        modifier: input.modifier ?? null,
        section: input.section ?? null,
        neighbourLabels: input.neighbourLabels ?? [],
        referenceLow: input.referenceLow ?? null,
        referenceHigh: input.referenceHigh ?? null,
        proposedKey: input.proposedKey ?? null,
        timing: input.timing ?? null,
        method: input.method ?? null,
        laboratory: input.laboratory ?? null,
      })
    )
    .digest("hex");
}

export async function getActiveNormalizationRevision(
  extractedBiomarkerId: string
): Promise<NormalizationRevision | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("observation_normalization_revisions")
    .select(
      "id, extracted_biomarker_id, observation_id, measurement_definition_key, analyte_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, verification_decided_at, verification_actor_type, verification_actor_id, is_active, mapping_change_classification, resolver_evidence, measurement_override"
    )
    .eq("extracted_biomarker_id", extractedBiomarkerId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as NormalizationRevision | null) ?? null;
}

export type NormalizationSourceState = Readonly<{
  id: string;
  profile_id: string;
  document_id: string;
  record_status: "active" | "rejected" | "superseded";
  is_current: boolean;
}>;

export async function getNormalizationSourceState(
  extractedBiomarkerId: string,
): Promise<NormalizationSourceState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("document_extracted_biomarkers")
    .select("id, profile_id, document_id, record_status, is_current")
    .eq("id", extractedBiomarkerId)
    .maybeSingle();
  if (error) throw error;
  return (data as NormalizationSourceState | null) ?? null;
}
