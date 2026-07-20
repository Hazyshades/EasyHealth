import { createHash } from "node:crypto";
import {
  getMeasurementDefinition,
  MEASUREMENT_CATALOG_MANIFEST_RELEASE,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  OBSERVATION_PROVENANCE_SCHEMA_VERSION,
  parseLabValueCell,
  resolveMeasurementDefinition,
} from "@/lib/biomarkers";
import type {
  CandidateEvidence,
  MappingChangeClassification,
  MeasurementResolution,
  MeasurementResolutionInput,
  MeasurementValueKind,
} from "@/lib/biomarkers";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildInputEvidenceHash,
  getActiveNormalizationRevision,
  type NormalizationRevision,
} from "./normalization-revisions";

export type ExtractedBiomarkerWriterRow = {
  id: string;
  biomarker_key: string | null;
  biomarker_name: string;
  raw_name: string | null;
  value_numeric: number | string | null;
  value_text: string | null;
  value_kind: string | null;
  ordinal: number | null;
  unit: string | null;
  raw_unit: string | null;
  reference_range: string | null;
  raw_reference_range: string | null;
  section_context: string | null;
  confidence: number | null;
  specimen: string | null;
  modifier: string | null;
  source_page: number | null;
  source_text: string | null;
  bounding_box?: unknown;
  reported_alt_value: number | null;
  reported_alt_unit: string | null;
  raw_value_text: string | null;
  processing_version: string | null;
};

export type ObservationNormalizationWriteKind = "acceptance" | "correction";

export type ObservationNormalizationWriterResult = {
  observationId: string;
  revisionId: string;
  verificationStatus: "pending" | "user_verified" | "manually_corrected";
  resolverResult: MeasurementResolution["result"];
  wasReused: boolean;
};

export class ObservationNormalizationWriterError extends Error {
  constructor(message: string, public readonly status = 422) {
    super(message);
  }
}

type ParsedObservationValue = {
  value: number | null;
  valueText: string | null;
  valueKind: "numeric" | "qualitative" | "ordinal" | "text";
  ordinal: number | null;
};

function finiteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function measurementValueKind(valueKind: string | null | undefined): MeasurementValueKind {
  if (valueKind === "numeric" || valueKind === "qualitative" || valueKind === "ordinal") {
    return valueKind;
  }
  return "unspecified";
}

export function parseExtractedObservationValue(
  row: Pick<ExtractedBiomarkerWriterRow, "value_numeric" | "value_text" | "value_kind" | "ordinal">
): ParsedObservationValue {
  let value = finiteNumber(row.value_numeric);
  let valueText = row.value_text?.trim() || null;
  let valueKind = row.value_kind ?? null;
  let ordinal = row.ordinal ?? null;

  if (value == null && valueText) {
    const parsed = parseLabValueCell(valueText);
    if (parsed) {
      value = parsed.value;
      valueText = parsed.value_text;
      valueKind = parsed.value_kind;
      ordinal = parsed.ordinal;
    }
  } else if (value != null) {
    valueKind ??= "numeric";
    valueText ??= String(value);
  }

  const normalizedValueKind =
    valueKind === "numeric" || valueKind === "qualitative" || valueKind === "ordinal"
      ? valueKind
      : "text";

  if (normalizedValueKind === "numeric" && value == null) {
    throw new ObservationNormalizationWriterError("Numeric observation has no usable value");
  }
  if (normalizedValueKind !== "numeric" && !valueText) {
    throw new ObservationNormalizationWriterError("Qualitative observation has no usable value");
  }

  return { value, valueText, valueKind: normalizedValueKind, ordinal };
}

export function measurementInputFromWriterRow(
  row: ExtractedBiomarkerWriterRow
): MeasurementResolutionInput {
  const parsedValue = parseExtractedObservationValue(row);
  const { ref_low, ref_high } = parseReferenceRange(
    row.reference_range ?? row.raw_reference_range
  );
  return {
    rawLabel: row.raw_name ?? row.biomarker_name,
    rawUnit: row.raw_unit ?? row.unit,
    specimen: row.specimen ?? "unspecified",
    modifier: row.modifier ?? "none",
    section: row.section_context ?? null,
    referenceLow: ref_low,
    referenceHigh: ref_high,
    extractionConfidence: row.confidence ?? null,
    proposedKey: row.biomarker_key,
    valueKind: measurementValueKind(parsedValue.valueKind),
    rawValueText: row.raw_value_text ?? null,
  };
}

