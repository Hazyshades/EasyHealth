import {
  getMeasurementDefinition,
  isPersistedResolverDecisionTrace,
  SUPPORTED_RESOLVER_DECISION_TRACE_SCHEMA_VERSIONS,
  type MeasurementDefinition,
  type MeasurementResolution,
  type PersistedResolverDecisionTrace,
  type ResolvedReviewedMeasurementBinding,
  type ResolverResult,
  type VerificationStatus,
} from "@/lib/biomarkers";
import { z } from "zod";
import type {
  RegistryV2LaboratoryBindingSource,
  RegistryV2NormalizationRevisionReadBoundary,
} from "./observation-read-boundaries";

export type PersistedDecisionSource = "persisted" | "preview" | "none";
export type PersistedDecisionQuality = "available" | "unavailable" | "conflict";

export type PersistedDecisionQualityCode =
  | "no_active_revision"
  | "preview_not_persisted"
  | "preview_invalid"
  | "multiple_active_revisions"
  | "trace_missing"
  | "trace_schema_version_missing"
  | "trace_schema_unsupported"
  | "trace_invalid"
  | "operational_evidence_unavailable"
  | "invalid_persisted_outcome"
  | "historical_identity_missing"
  | "input_hash_missing"
  | "input_identity_version_unsupported"
  | "release_metadata_missing"
  | "catalog_definition_unavailable"
  | "catalog_definition_not_reviewed"
  | "catalog_identity_drift"
  | "source_lineage_unavailable"
  | "outcome_conflict"
  | "measurement_identity_conflict"
  | "selected_candidate_conflict"
  | "candidate_set_conflict"
  | "trace_schema_conflict"
  | "input_hash_conflict"
  | "release_metadata_conflict"
  | "source_lineage_conflict"
  | "non_concrete_identity_conflict";

type PersistedDecisionConflictCode = Extract<
  PersistedDecisionQualityCode,
  | "multiple_active_revisions"
  | "outcome_conflict"
  | "measurement_identity_conflict"
  | "selected_candidate_conflict"
  | "candidate_set_conflict"
  | "trace_schema_conflict"
  | "input_hash_conflict"
  | "release_metadata_conflict"
  | "source_lineage_conflict"
  | "non_concrete_identity_conflict"
>;

export type PersistedDecisionConflictField =
  | "active_revision"
  | "outcome"
  | "measurement_definition_key"
  | "analyte_key"
  | "selected_candidate_key"
  | "candidate_keys"
  | "trace_schema_version"
  | "input_evidence_hash"
  | "release"
  | "source_lineage";

export type PersistedDecisionConflict = Readonly<{
  code: PersistedDecisionConflictCode;
  field: PersistedDecisionConflictField;
  persistedValue: string | null;
  operationalValue: string | null;
  traceValue: string | null;
}>;

export type PersistedDecisionStoredState = Readonly<{
  outcome: ResolverResult | null;
  verificationStatus: VerificationStatus | string | null;
  measurementDefinitionKey: string | null;
  analyteKey: string | null;
  mappingConfidence: number | null;
  mappingConfidenceBand: string | null;
  inputEvidenceHash: string | null;
  inputIdentityFormatVersion: string | null;
}>;

export type PersistedDecisionRelease = Readonly<{
  catalogManifestVersion: string | null;
  catalogManifestDigest: string | null;
  resolverVersion: string | null;
  normalizationVersion: string | null;
  traceSchemaVersion: string | null;
}>;

export type PersistedDecisionCatalogEnrichment = Readonly<{
  status: "not_required" | "available" | "unavailable";
  reason:
    | "catalog_definition_unavailable"
    | "catalog_definition_not_reviewed"
    | "catalog_identity_drift"
    | null;
  definition: MeasurementDefinition | null;
}>;

