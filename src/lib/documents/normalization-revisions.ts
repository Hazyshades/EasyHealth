import { createHash } from "node:crypto";
import {
  MEASUREMENT_CATALOG_MANIFEST_RELEASE,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  resolveMeasurementDefinition,
} from "@/lib/biomarkers";
import type {
  CandidateEvidence,
  MeasurementResolution,
  MeasurementResolutionInput,
  VerificationActorType,
  VerificationStatus,
} from "@/lib/biomarkers";
import type { MappingChangeClassification } from "@/lib/biomarkers";
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

type VerificationDecisionMetadata = {
  verification_decided_at: string | null;
  verification_actor_type: VerificationActorType | null;
  verification_actor_id: string | null;
};

function verificationDecisionMetadata(
  status: VerificationStatus,
  actorId: string | null | undefined
): VerificationDecisionMetadata {
  if (status === "pending") {
    return {
      verification_decided_at: null,
      verification_actor_type: null,
      verification_actor_id: null,
    };
  }

  if (status === "auto_verified") {
    return {
      verification_decided_at: new Date().toISOString(),
      verification_actor_type: "system",
      verification_actor_id: null,
    };
  }

  return {
    verification_decided_at: new Date().toISOString(),
    verification_actor_type: "user",
    verification_actor_id: actorId ?? null,
  };
}

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

export async function createNormalizationCandidate(options: {
  extractedBiomarkerId: string;
  input: MeasurementResolutionInput;
  verificationStatus?: VerificationStatus;
  actorId?: string | null;
  mappingClassification?: MappingChangeClassification;
  correctionReason?: string | null;
  reversalOfRevisionId?: string | null;
  supersedesRevisionId?: string | null;
  resolutionOverride?: MeasurementResolution;
  extractionVersion?: string | null;
}): Promise<{ revision: NormalizationRevision; resolution: MeasurementResolution }> {
  const supabase = createAdminClient();
  const resolution = options.resolutionOverride ?? resolveMeasurementDefinition(options.input);
  const verificationStatus = options.verificationStatus ?? "pending";
  const payload = {
    extracted_biomarker_id: options.extractedBiomarkerId,
    input_evidence_hash: buildInputEvidenceHash(options.input),
    measurement_definition_key: resolution.measurementDefinitionKey,
    analyte_key: resolution.analyteKey,
    resolver_result: resolution.result,
    mapping_confidence: resolution.mappingConfidence,
    mapping_confidence_band: resolution.mappingConfidenceBand,
    resolver_evidence: resolution.candidateEvidence,
    catalog_manifest_version: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    catalog_manifest_digest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
    resolver_version: MEASUREMENT_RESOLVER_VERSION,
    normalization_version: MEASUREMENT_NORMALIZATION_VERSION,
    extraction_version: options.extractionVersion ?? null,
    verification_status: verificationStatus,
    ...verificationDecisionMetadata(verificationStatus, options.actorId),
    mapping_change_classification: options.mappingClassification ?? "additive",
    created_by: options.actorId ?? null,
    correction_reason: options.correctionReason ?? null,
    reversal_of_revision_id: options.reversalOfRevisionId ?? null,
    supersedes_revision_id: options.supersedesRevisionId ?? null,
  };

  const { data, error } = await supabase
    .from("observation_normalization_revisions")
    .insert(payload)
    .select("id, extracted_biomarker_id, observation_id, measurement_definition_key, analyte_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, verification_decided_at, verification_actor_type, verification_actor_id, is_active, mapping_change_classification")
    .single();
  if (error) throw error;
  const { error: metadataError } = await supabase
    .from("document_extracted_biomarkers")
    .update({
      measurement_definition_key: resolution.measurementDefinitionKey,
      resolver_result: resolution.result,
      mapping_confidence: resolution.mappingConfidence,
      mapping_confidence_band: resolution.mappingConfidenceBand,
      resolver_evidence: resolution.candidateEvidence,
      normalized_unit: resolution.unit.normalizedUnit,
      unit_dimension: resolution.unit.dimension,
      catalog_manifest_version: MEASUREMENT_CATALOG_MANIFEST_VERSION,
      catalog_manifest_digest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
      resolver_version: MEASUREMENT_RESOLVER_VERSION,
      normalization_version: MEASUREMENT_NORMALIZATION_VERSION,
      extraction_version: options.extractionVersion ?? null,
      verification_status: verificationStatus,
    })
    .eq("id", options.extractedBiomarkerId);
  if (metadataError) throw metadataError;
  return { revision: data as NormalizationRevision, resolution };
}