export function isReviewedResolution(resolution: MeasurementResolution): boolean {
  if (resolution.result !== "resolved" || !resolution.measurementDefinitionKey) {
    return false;
  }
  const definition = getMeasurementDefinition(resolution.measurementDefinitionKey);
  return definition?.maturity === "reviewed" && definition.analyteKey === resolution.analyteKey;
}

export function buildManualCorrectionResolution(options: {
  input: MeasurementResolutionInput;
  selectedDefinitionKey: string;
}): MeasurementResolution {
  const baseResolution = resolveMeasurementDefinition(options.input);
  const definition = getMeasurementDefinition(options.selectedDefinitionKey);
  const selectedCandidate = baseResolution.candidateEvidence.find(
    (candidate) => candidate.candidateKey === options.selectedDefinitionKey
  );

  if (
    !definition ||
    definition.maturity !== "reviewed" ||
    !selectedCandidate ||
    selectedCandidate.rejected.length > 0
  ) {
    throw new ObservationNormalizationWriterError(
      "Selected measurement definition is incompatible with the extracted evidence"
    );
  }

  const candidateEvidence: CandidateEvidence[] = baseResolution.candidateEvidence.map(
    (candidate) =>
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

  return {
    ...baseResolution,
    result: "resolved",
    measurementDefinitionKey: definition.key,
    analyteKey: definition.analyteKey,
    mappingConfidence: 0.95,
    mappingConfidenceBand: "high",
    candidateEvidence,
  };
}

function buildObservationPayload(options: {
  profileId: string;
  documentId: string;
  observedAt: string;
  row: ExtractedBiomarkerWriterRow;
  value: ParsedObservationValue;
  referenceRange: { ref_low: number | null; ref_high: number | null };
}) {
  const { profileId, documentId, observedAt, row, value, referenceRange } = options;
  return {
    profile_id: profileId,
    document_id: documentId,
    name: row.biomarker_name,
    value: value.value,
    value_kind: value.valueKind,
    value_text: value.valueText,
    ordinal: value.ordinal,
    unit: row.unit ?? "",
    ref_low: referenceRange.ref_low,
    ref_high: referenceRange.ref_high,
    observed_at: observedAt,
    specimen: row.specimen ?? "unspecified",
    modifier: row.modifier ?? "none",
    raw_name: row.raw_name ?? row.biomarker_name,
    raw_value_text: row.raw_value_text ?? null,
    raw_reference_text: row.raw_reference_range ?? null,
    raw_unit: row.raw_unit ?? row.unit ?? null,
    source_page: row.source_page ?? null,
    source_text: row.source_text ?? null,
    bounding_box: row.bounding_box ?? null,
    confidence: row.confidence ?? null,
    reported_alt_value: row.reported_alt_value ?? null,
    reported_alt_unit: row.reported_alt_unit ?? null,
    extraction_version: row.processing_version ?? null,
    provenance_schema_version: OBSERVATION_PROVENANCE_SCHEMA_VERSION,
  };
}

function buildResolutionPayload(
  input: MeasurementResolutionInput,
  resolution: MeasurementResolution
) {
  return {
    input_evidence_hash: buildInputEvidenceHash(input),
    measurement_definition_key: resolution.measurementDefinitionKey,
    analyte_key: resolution.analyteKey,
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
  };
}

export function buildNormalizationWriterRequestHash(options: {
  actorId: string;
  extractedBiomarkerId: string;
  input: MeasurementResolutionInput;
  resolution: MeasurementResolution;
  writeKind: ObservationNormalizationWriteKind;
  mappingClassification: MappingChangeClassification;
  correctionReason?: string | null;
  reversalOfRevisionId?: string | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        actorId: options.actorId,
        extractedBiomarkerId: options.extractedBiomarkerId,
        inputEvidenceHash: buildInputEvidenceHash(options.input),
        result: options.resolution.result,
        measurementDefinitionKey: options.resolution.measurementDefinitionKey,
        analyteKey: options.resolution.analyteKey,
        mappingConfidence: options.resolution.mappingConfidence,
        mappingConfidenceBand: options.resolution.mappingConfidenceBand,
        candidateEvidence: options.resolution.candidateEvidence,
        catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
        catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
        resolverVersion: MEASUREMENT_RESOLVER_VERSION,
        normalizationVersion: MEASUREMENT_NORMALIZATION_VERSION,
        writeKind: options.writeKind,
        mappingClassification: options.mappingClassification,
        correctionReason: options.correctionReason ?? null,
        reversalOfRevisionId: options.reversalOfRevisionId ?? null,
      })
    )
    .digest("hex");
}

