import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPersistedResolverDecisionTrace,
  coerceClinicalModifier,
  getMeasurementDefinition,
  MEASUREMENT_CATALOG_MANIFEST_RELEASE,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  OBSERVATION_PROVENANCE_SCHEMA_VERSION,
  resolveMeasurementDefinition,
} from "@/lib/biomarkers";
import type {
  CandidateEvidence,
  MappingChangeClassification,
  MeasurementResolution,
  MeasurementResolutionInput,
  MeasurementValueKind,
  PersistedResolverDecisionTrace,
  VerificationStatus,
} from "@/lib/biomarkers";
import {
  applyMeasurementOverride,
  baseMeasurementFromExtractedRow,
  codeFor,
  type BaseMeasurement,
  type MeasurementOverride,
} from "./observation-measurement-correction";
import {
  decideAutomaticPromotion,
  isAutomaticVerificationReleaseApproved,
} from "./normalization-policy";
import { observationDateFromExtractedRow } from "@/lib/documents/observation-date";
import {
  parseSourceRegion,
  sourceRegionMatchesPage,
} from "@/lib/documents/source-region";
import {
  buildInputEvidenceHash,
  getActiveNormalizationRevision,
  getNormalizationSourceState,
  type NormalizationRevision,
} from "./normalization-revisions";
import { statedAxisValue } from "./stated-axis-evidence";
import {
  buildResolutionOutcomeMetric,
  emitResolutionOutcomeMetricForWrite,
} from "./incomplete-laboratory-outcomes";
const OBSERVED_AT_NOT_USED_BY_RESOLUTION = "1970-01-01";

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
  method?: string | null;
  processing_version: string | null;
  collected_at?: string | null;
  record_status?: "active" | "rejected" | "superseded" | null;
  is_current?: boolean | null;
};

/**
 * EH-119: `value_correction` restates the reported measurement. It is a
 * different act from `correction`, which is the selection of a concrete
 * reviewed definition and must still land on `resolved`. A measurement
 * correction may end in any resolver outcome, because the outcome is
 * re-derived from the corrected input rather than chosen by the caller.
 */
export type ObservationNormalizationWriteKind =
  | "acceptance"
  | "correction"
  | "value_correction"
  | "verification_reversal";

export type ObservationNormalizationWriterResult = {
  observationId: string;
  revisionId: string;
  verificationStatus: VerificationStatus;
  resolverResult: MeasurementResolution["result"];
  wasReused: boolean;
};

export class ObservationNormalizationWriterError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
    public readonly code: string | null = null
  ) {
    super(message);
  }
}

function baseMeasurementFromWriterRow(
  row: ExtractedBiomarkerWriterRow,
  observedAt: string | null,
): BaseMeasurement {
  try {
    return baseMeasurementFromExtractedRow(row, observedAt);
  } catch (caught) {
    throw new ObservationNormalizationWriterError(
      caught instanceof Error ? caught.message : "Could not read extracted measurement",
    );
  }
}
const WRITER_RPC_CODE_ALIASES: Readonly<Record<string, string>> = {
  measurement_override_observed_at_in_future: "observed_at_in_future",
  measurement_correction_requires_reason: "correction_reason_required",
};