export type PersistedDecisionRead = Readonly<{
  source: PersistedDecisionSource;
  quality: PersistedDecisionQuality;
  notPersisted: boolean;
  qualityCodes: readonly PersistedDecisionQualityCode[];
  conflicts: readonly PersistedDecisionConflict[];
  activeRevision: RegistryV2NormalizationRevisionReadBoundary | null;
  stored: PersistedDecisionStoredState;
  release: PersistedDecisionRelease;
  technicalTrace: PersistedResolverDecisionTrace | null;
  operationalEvidence: PersistedDecisionOperationalEvidence | null;
  preview: MeasurementResolution | null;
  currentCatalog: PersistedDecisionCatalogEnrichment;
  currentBindingReady: boolean;
  measurementDefinition: MeasurementDefinition | null;
  resolvedMeasurementBinding: ResolvedReviewedMeasurementBinding | null;
}>;

type RevisionRelation =
  | RegistryV2NormalizationRevisionReadBoundary
  | readonly RegistryV2NormalizationRevisionReadBoundary[]
  | null
  | undefined;

type DecisionReadObservation = RegistryV2LaboratoryBindingSource & {
  id?: string | null;
  source_extracted_biomarker_id?: string | null;
};

export type PersistedDecisionReadOptions = Readonly<{
  relation: RevisionRelation;
  observation?: DecisionReadObservation;
  preview?: MeasurementResolution | null;
}>;

type PersistedDecisionOperationalEvidenceCandidate = {
  candidateKey?: string;
  accepted?: readonly { code?: string }[];
  missing?: readonly { code?: string }[];
  rejected?: readonly { code?: string }[];
  missingAxes?: readonly string[];
  selectable?: boolean;
  eligible?: boolean;
  admissibilityRejections?: readonly string[];
};
type PersistedDecisionLegacyOperationalEvidence = Readonly<
  Record<string, unknown>
>;

export type PersistedDecisionOperationalEvidence = {
  version?: number;
  compatibilityPolicyVersion?: string;
  selectedCandidateKey?: string | null;
  runnerUpCandidateKey?: string | null;
  outcome?: ResolverResult | null;
  confidence?: number;
  candidates?: readonly PersistedDecisionOperationalEvidenceCandidate[];
  candidateKeys?: readonly string[];
  missingAxes?: readonly string[];
  conflictCodes?: readonly string[];
  admissibilityRejections?: readonly string[];
  legacyEntries?: readonly PersistedDecisionLegacyOperationalEvidence[];
};

const CONFLICT_CODES = new Set<PersistedDecisionConflictCode>([
  "multiple_active_revisions",
  "outcome_conflict",
  "measurement_identity_conflict",
  "selected_candidate_conflict",
  "candidate_set_conflict",
  "trace_schema_conflict",
  "input_hash_conflict",
  "release_metadata_conflict",
  "source_lineage_conflict",
  "non_concrete_identity_conflict",
]);

const RESOLVER_RESULTS = new Set<ResolverResult>([
  "resolved",
  "ambiguous",
  "partial",
  "unmapped",
]);

function asResolverResult(value: unknown): ResolverResult | null {
  return typeof value === "string" &&
    RESOLVER_RESULTS.has(value as ResolverResult)
    ? (value as ResolverResult)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join(",");
  }
  return null;
}

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function revisionRows(
  relation: RevisionRelation,
): readonly RegistryV2NormalizationRevisionReadBoundary[] {
  if (relation == null) return [];
  return Array.isArray(relation)
    ? (relation as readonly RegistryV2NormalizationRevisionReadBoundary[])
    : [relation as RegistryV2NormalizationRevisionReadBoundary];
}

function sourceIsCurrent(
  observation: DecisionReadObservation | undefined,
): boolean {
  const source = Array.isArray(observation?.source_extracted_biomarker)
    ? (observation.source_extracted_biomarker[0] ?? null)
    : (observation?.source_extracted_biomarker ?? null);
  return (
    source == null ||
    (source.record_status !== "rejected" &&
      source.record_status !== "superseded" &&
      source.is_current !== false &&
      source.is_published !== false)
  );
}