export async function writeExtractedBiomarkerNormalization(options: {
  profileId: string;
  documentId: string;
  observedAt: string;
  row: ExtractedBiomarkerWriterRow;
  actorId: string;
  writeKind: ObservationNormalizationWriteKind;
  resolution?: MeasurementResolution;
  expectedActiveRevision?: NormalizationRevision | null;
  mappingClassification?: MappingChangeClassification;
  correctionReason?: string | null;
  reversalOfRevisionId?: string | null;
  supersedesRevisionId?: string | null;
}): Promise<ObservationNormalizationWriterResult> {
  const input = measurementInputFromWriterRow(options.row);
  const resolution = options.resolution ?? resolveMeasurementDefinition(input);
  const reviewedMeasurementDefinition = isReviewedResolution(resolution);
  const parsedValue = parseExtractedObservationValue(options.row);
  const referenceRange = parseReferenceRange(
    options.row.reference_range ?? options.row.raw_reference_range
  );
  const expectedActiveRevision =
    options.expectedActiveRevision === undefined
      ? await getActiveNormalizationRevision(options.row.id)
      : options.expectedActiveRevision;
  const mappingClassification =
    options.mappingClassification ??
    (options.writeKind === "correction" ? "review_required" : "additive");
  const requestHash = buildNormalizationWriterRequestHash({
    actorId: options.actorId,
    extractedBiomarkerId: options.row.id,
    input,
    resolution,
    writeKind: options.writeKind,
    mappingClassification,
    correctionReason: options.correctionReason,
    reversalOfRevisionId: options.reversalOfRevisionId,
  });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "write_observation_normalization_revision_v2",
    {
      p_extracted_biomarker_id: options.row.id,
      p_observation: buildObservationPayload({
        profileId: options.profileId,
        documentId: options.documentId,
        observedAt: options.observedAt,
        row: options.row,
        value: parsedValue,
        referenceRange,
      }),
      p_resolution: buildResolutionPayload(input, resolution),
      p_write_kind: options.writeKind,
      p_actor_id: options.actorId,
      p_request_hash: requestHash,
      p_expected_active_revision_id: expectedActiveRevision?.id ?? null,
      p_mapping_change_classification: mappingClassification,
      p_correction_reason: options.correctionReason ?? null,
      p_reversal_of_revision_id: options.reversalOfRevisionId ?? null,
      p_supersedes_revision_id:
        options.supersedesRevisionId ?? expectedActiveRevision?.id ?? null,
      p_extraction_version: options.row.processing_version ?? null,
      p_reviewed_measurement_definition: reviewedMeasurementDefinition,
    }
  );
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.observation_id || !result.revision_id) {
    throw new Error("Normalization writer returned no promoted observation revision");
  }

  return {
    observationId: String(result.observation_id),
    revisionId: String(result.revision_id),
    verificationStatus: result.verification_status as ObservationNormalizationWriterResult["verificationStatus"],
    resolverResult: result.resolver_result as MeasurementResolution["result"],
    wasReused: Boolean(result.was_reused),
  };
}