const WRITER_RPC_CODES = [
  "invalid_measurement_override",
  "measurement_override_observed_at_in_future",
  "measurement_correction_requires_reason",
  "correction_requires_reviewed_concrete_definition",
  "invalid_normalization_resolution_payload",
  "invalid_normalization_writer_payload",
  "invalid_normalization_write_kind",
  "normalization_writer_actor_required",
  "invalid_normalization_writer_request_hash",
  "incomplete_normalization_cannot_have_concrete_identity",
  "resolved_normalization_requires_concrete_identity",
  "unreviewed_measurement_definition",
  "reversal_revision_source_mismatch",
  "superseded_revision_source_mismatch",
  "invalid_verification_reversal_source",
  "verification_reversal_requires_reason",
  "batch_verification_revision_not_found",
  "batch_verification_revision_not_active",
  "batch_verification_revision_not_reversible",
  "verification_reversal_request_conflict",
  "automatic_verification_service_role_required",
  "automatic_quality_gate_not_approved",
  "automatic_verification_policy_rejected",
  "automatic_verification_source_not_current",
  "automatic_verification_protected_decision",
  "automatic_verification_request_conflict",
  "automatic_verification_projection_missing",
  "invalid_resolver_decision_trace",
  "observation_source_page_missing",
  "resolver_decision_trace_resolution_mismatch",
  "stale_revision_conflict",
  "observation_source_mismatch",
  "observation_source_owner_mismatch",
  "active_revision_projection_mismatch",
  "measurement_override_projection_mismatch",
  "revision_observation_binding_conflict",
  "terminal_record",
] as const;
function normalizeWriterRpcError(error: unknown): ObservationNormalizationWriterError | null {
  if (!error || typeof error !== "object") return null;
  const message =
    "message" in error && typeof error.message === "string" ? error.message : null;
  if (!message) return null;
  const rawCode = WRITER_RPC_CODES.find(
    (candidate) => message === candidate || message.includes(candidate),
  );
  if (!rawCode) return null;
  return new ObservationNormalizationWriterError(
    message,
    codeFor(rawCode) ?? 422,
    WRITER_RPC_CODE_ALIASES[rawCode] ?? rawCode,
  );
}


export function measurementInputFromWriterRow(
  row: ExtractedBiomarkerWriterRow,
  override?: MeasurementOverride | null
): MeasurementResolutionInput {
  // EH-119: a correction edits the resolver's INPUT. The restated unit, value
  // and reference bounds are what the reviewer says the document reports, so
  // they are what resolution must see. Without an override this is byte-for-byte
  // the pre-EH-119 input, which is why an uncorrected row keeps its evidence
  // hash and its stored resolution.
  // The date is not part of `MeasurementResolutionInput`, so any placeholder
  // would do; the composition is reused purely for value kind, value text and
  // the reference bounds.
  const measurement = applyMeasurementOverride(
    baseMeasurementFromWriterRow(row, OBSERVED_AT_NOT_USED_BY_RESOLUTION),
    override
  );
  // #106: the writer and EH-116 reprocessing both resolve through this builder,
  // so the stated-evidence policy has to be applied here as well as in the
  // review preview. Reprocessing re-runs resolution and not extraction, which
  // is what corrects rows already stored with a fabricated axis.
  const provenance = {
    label: row.raw_name ?? row.biomarker_name,
    sourceText: row.source_text ?? null,
    sectionContext: row.section_context ?? null,
  };
  return {
    rawLabel: row.raw_name ?? row.biomarker_name,
    rawUnit: override?.unit ?? row.raw_unit ?? row.unit,
    specimen: statedAxisValue("specimen", row.specimen ?? null, provenance),
    modifier: statedAxisValue("modifier", row.modifier ?? null, provenance),
    method: statedAxisValue("method", row.method ?? null, provenance),
    section: row.section_context ?? null,
    referenceLow: measurement.refLow,
    referenceHigh: measurement.refHigh,
    extractionConfidence: row.confidence ?? null,
    proposedKey: row.biomarker_key,
    valueKind:
      measurement.valueKind === "numeric" ||
      measurement.valueKind === "qualitative" ||
      measurement.valueKind === "ordinal"
        ? measurement.valueKind
        : null,
    rawValueText: override?.value_text ?? row.raw_value_text ?? null,
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
    !selectedCandidate.selectable ||
    selectedCandidate.rejected.length > 0 ||
    selectedCandidate.missingAxes.length > 0
  ) {
    throw new ObservationNormalizationWriterError(
      "Selected measurement definition is incompatible with the extracted evidence",
      422,
      "correction_requires_reviewed_concrete_definition",
    );
  }

  const candidateEvidence: CandidateEvidence[] = baseResolution.candidateEvidence.map(
    (candidate) =>
      candidate.candidateKey === definition.key
        ? {
            ...candidate,
            accepted: [
              ...candidate.accepted,
              { code: "manual_selection", source: "manual", strength: "strong", score: 0 },
            ],
          }
        : candidate
  );

  return {
    ...baseResolution,
    result: "resolved",
    measurementDefinitionKey: definition.key,
    analyteKey: definition.analyteKey,
    mappingConfidence: Math.min(0.99, (selectedCandidate.score ?? 0) / 100),
    mappingConfidenceBand: (selectedCandidate.score ?? 0) / 100 >= 0.85 ? "high" : (selectedCandidate.score ?? 0) / 100 >= 0.6 ? "medium" : "low",
    candidateEvidence,
    decisionTrace: {
      ...baseResolution.decisionTrace,
      selectedCandidateKey: definition.key,
      outcome: "resolved",
      confidence: Math.min(0.99, (selectedCandidate.score ?? 0) / 100),
      candidates: candidateEvidence,
    },
  };
}