const legacyOperationalEvidenceSchema = z.array(z.record(z.unknown()));
const operationalEvidenceItemSchema = z
  .object({
    code: z.string().optional(),
  })
  .passthrough();

const operationalEvidenceCandidateSchema = z
  .object({
    candidateKey: z.string().optional(),
    accepted: z.array(operationalEvidenceItemSchema).optional(),
    missing: z.array(operationalEvidenceItemSchema).optional(),
    rejected: z.array(operationalEvidenceItemSchema).optional(),
    missingAxes: z.array(z.string()).optional(),
    selectable: z.boolean().optional(),
    eligible: z.boolean().optional(),
    admissibilityRejections: z.array(z.string()).optional(),
  })
  .passthrough();

const operationalEvidenceSchema = z
  .object({
    version: z.number().finite().optional(),
    compatibilityPolicyVersion: z.string().optional(),
    selectedCandidateKey: z.string().nullable().optional(),
    runnerUpCandidateKey: z.string().nullable().optional(),
    outcome: z
      .enum(["resolved", "ambiguous", "partial", "unmapped"])
      .nullable()
      .optional(),
    confidence: z.number().finite().optional(),
    candidates: z.array(operationalEvidenceCandidateSchema).optional(),
    candidateKeys: z.array(z.string()).optional(),
    missingAxes: z.array(z.string()).optional(),
    conflictCodes: z.array(z.string()).optional(),
    admissibilityRejections: z.array(z.string()).optional(),
  })
  .passthrough();

function readOperationalEvidence(value: unknown): {
  evidence: PersistedDecisionOperationalEvidence | null;
  malformed: boolean;
} {
  if (value === null || value === undefined) {
    return { evidence: null, malformed: false };
  }
  if (Array.isArray(value)) {
    const parsedLegacy = legacyOperationalEvidenceSchema.safeParse(value);
    return parsedLegacy.success
      ? { evidence: { legacyEntries: parsedLegacy.data }, malformed: false }
      : { evidence: null, malformed: true };
  }
  const parsed = operationalEvidenceSchema.safeParse(value);
  if (!parsed.success) return { evidence: null, malformed: true };

  const record = parsed.data;
  const hasKnownField = [
    "version",
    "compatibilityPolicyVersion",
    "selectedCandidateKey",
    "runnerUpCandidateKey",
    "outcome",
    "confidence",
    "candidates",
    "candidateKeys",
    "missingAxes",
    "conflictCodes",
    "admissibilityRejections",
  ].some((key) => key in record);
  if (!hasKnownField) return { evidence: null, malformed: false };

  const evidence: PersistedDecisionOperationalEvidence = {
    version: record.version,
    compatibilityPolicyVersion: record.compatibilityPolicyVersion,
    selectedCandidateKey: record.selectedCandidateKey,
    runnerUpCandidateKey: record.runnerUpCandidateKey,
    outcome: record.outcome,
    confidence: record.confidence,
    candidates: record.candidates,
    candidateKeys: record.candidateKeys,
    missingAxes: record.missingAxes,
    conflictCodes: record.conflictCodes,
    admissibilityRejections: record.admissibilityRejections,
  };
  if (
    evidence.candidates === undefined &&
    evidence.candidateKeys !== undefined
  ) {
    evidence.candidates = evidence.candidateKeys.map((candidateKey) => ({
      candidateKey,
    }));
  }
  return { evidence, malformed: false };
}

function pushUnique(
  values: PersistedDecisionQualityCode[],
  value: PersistedDecisionQualityCode,
): void {
  if (!values.includes(value)) values.push(value);
}

