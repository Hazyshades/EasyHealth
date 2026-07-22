import { createHash } from "node:crypto";
import type {
  MappingChangeClassification,
  MeasurementResolution,
  MeasurementResolutionInput,
  VerificationActorType,
  VerificationStatus,
} from "@/lib/biomarkers";
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
        specimen: input.specimen ?? null,
        modifier: input.modifier ?? null,
        section: input.section ?? null,
        neighbourLabels: input.neighbourLabels ?? [],
        referenceLow: input.referenceLow ?? null,
        referenceHigh: input.referenceHigh ?? null,
        proposedKey: input.proposedKey ?? null,
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
      "id, extracted_biomarker_id, observation_id, measurement_definition_key, analyte_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, verification_decided_at, verification_actor_type, verification_actor_id, is_active, mapping_change_classification"
    )
    .eq("extracted_biomarker_id", extractedBiomarkerId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as NormalizationRevision | null) ?? null;
}