function buildObservationPayload(options: {
  profileId: string;
  documentId: string;
  row: ExtractedBiomarkerWriterRow;
  measurement: BaseMeasurement;
  override: MeasurementOverride | null;
}) {
  const { profileId, documentId, row, measurement, override } = options;
  // EH-118: a document-sourced observation must link to a source page. Legacy
  // rows extracted before the page index existed cannot be grounded after the
  // fact, so acceptance reports an actionable error instead of hitting the
  // database constraint or fabricating page 1.
  if (row.source_page == null) {
    throw new ObservationNormalizationWriterError(
      "This result has no source page. Reprocess the document to restore its source link before accepting it.",
      422,
      "observation_source_page_missing"
    );
  }
  const region = parseSourceRegion(row.bounding_box);
  return {
    profile_id: profileId,
    document_id: documentId,
    name: row.biomarker_name,
    // EH-119: the EFFECTIVE measurement, raw extraction with any active
    // override applied. Every write kind sends it, so an acceptance, a
    // confirmation or a reprocessing write that runs after a correction
    // re-emits the corrected measurement instead of reverting to what the
    // extractor read.
    value: measurement.value,
    value_kind: measurement.valueKind,
    value_text: measurement.valueText,
    ordinal: measurement.ordinal,
    unit: measurement.unit ?? "",
    ref_low: measurement.refLow,
    ref_high: measurement.refHigh,
    observed_at: measurement.observedAt,
    specimen: row.specimen ?? "unspecified",
    modifier: coerceClinicalModifier(row.modifier),
    // Raw provenance below. None of it is correctable, and
    // `observation_provenance_write_once` rejects any UPDATE that moves it, so
    // these values are only ever written when the observation is created.
    raw_name: row.raw_name ?? row.biomarker_name,
    raw_value_text: row.raw_value_text ?? null,
    raw_reference_text: row.raw_reference_range ?? null,
    raw_unit: row.raw_unit ?? row.unit ?? null,
    source_page: row.source_page ?? null,
    source_text: row.source_text ?? null,
    // EH-118: only a region that satisfies the contract and belongs to the
    // recorded page is copied. Provenance is write-once, so an unverified box
    // would be permanent; page-only provenance is the correct degradation.
    bounding_box: sourceRegionMatchesPage(region, row.source_page ?? null) ? region : null,
    confidence: row.confidence ?? null,
    reported_alt_value: row.reported_alt_value ?? null,
    reported_alt_unit: row.reported_alt_unit ?? null,
    extraction_version: row.processing_version ?? null,
    provenance_schema_version: OBSERVATION_PROVENANCE_SCHEMA_VERSION,
    // EH-119: the override rides inside the observation payload so the EH-115
    // trace wrapper, which forwards it verbatim, needs no signature change.
    measurement_override: override,
  };
}