function readTechnicalTrace(
  revision: RegistryV2NormalizationRevisionReadBoundary,
  qualityCodes: PersistedDecisionQualityCode[],
  conflicts: PersistedDecisionConflict[],
): PersistedResolverDecisionTrace | null {
  const raw = revision.resolver_decision_trace;
  const schemaVersion = asString(revision.resolver_trace_schema_version);
  if (raw === null || raw === undefined) {
    pushUnique(qualityCodes, "trace_missing");
    return null;
  }
  if (schemaVersion === null) {
    pushUnique(qualityCodes, "trace_schema_version_missing");
    return null;
  }
  if (
    !(
      SUPPORTED_RESOLVER_DECISION_TRACE_SCHEMA_VERSIONS as readonly string[]
    ).includes(schemaVersion)
  ) {
    pushUnique(qualityCodes, "trace_schema_unsupported");
    return null;
  }
  if (!isPersistedResolverDecisionTrace(raw)) {
    pushUnique(qualityCodes, "trace_invalid");
    return null;
  }
  if (raw.schemaVersion !== schemaVersion) {
    conflicts.push({
      code: "trace_schema_conflict",
      field: "trace_schema_version",
      persistedValue: schemaVersion,
      operationalValue: null,
      traceValue: raw.schemaVersion,
    });
    pushUnique(qualityCodes, "trace_schema_conflict");
  }
  return raw;
}

function compareValues(
  qualityCodes: PersistedDecisionQualityCode[],
  conflicts: PersistedDecisionConflict[],
  code: PersistedDecisionConflictCode,
  field: PersistedDecisionConflictField,
  persistedValue: unknown,
  operationalValue: unknown,
  traceValue: unknown,
): void {
  const persisted = safeValue(persistedValue);
  const operational = safeValue(operationalValue);
  const trace = safeValue(traceValue);
  if (operational !== null && persisted !== operational) {
    conflicts.push({
      code,
      field,
      persistedValue: persisted,
      operationalValue: operational,
      traceValue: trace,
    });
    pushUnique(qualityCodes, code);
    return;
  }
  if (trace !== null && persisted !== trace) {
    conflicts.push({
      code,
      field,
      persistedValue: persisted,
      operationalValue: operational,
      traceValue: trace,
    });
    pushUnique(qualityCodes, code);
  }
}

function compareOptionalRelease(
  revision: RegistryV2NormalizationRevisionReadBoundary,
  trace: PersistedResolverDecisionTrace,
  qualityCodes: PersistedDecisionQualityCode[],
  conflicts: PersistedDecisionConflict[],
): void {
  const releasePairs = [
    [
      "catalog_manifest_version",
      revision.catalog_manifest_version,
      trace.catalogManifestVersion,
    ],
    [
      "catalog_manifest_digest",
      revision.catalog_manifest_digest,
      trace.catalogManifestDigest,
    ],
    ["resolver_version", revision.resolver_version, trace.resolverVersion],
  ] as const;
  let missing = false;
  for (const [, persisted, technical] of releasePairs) {
    if (asString(persisted) === null) missing = true;
    else if (persisted !== technical) {
      conflicts.push({
        code: "release_metadata_conflict",
        field: "release",
        persistedValue: safeValue(persisted),
        operationalValue: null,
        traceValue: safeValue(technical),
      });
      pushUnique(qualityCodes, "release_metadata_conflict");
    }
  }
  if (asString(revision.normalization_version) === null) missing = true;
  if (missing) pushUnique(qualityCodes, "release_metadata_missing");
}