export async function createManualCorrection(options: {
  extractedBiomarkerId: string;
  input: MeasurementResolutionInput;
  selectedDefinitionKey: string;
  actorId: string;
  correctionReason?: string | null;
  supersedesRevisionId?: string | null;
  reversalOfRevisionId?: string | null;
  extractionVersion?: string | null;
}): Promise<{ revision: NormalizationRevision; resolution: MeasurementResolution }> {
  const baseResolution = resolveMeasurementDefinition(options.input);
  const definition = compatibleManualDefinitions(options.input).find(
    (candidate) => candidate.key === options.selectedDefinitionKey
  );
  if (!definition) {
    throw new Error("Selected measurement definition is incompatible with the extracted evidence");
  }

  const candidateEvidence: CandidateEvidence[] = baseResolution.candidateEvidence.map((candidate) =>
    candidate.candidateKey === definition.key
      ? {
          ...candidate,
          accepted: [
            ...candidate.accepted,
            { code: "manual_selection", source: "manual", strength: "strong" },
          ],
        }
      : candidate
  );
  const resolution: MeasurementResolution = {
    ...baseResolution,
    result: "resolved",
    measurementDefinitionKey: definition.key,
    analyteKey: definition.analyteKey,
    mappingConfidence: 0.95,
    mappingConfidenceBand: "high",
    candidateEvidence,
  };

  return createNormalizationCandidate({
    extractedBiomarkerId: options.extractedBiomarkerId,
    input: options.input,
    verificationStatus: "manually_corrected",
    actorId: options.actorId,
    mappingClassification: "review_required",
    correctionReason: options.correctionReason ?? null,
    supersedesRevisionId: options.supersedesRevisionId ?? null,
    reversalOfRevisionId: options.reversalOfRevisionId ?? null,
    extractionVersion: options.extractionVersion ?? null,
    resolutionOverride: resolution,
  });
}

export async function createManualReversal(options: {
  extractedBiomarkerId: string;
  input: MeasurementResolutionInput;
  revertToRevisionId: string;
  activeRevisionId: string;
  actorId: string;
  extractionVersion?: string | null;
}): Promise<{ revision: NormalizationRevision; resolution: MeasurementResolution }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("observation_normalization_revisions")
    .select("id, measurement_definition_key")
    .eq("id", options.revertToRevisionId)
    .eq("extracted_biomarker_id", options.extractedBiomarkerId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.measurement_definition_key) {
    throw new Error("The selected revision cannot be restored as a manual mapping");
  }
  return createManualCorrection({
    extractedBiomarkerId: options.extractedBiomarkerId,
    input: options.input,
    selectedDefinitionKey: data.measurement_definition_key,
    actorId: options.actorId,
    extractionVersion: options.extractionVersion ?? null,
    correctionReason: "Manual correction reverted",
    supersedesRevisionId: options.activeRevisionId,
    reversalOfRevisionId: options.revertToRevisionId,
  });
}

export async function promoteNormalizationRevision(options: {
  revisionId: string;
  observationId: string;
  actorId?: string | null;
}): Promise<NormalizationRevision> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("promote_observation_normalization_revision", {
    p_revision_id: options.revisionId,
    p_observation_id: options.observationId,
    p_actor_id: options.actorId ?? null,
  });
  if (error) throw error;
  return data as NormalizationRevision;
}

export async function promoteNormalizationRevisionV2(options: {
  revisionId: string;
  observationId: string;
  expectedActiveRevisionId: string | null;
  actorId?: string | null;
}): Promise<NormalizationRevision> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("promote_observation_normalization_revision_v2", {
    p_revision_id: options.revisionId,
    p_observation_id: options.observationId,
    p_expected_active_revision_id: options.expectedActiveRevisionId,
    p_actor_id: options.actorId ?? null,
  });
  if (error) throw error;
  return data as NormalizationRevision;
}

export async function getActiveNormalizationRevision(extractedBiomarkerId: string): Promise<NormalizationRevision | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("observation_normalization_revisions")
    .select("id, extracted_biomarker_id, observation_id, measurement_definition_key, analyte_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, verification_decided_at, verification_actor_type, verification_actor_id, is_active, mapping_change_classification")
    .eq("extracted_biomarker_id", extractedBiomarkerId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as NormalizationRevision | null) ?? null;
}