export function buildNormalizationResolutionPayload(
  input: MeasurementResolutionInput,
  resolution: MeasurementResolution
) {
  return buildResolutionPayload(
    resolution,
    buildPersistedResolverDecisionTrace(resolution, {
      inputEvidenceHash: buildInputEvidenceHash(input),
      catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
      catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
      resolverVersion: MEASUREMENT_RESOLVER_VERSION,
    })
  );
}

/**
 * Source of truth for alias evidence is `resolver_decision_trace` (schema 2).
 * `resolver_evidence` keeps the operational v2 `ResolverDecisionTrace` its
 * existing readers consume. Both are projected from the same in-memory
 * resolution, and this assertion makes a future divergence impossible to ship
 * silently; `eh122_trace_matches_resolver_evidence` re-checks it in the
 * database so a hand-built payload cannot bypass it either.
 */
function assertTraceMatchesResolverEvidence(
  resolution: MeasurementResolution,
  trace: PersistedResolverDecisionTrace
): void {
  if (trace.schemaVersion !== "2") return;
  const evidenceByKey = new Map(
    resolution.decisionTrace.candidates.map((candidate) => [candidate.candidateKey, candidate])
  );
  if (evidenceByKey.size !== trace.candidates.length) {
    throw new ObservationNormalizationWriterError(
      "Resolver evidence and decision trace disagree on candidate count"
    );
  }
  for (const candidate of trace.candidates) {
    const evidence = evidenceByKey.get(candidate.candidateKey);
    if (!evidence) {
      throw new ObservationNormalizationWriterError(
        `Resolver evidence has no candidate ${candidate.candidateKey}`
      );
    }
    const alias = evidence.matchedAlias;
    if (
      alias.key !== candidate.aliasKey ||
      alias.matchType !== candidate.aliasMatchType ||
      (alias.locale ?? "en") !== candidate.aliasLocale ||
      (alias.laboratory ?? null) !== candidate.aliasLaboratory ||
      (alias.foldFallback === true) !== candidate.aliasFoldFallback
    ) {
      throw new ObservationNormalizationWriterError(
        `Alias evidence diverges between trace and resolver evidence for ${candidate.candidateKey}`
      );
    }
  }
}

function buildResolutionPayload(
  resolution: MeasurementResolution,
  trace: PersistedResolverDecisionTrace
) {
  assertTraceMatchesResolverEvidence(resolution, trace);
  return {
    input_evidence_hash: trace.inputEvidenceHash,
    measurement_definition_key: resolution.measurementDefinitionKey,
    analyte_key: resolution.analyteKey,
    resolver_result: resolution.result,
    mapping_confidence: resolution.mappingConfidence,
    mapping_confidence_band: resolution.mappingConfidenceBand,
    resolver_evidence: resolution.decisionTrace,
    resolver_decision_trace: trace,
    resolver_trace_schema_version: trace.schemaVersion,
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
  inputEvidenceHash: string;
  decisionTrace: PersistedResolverDecisionTrace;
  writeKind: ObservationNormalizationWriteKind;
  mappingClassification: MappingChangeClassification;
  correctionReason?: string | null;
  reversalOfRevisionId?: string | null;
  measurementOverride?: MeasurementOverride | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        actorId: options.actorId,
        extractedBiomarkerId: options.extractedBiomarkerId,
        inputEvidenceHash: options.inputEvidenceHash,
        decisionTrace: options.decisionTrace,
        writeKind: options.writeKind,
        mappingClassification: options.mappingClassification,
        correctionReason: options.correctionReason ?? null,
        reversalOfRevisionId: options.reversalOfRevisionId ?? null,
        // EH-119: two corrections that differ only in what was restated must
        // not collide on one idempotency key, and an identical replay must
        // still reuse the same revision. `parseMeasurementOverride` emits keys
        // in a fixed order, so this serialization is canonical.
        measurementOverride: options.measurementOverride ?? null,
      })
    )
    .digest("hex");
}