function compareLineage(
  revision: RegistryV2NormalizationRevisionReadBoundary,
  observation: DecisionReadObservation | undefined,
  qualityCodes: PersistedDecisionQualityCode[],
  conflicts: PersistedDecisionConflict[],
): void {
  const expectedExtractedId =
    observation?.source_extracted_biomarker_id ??
    (Array.isArray(observation?.source_extracted_biomarker)
      ? (observation?.source_extracted_biomarker[0]?.id ?? null)
      : (observation?.source_extracted_biomarker?.id ?? null));
  const revisionExtractedId = asString(revision.extracted_biomarker_id);
  if (expectedExtractedId !== null && revisionExtractedId === null) {
    pushUnique(qualityCodes, "source_lineage_unavailable");
  } else if (
    expectedExtractedId !== null &&
    revisionExtractedId !== null &&
    expectedExtractedId !== revisionExtractedId
  ) {
    conflicts.push({
      code: "source_lineage_conflict",
      field: "source_lineage",
      persistedValue: revisionExtractedId,
      operationalValue: expectedExtractedId,
      traceValue: null,
    });
    pushUnique(qualityCodes, "source_lineage_conflict");
  }
  const expectedObservationId = asString(observation?.id);
  const revisionObservationId = asString(revision.observation_id);
  if (expectedObservationId !== null && revisionObservationId === null) {
    pushUnique(qualityCodes, "source_lineage_unavailable");
  } else if (
    expectedObservationId !== null &&
    revisionObservationId !== null &&
    expectedObservationId !== revisionObservationId
  ) {
    conflicts.push({
      code: "source_lineage_conflict",
      field: "source_lineage",
      persistedValue: revisionObservationId,
      operationalValue: expectedObservationId,
      traceValue: null,
    });
    pushUnique(qualityCodes, "source_lineage_conflict");
  }
}

function currentCatalogEnrichment(
  outcome: ResolverResult | null,
  key: string | null,
  analyteKey: string | null,
  qualityCodes: PersistedDecisionQualityCode[],
): PersistedDecisionCatalogEnrichment {
  if (outcome !== "resolved" || key === null) {
    return { status: "not_required", reason: null, definition: null };
  }
  const definition = getMeasurementDefinition(key) ?? null;
  if (definition === null) {
    pushUnique(qualityCodes, "catalog_definition_unavailable");
    return {
      status: "unavailable",
      reason: "catalog_definition_unavailable",
      definition: null,
    };
  }
  if (
    definition.maturity !== "reviewed" ||
    definition.sourceProvenance.kind !== "registry_v2_review"
  ) {
    pushUnique(qualityCodes, "catalog_definition_not_reviewed");
    return {
      status: "unavailable",
      reason: "catalog_definition_not_reviewed",
      definition,
    };
  }
  if (analyteKey !== null && definition.analyteKey !== analyteKey) {
    pushUnique(qualityCodes, "catalog_identity_drift");
    return {
      status: "unavailable",
      reason: "catalog_identity_drift",
      definition,
    };
  }
  return { status: "available", reason: null, definition };
}

function buildCurrentBinding(
  observation: DecisionReadObservation | undefined,
  source: PersistedDecisionSource,
  sourceQuality: PersistedDecisionQuality,
  stored: PersistedDecisionStoredState,
  operationalEvidence: PersistedDecisionOperationalEvidence | null,
  technicalTrace: PersistedResolverDecisionTrace | null,
  currentCatalog: PersistedDecisionCatalogEnrichment,
): {
  ready: boolean;
  definition: MeasurementDefinition | null;
  resolvedMeasurementBinding: ResolvedReviewedMeasurementBinding | null;
} {
  if (source !== "persisted" || sourceQuality !== "available") {
    return {
      ready: false,
      definition: currentCatalog.definition,
      resolvedMeasurementBinding: null,
    };
  }
  const selectedKey =
    technicalTrace?.winningCandidateKey ??
    operationalEvidence?.selectedCandidateKey ??
    null;
  const definition = currentCatalog.definition;
  const ready =
    observation?.observation_kind !== "instrumental" &&
    sourceIsCurrent(observation) &&
    stored.outcome === "resolved" &&
    stored.measurementDefinitionKey !== null &&
    selectedKey !== null &&
    selectedKey === stored.measurementDefinitionKey &&
    currentCatalog.status === "available";

  return {
    ready,
    definition,
    resolvedMeasurementBinding:
      ready && definition?.conversion
        ? {
            measurementDefinitionKey: stored.measurementDefinitionKey!,
            analyteKey: definition.analyteKey,
            conversion: definition.conversion,
          }
        : null,
  };
}