export async function writeExtractedBiomarkerNormalization(options: {
  profileId: string;
  documentId: string;
  observedAt: string | null;
  row: ExtractedBiomarkerWriterRow;
  actorId: string;
  writeKind: ObservationNormalizationWriteKind;
  resolution?: MeasurementResolution;
  expectedActiveRevision?: NormalizationRevision | null;
  mappingClassification?: MappingChangeClassification;
  correctionReason?: string | null;
  reversalOfRevisionId?: string | null;
  supersedesRevisionId?: string | null;
  /**
   * EH-119: the reviewer's restatement. Omit it and the writer carries the
   * active revision's override forward, which is what stops an acceptance,
   * confirmation or reprocessing write from reverting a correction. Pass
   * `null` explicitly to restore the raw extracted measurement, which is how
   * undo back to raw is expressed.
   */
  measurementOverride?: MeasurementOverride | null;
}): Promise<ObservationNormalizationWriterResult> {
  const expectedActiveRevision =
    options.expectedActiveRevision === undefined
      ? await getActiveNormalizationRevision(options.row.id)
      : options.expectedActiveRevision;
  const measurementOverride =
    options.measurementOverride === undefined
      ? expectedActiveRevision?.measurement_override ?? null
      : options.measurementOverride;
  const input = measurementInputFromWriterRow(options.row, measurementOverride);
  const resolution = options.resolution ?? resolveMeasurementDefinition(input);
  const reviewedMeasurementDefinition = isReviewedResolution(resolution);
  const measurement = applyMeasurementOverride(
    baseMeasurementFromWriterRow(
      options.row,
      observationDateFromExtractedRow(options.row, options.observedAt),
    ),
    measurementOverride
  );
  const mappingClassification =
    options.mappingClassification ??
    (options.writeKind === "correction" ? "review_required" : "additive");
  const inputEvidenceHash = buildInputEvidenceHash(input);
  const decisionTrace = buildPersistedResolverDecisionTrace(resolution, {
    inputEvidenceHash,
    catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
    resolverVersion: MEASUREMENT_RESOLVER_VERSION,
  });
  const requestHash = buildNormalizationWriterRequestHash({
    actorId: options.actorId,
    extractedBiomarkerId: options.row.id,
    inputEvidenceHash,
    decisionTrace,
    writeKind: options.writeKind,
    mappingClassification,
    correctionReason: options.correctionReason,
    reversalOfRevisionId: options.reversalOfRevisionId,
    measurementOverride,
  });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "write_observation_normalization_revision_v2",
    {
      p_extracted_biomarker_id: options.row.id,
      p_observation: buildObservationPayload({
        profileId: options.profileId,
        documentId: options.documentId,
        row: options.row,
        measurement,
        override: measurementOverride,
      }),
      p_resolution: buildResolutionPayload(resolution, decisionTrace),
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
      p_measurement_override: measurementOverride,
    }
  );
  if (error) {
    throw normalizeWriterRpcError(error) ?? error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.observation_id || !result.revision_id) {
    throw new Error("Normalization writer returned no promoted observation revision");
  }
  const wasReused = Boolean(result.was_reused);
  emitResolutionOutcomeMetricForWrite({
    wasReused,
    metric: buildResolutionOutcomeMetric({
      resolution,
      writeKind:
        options.writeKind === "verification_reversal"
          ? "reversal"
          : options.writeKind,
      resolverVersion: MEASUREMENT_RESOLVER_VERSION,
      catalogVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    }),
  });

  return {
    observationId: String(result.observation_id),
    revisionId: String(result.revision_id),
    verificationStatus: result.verification_status as ObservationNormalizationWriterResult["verificationStatus"],
    resolverResult: result.resolver_result as MeasurementResolution["result"],
    wasReused,
  };
}

export type AutomaticVerificationResult =
  | ObservationNormalizationWriterResult
  | Readonly<{ promoted: false; reason: string }>;

/**
 * Service-only automatic promotion. The caller supplies only the current
 * extracted row and an approved quality-gate decision; the resolver outcome,
 * actor metadata, verification status, and request hash are derived here.
 */