function previewRead(preview: MeasurementResolution): PersistedDecisionRead {
  const valid =
    asResolverResult(preview.result) !== null &&
    preview.decisionTrace !== null &&
    preview.decisionTrace !== undefined;
  const qualityCodes: PersistedDecisionQualityCode[] = [
    "preview_not_persisted",
  ];
  if (!valid) pushUnique(qualityCodes, "preview_invalid");
  return {
    source: "preview",
    quality: valid ? "available" : "unavailable",
    notPersisted: true,
    qualityCodes,
    conflicts: [],
    activeRevision: null,
    stored: {
      outcome: valid ? preview.result : null,
      verificationStatus: "pending",
      measurementDefinitionKey: null,
      analyteKey: null,
      mappingConfidence: valid ? preview.mappingConfidence : null,
      mappingConfidenceBand: valid ? preview.mappingConfidenceBand : null,
      inputEvidenceHash: null,
      inputIdentityFormatVersion: null,
    },
    release: {
      catalogManifestVersion: null,
      catalogManifestDigest: null,
      resolverVersion: null,
      normalizationVersion: null,
      traceSchemaVersion: null,
    },
    technicalTrace: null,
    operationalEvidence: null,
    preview: valid ? preview : null,
    currentCatalog: { status: "not_required", reason: null, definition: null },
    currentBindingReady: false,
    measurementDefinition: null,
    resolvedMeasurementBinding: null,
  };
}

export function readPersistedDecision(
  options: PersistedDecisionReadOptions,
): PersistedDecisionRead {
  const rows = revisionRows(options.relation);
  const activeRows = rows.filter((revision) => revision.is_active === true);
  if (activeRows.length === 0) {
    return options.preview
      ? previewRead(options.preview)
      : {
          source: "none",
          quality: "unavailable",
          notPersisted: false,
          qualityCodes: ["no_active_revision"],
          conflicts: [],
          activeRevision: null,
          stored: {
            outcome: null,
            verificationStatus: null,
            measurementDefinitionKey: null,
            analyteKey: null,
            mappingConfidence: null,
            mappingConfidenceBand: null,
            inputEvidenceHash: null,
            inputIdentityFormatVersion: null,
          },
          release: {
            catalogManifestVersion: null,
            catalogManifestDigest: null,
            resolverVersion: null,
            normalizationVersion: null,
            traceSchemaVersion: null,
          },
          technicalTrace: null,
          operationalEvidence: null,
          preview: null,
          currentCatalog: {
            status: "not_required",
            reason: null,
            definition: null,
          },
          currentBindingReady: false,
          measurementDefinition: null,
          resolvedMeasurementBinding: null,
        };
  }

  if (activeRows.length > 1) {
    const activeRevisionIds = activeRows
      .map((entry) => safeValue(entry.id))
      .filter((id): id is string => id !== null)
      .sort()
      .join(",");
    return {
      source: "persisted",
      quality: "conflict",
      notPersisted: false,
      qualityCodes: ["multiple_active_revisions"],
      conflicts: [
        {
          code: "multiple_active_revisions",
          field: "active_revision",
          persistedValue: activeRevisionIds,
          operationalValue: null,
          traceValue: null,
        },
      ],
      activeRevision: null,
      stored: {
        outcome: null,
        verificationStatus: null,
        measurementDefinitionKey: null,
        analyteKey: null,
        mappingConfidence: null,
        mappingConfidenceBand: null,
        inputEvidenceHash: null,
        inputIdentityFormatVersion: null,
      },
      release: {
        catalogManifestVersion: null,
        catalogManifestDigest: null,
        resolverVersion: null,
        normalizationVersion: null,
        traceSchemaVersion: null,
      },
      technicalTrace: null,
      operationalEvidence: null,
      preview: null,
      currentCatalog: {
        status: "not_required",
        reason: null,
        definition: null,
      },
      currentBindingReady: false,
      measurementDefinition: null,
      resolvedMeasurementBinding: null,
    };
  }

  const revision = activeRows[0]!;
  const qualityCodes: PersistedDecisionQualityCode[] = [];
  const conflicts: PersistedDecisionConflict[] = [];

  const storedOutcome = asResolverResult(revision.resolver_result);
  if (revision.resolver_result != null && storedOutcome === null) {
    pushUnique(qualityCodes, "invalid_persisted_outcome");
  }
  const storedKey = asString(revision.measurement_definition_key);
  const storedAnalyteKey = asString(revision.analyte_key);
  if (
    storedOutcome === "resolved" &&
    (storedKey === null || storedAnalyteKey === null)
  ) {
    pushUnique(qualityCodes, "historical_identity_missing");
  }
  if (
    storedOutcome !== null &&
    storedOutcome !== "resolved" &&
    storedKey !== null
  ) {
    pushUnique(qualityCodes, "non_concrete_identity_conflict");
    conflicts.push({
      code: "non_concrete_identity_conflict",
      field: "measurement_definition_key",
      persistedValue: storedKey,
      operationalValue: null,
      traceValue: null,
    });
  }

  const rawOperational = revision.resolver_evidence as unknown;
  const operational = readOperationalEvidence(rawOperational);
  if (operational.malformed)
    pushUnique(qualityCodes, "operational_evidence_unavailable");
  const technicalTrace = readTechnicalTrace(revision, qualityCodes, conflicts);
  const operationalEvidence = operational.evidence;
  compareValues(
    qualityCodes,
    conflicts,
    "measurement_identity_conflict",
    "measurement_definition_key",
    storedKey,
    asString(options.observation?.measurement_definition_key),
    technicalTrace?.winningCandidateKey ?? null,
  );

  compareValues(
    qualityCodes,
    conflicts,
    "outcome_conflict",
    "outcome",
    storedOutcome,
    operationalEvidence?.outcome ?? null,
    technicalTrace?.outcome ?? null,
  );
  compareValues(
    qualityCodes,
    conflicts,
    "selected_candidate_conflict",
    "selected_candidate_key",
    storedKey,
    operationalEvidence?.selectedCandidateKey ?? null,
    technicalTrace?.winningCandidateKey ?? null,
  );
  if (
    operationalEvidence?.selectedCandidateKey !== undefined &&
    technicalTrace?.winningCandidateKey !== undefined &&
    operationalEvidence.selectedCandidateKey !==
      technicalTrace.winningCandidateKey
  ) {
    conflicts.push({
      code: "selected_candidate_conflict",
      field: "selected_candidate_key",
      persistedValue: storedKey,
      operationalValue: operationalEvidence.selectedCandidateKey ?? null,
      traceValue: technicalTrace.winningCandidateKey ?? null,
    });
    pushUnique(qualityCodes, "selected_candidate_conflict");
  }

  const operationalCandidateKeys =
    operationalEvidence?.candidates
      ?.map((candidate) => candidate.candidateKey)
      .filter((key): key is string => typeof key === "string")
      .sort() ?? null;
  const technicalCandidateKeys =
    technicalTrace?.candidates
      .map((candidate) => candidate.candidateKey)
      .sort() ?? null;
  if (
    operationalCandidateKeys !== null &&
    technicalCandidateKeys !== null &&
    JSON.stringify(unique(operationalCandidateKeys)) !==
      JSON.stringify(unique(technicalCandidateKeys))
  ) {
    conflicts.push({
      code: "candidate_set_conflict",
      field: "candidate_keys",
      persistedValue: safeValue(storedKey),
      operationalValue: operationalCandidateKeys.join(","),
      traceValue: technicalCandidateKeys.join(","),
    });
    pushUnique(qualityCodes, "candidate_set_conflict");
  }

  if (technicalTrace) {
    const persistedInputHash = asString(revision.input_evidence_hash);
    if (persistedInputHash === null) {
      pushUnique(qualityCodes, "input_hash_missing");
    } else if (persistedInputHash !== technicalTrace.inputEvidenceHash) {
      conflicts.push({
        code: "input_hash_conflict",
        field: "input_evidence_hash",
        persistedValue: persistedInputHash,
        operationalValue: null,
        traceValue: technicalTrace.inputEvidenceHash,
      });
      pushUnique(qualityCodes, "input_hash_conflict");
    }
    const identityVersion = asString(revision.input_identity_format_version);
    if (identityVersion === null) {
      pushUnique(qualityCodes, "historical_identity_missing");
    } else if (identityVersion !== "1") {
      pushUnique(qualityCodes, "input_identity_version_unsupported");
    }
    compareOptionalRelease(revision, technicalTrace, qualityCodes, conflicts);
  }

  if (storedOutcome !== "resolved" && storedOutcome !== null) {
    if (
      technicalTrace?.winningCandidateKey !== null &&
      technicalTrace?.winningCandidateKey !== undefined
    ) {
      pushUnique(qualityCodes, "non_concrete_identity_conflict");
      conflicts.push({
        code: "non_concrete_identity_conflict",
        field: "measurement_definition_key",
        persistedValue: storedKey,
        operationalValue: operationalEvidence?.selectedCandidateKey ?? null,
        traceValue: technicalTrace.winningCandidateKey,
      });
    }
  }

  compareLineage(revision, options.observation, qualityCodes, conflicts);

  const currentCatalog = currentCatalogEnrichment(
    storedOutcome,
    storedKey,
    storedAnalyteKey,
    qualityCodes,
  );
  const release: PersistedDecisionRelease = {
    catalogManifestVersion: asString(revision.catalog_manifest_version),
    catalogManifestDigest: asString(revision.catalog_manifest_digest),
    resolverVersion: asString(revision.resolver_version),
    normalizationVersion: asString(revision.normalization_version),
    traceSchemaVersion: asString(revision.resolver_trace_schema_version),
  };
  const unavailable = qualityCodes.some(
    (code) => !CONFLICT_CODES.has(code as PersistedDecisionConflictCode),
  );
  const quality: PersistedDecisionQuality =
    conflicts.length > 0
      ? "conflict"
      : unavailable
        ? "unavailable"
        : "available";
  const binding = buildCurrentBinding(
    options.observation,
    "persisted",
    quality,
    {
      outcome: storedOutcome,
      verificationStatus: asString(revision.verification_status),
      measurementDefinitionKey: storedKey,
      analyteKey: storedAnalyteKey,
      mappingConfidence: asNumber(revision.mapping_confidence),
      mappingConfidenceBand: asString(revision.mapping_confidence_band),
      inputEvidenceHash: asString(revision.input_evidence_hash),
      inputIdentityFormatVersion: asString(
        revision.input_identity_format_version,
      ),
    },
    operationalEvidence,
    technicalTrace,
    currentCatalog,
  );

  return {
    source: "persisted",
    quality,
    notPersisted: false,
    qualityCodes,
    conflicts,
    activeRevision: revision,
    stored: {
      outcome: storedOutcome,
      verificationStatus: asString(revision.verification_status),
      measurementDefinitionKey: storedKey,
      analyteKey: storedAnalyteKey,
      mappingConfidence: asNumber(revision.mapping_confidence),
      mappingConfidenceBand: asString(revision.mapping_confidence_band),
      inputEvidenceHash: asString(revision.input_evidence_hash),
      inputIdentityFormatVersion: asString(
        revision.input_identity_format_version,
      ),
    },
    release,
    technicalTrace,
    operationalEvidence,
    preview: null,
    currentCatalog,
    currentBindingReady: binding.ready,
    measurementDefinition: binding.definition,
    resolvedMeasurementBinding: binding.resolvedMeasurementBinding,
  };
}