export async function writeAutomaticBiomarkerVerification(options: {
  profileId: string;
  documentId: string;
  observedAt: string | null;
  row: ExtractedBiomarkerWriterRow;
  expectedActiveRevision?: NormalizationRevision | null;
  qualityGateApproved: boolean;
  measurementOverride?: MeasurementOverride | null;
}): Promise<AutomaticVerificationResult> {
  const sourceState = await getNormalizationSourceState(options.row.id);
  if (!sourceState) {
    return { promoted: false, reason: "source_not_found" };
  }
  const expectedActiveRevision =
    options.expectedActiveRevision === undefined
      ? await getActiveNormalizationRevision(options.row.id)
      : options.expectedActiveRevision;
  const measurementOverride =
    options.measurementOverride === undefined
      ? expectedActiveRevision?.measurement_override ?? null
      : options.measurementOverride;
  const input = measurementInputFromWriterRow(options.row, measurementOverride);
  const resolution = resolveMeasurementDefinition(input);
  const qualityGateApproved =
    options.qualityGateApproved && isAutomaticVerificationReleaseApproved();
  const promotion = decideAutomaticPromotion({
    resolution,
    activeRevision: expectedActiveRevision
      ? {
          verification_status: expectedActiveRevision.verification_status,
          measurement_override: expectedActiveRevision.measurement_override,
        }
      : null,
    recordStatus: sourceState.record_status,
    sourceIsCurrent: sourceState.is_current,
    mappingClassification: "compatibility_preserving",
    qualityGateApproved,
  });
  if (!promotion.allowed) {
    return { promoted: false, reason: promotion.reason };
  }

  const measurement = applyMeasurementOverride(
    baseMeasurementFromWriterRow(
      options.row,
      observationDateFromExtractedRow(options.row, options.observedAt),
    ),
    measurementOverride,
  );
  const inputEvidenceHash = buildInputEvidenceHash(input);
  const decisionTrace = buildPersistedResolverDecisionTrace(resolution, {
    inputEvidenceHash,
    catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
    resolverVersion: MEASUREMENT_RESOLVER_VERSION,
  });
  const requestHash = buildNormalizationWriterRequestHash({
    actorId: "system",
    extractedBiomarkerId: options.row.id,
    inputEvidenceHash,
    decisionTrace,
    writeKind: "acceptance",
    mappingClassification: "compatibility_preserving",
    measurementOverride,
  });
  const { data, error } = await createAdminClient().rpc(
    "eh120_write_automatic_verification_v2",
    {
      p_extracted_biomarker_id: options.row.id,
      p_observation: buildObservationPayload({
        profileId: options.profileId,
        documentId: options.documentId,
        row: options.row,
        measurement,
        override: measurementOverride,
      }),
      p_resolution: buildResolutionPayload(resolution, decisionTrace),
      p_request_hash: requestHash,
      p_expected_active_revision_id: expectedActiveRevision?.id ?? null,
      p_extraction_version: options.row.processing_version ?? null,
      p_quality_gate_approved: qualityGateApproved,
      p_reviewed_measurement_definition: isReviewedResolution(resolution),
      p_measurement_override: measurementOverride,
    },
  );
  if (error) {
    throw normalizeWriterRpcError(error) ?? error;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.observation_id || !result.revision_id) {
    throw new Error("Automatic verification writer returned no promoted revision");
  }
  const wasReused = Boolean(result.was_reused);
  emitResolutionOutcomeMetricForWrite({
    wasReused,
    metric: buildResolutionOutcomeMetric({
      resolution,
      writeKind: "acceptance",
      resolverVersion: MEASUREMENT_RESOLVER_VERSION,
      catalogVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    }),
  });
  return {
    observationId: String(result.observation_id),
    revisionId: String(result.revision_id),
    verificationStatus: result.verification_status as ObservationNormalizationWriterResult["verificationStatus"],
    resolverResult: result.resolver_result as MeasurementResolution["result"],
    wasReused,
  };
}
