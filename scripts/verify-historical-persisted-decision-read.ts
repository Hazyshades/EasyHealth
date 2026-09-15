import assert from "node:assert/strict";

import {
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  buildPersistedResolverDecisionTrace,
  resolveMeasurementDefinition,
  type MeasurementResolution,
  type PersistedResolverDecisionTrace,
} from "../src/lib/biomarkers";
import { MEASUREMENT_CATALOG_MANIFEST_DIGEST } from "../src/lib/biomarkers/measurement-registry-release";
import {
  projectLaboratoryOutcome,
  serializeLaboratoryOutcome,
} from "../src/lib/documents/incomplete-laboratory-outcomes";
import { readPersistedDecision } from "../src/lib/documents/persisted-decision-read";
import type {
  RegistryV2LaboratoryBindingSource,
  RegistryV2NormalizationRevisionReadBoundary,
} from "../src/lib/documents/observation-read-boundaries";

const resolution = resolveMeasurementDefinition({
  rawLabel: "Glucose",
  rawUnit: "mg/dL",
  specimen: "serum",
  valueKind: "numeric",
});
assert.equal(resolution.result, "resolved");
assert.equal(resolution.measurementDefinitionKey, "glucose_serum");

const trace = buildPersistedResolverDecisionTrace(resolution, {
  inputEvidenceHash: "a".repeat(64),
  catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
  catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  resolverVersion: MEASUREMENT_RESOLVER_VERSION,
});

const observation: RegistryV2LaboratoryBindingSource & {
  value?: number | null;
  value_kind?: string | null;
  value_text?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  raw_reference_text?: string | null;
} = {
  id: "observation-1",
  source_extracted_biomarker_id: "source-1",
  source_extracted_biomarker: {
    id: "source-1",
    record_status: "active",
    is_current: true,
    is_published: true,
  },
  observation_kind: "lab",
  measurement_definition_key: "glucose_serum",
  resolution_status: "resolved",
  value: 90,
  value_kind: "numeric",
  value_text: "90",
  ref_low: 70,
  ref_high: 99,
  raw_reference_text: "70–99",
};

const operationalEvidence = {
  version: 2,
  compatibilityPolicyVersion: "policy-test",
  selectedCandidateKey: trace.winningCandidateKey,
  outcome: trace.outcome,
  candidates: trace.candidates.map((candidate) => ({
    candidateKey: candidate.candidateKey,
  })),
};

function revision(
  overrides: Partial<RegistryV2NormalizationRevisionReadBoundary> = {},
): RegistryV2NormalizationRevisionReadBoundary {
  return {
    id: "revision-1",
    extracted_biomarker_id: "source-1",
    observation_id: "observation-1",
    resolver_result: "resolved",
    verification_status: "user_verified",
    measurement_definition_key: "glucose_serum",
    analyte_key: "glucose",
    mapping_confidence: 0.95,
    mapping_confidence_band: "high",
    catalog_manifest_version: trace.catalogManifestVersion,
    catalog_manifest_digest: trace.catalogManifestDigest,
    resolver_version: trace.resolverVersion,
    normalization_version: "normalization-test",
    is_active: true,
    input_evidence_hash: trace.inputEvidenceHash,
    input_identity_format_version: "1",
    resolver_evidence: operationalEvidence,
    resolver_decision_trace: trace,
    resolver_trace_schema_version: trace.schemaVersion,
    measurement_override: null,
    created_at: "2026-09-15T00:00:00.000Z",
    ...overrides,
  };
}

function read(
  relation:
    | RegistryV2NormalizationRevisionReadBoundary
    | readonly RegistryV2NormalizationRevisionReadBoundary[]
    | null = revision(),
  preview?: MeasurementResolution | null,
) {
  return readPersistedDecision({
    relation,
    observation,
    preview,
  });
}

function hasCode(
  value: ReturnType<typeof read>,
  code: (typeof value.qualityCodes)[number],
): boolean {
  return value.qualityCodes.includes(code);
}

const persisted = read();
assert.equal(persisted.source, "persisted");
assert.equal(persisted.quality, "available");
assert.equal(persisted.notPersisted, false);
assert.deepEqual(persisted.qualityCodes, []);
assert.equal(persisted.activeRevision?.id, "revision-1");
assert.equal(persisted.stored.outcome, "resolved");
assert.equal(persisted.stored.measurementDefinitionKey, "glucose_serum");
assert.equal(persisted.stored.analyteKey, "glucose");
assert.equal(persisted.technicalTrace?.winningCandidateKey, "glucose_serum");
assert.equal(persisted.currentCatalog.status, "available");
assert.equal(persisted.currentBindingReady, true);
assert.equal(
  persisted.resolvedMeasurementBinding?.measurementDefinitionKey,
  "glucose_serum",
);

const projected = projectLaboratoryOutcome({
  observation,
  relation: revision(),
});
assert.equal(projected.resolutionDetails.source, "persisted");
assert.equal(projected.resolutionDetails.quality, "available");
assert.equal(projected.registryBindingReady, true);
assert.equal(projected.measurementDefinitionKey, "glucose_serum");
assert.equal(
  projected.resolutionDetails.storedIdentity.measurementDefinitionKey,
  "glucose_serum",
);
const serialized = serializeLaboratoryOutcome({
  observation,
  relation: revision(),
});
assert.equal(serialized.decision_source, "persisted");
assert.equal(serialized.decision_quality, "available");
assert.equal(serialized.decision_not_persisted, false);
assert.deepEqual(serialized.decision_quality_codes, []);

const activeRevisionIgnoresPreview = read(revision(), resolution);
assert.equal(activeRevisionIgnoresPreview.source, "persisted");
assert.equal(activeRevisionIgnoresPreview.preview, null);
assert.equal(
  activeRevisionIgnoresPreview.stored.measurementDefinitionKey,
  "glucose_serum",
);

const technicalTraceWithoutOperationalEvidence = read(
  revision({ resolver_evidence: null }),
);
assert.equal(technicalTraceWithoutOperationalEvidence.source, "persisted");
assert.equal(technicalTraceWithoutOperationalEvidence.quality, "available");
assert.equal(
  technicalTraceWithoutOperationalEvidence.technicalTrace?.outcome,
  "resolved",
);
assert.equal(
  technicalTraceWithoutOperationalEvidence.operationalEvidence,
  null,
);
const legacyArrayEvidence = [{ axis: "unit", state: "compatible" }] as const;
const legacyArray = read(
  revision({
    resolver_evidence:
      legacyArrayEvidence as unknown as RegistryV2NormalizationRevisionReadBoundary["resolver_evidence"],
  }),
);
assert.equal(legacyArray.quality, "available");
assert.deepEqual(
  legacyArray.operationalEvidence?.legacyEntries,
  legacyArrayEvidence,
);

const missingTrace = read(
  revision({
    resolver_decision_trace: null,
    resolver_trace_schema_version: null,
  }),
  resolution,
);
assert.equal(missingTrace.source, "persisted");
assert.equal(missingTrace.quality, "unavailable");
assert.equal(missingTrace.notPersisted, false);
assert.equal(hasCode(missingTrace, "trace_missing"), true);
assert.equal(missingTrace.preview, null);
assert.equal(missingTrace.stored.measurementDefinitionKey, "glucose_serum");
assert.equal(missingTrace.currentBindingReady, false);

const malformedTrace = read(
  revision({
    resolver_decision_trace: { invalid: true },
    resolver_trace_schema_version: "2",
  }),
);
assert.equal(malformedTrace.quality, "unavailable");
assert.equal(hasCode(malformedTrace, "trace_invalid"), true);
assert.equal(malformedTrace.technicalTrace, null);
const malformedOperational = read(
  revision({
    resolver_evidence: {
      ...operationalEvidence,
      selectedCandidateKey: 42,
    } as unknown as RegistryV2NormalizationRevisionReadBoundary["resolver_evidence"],
  }),
);
assert.equal(malformedOperational.quality, "unavailable");
assert.equal(
  hasCode(malformedOperational, "operational_evidence_unavailable"),
  true,
);
assert.equal(malformedOperational.operationalEvidence, null);

const legacyPartialTrace = {
  schemaVersion: "1",
  outcome: "partial",
  decisionKind: "recognized_incomplete",
  inputEvidenceHash: "b".repeat(64),
  catalogManifestVersion: trace.catalogManifestVersion,
  catalogManifestDigest: trace.catalogManifestDigest,
  resolverVersion: trace.resolverVersion,
  winningCandidateKey: null,
  candidates: [
    {
      candidateKey: "glucose_serum",
      maturity: "reviewed",
      score: 80,
      accepted: [],
      rejected: [],
      missingAxes: [],
      conflicts: [],
    },
  ],
  missingAxes: [],
  conflicts: [],
} as const satisfies PersistedResolverDecisionTrace;
const legacyPartialObservation = {
  ...observation,
  measurement_definition_key: null,
};
const legacyPartialRevision = revision({
  input_evidence_hash: legacyPartialTrace.inputEvidenceHash,
  resolver_result: "partial",
  measurement_definition_key: null,
  analyte_key: "glucose",
  resolver_decision_trace: legacyPartialTrace,
  resolver_trace_schema_version: "1",
  resolver_evidence: {
    version: 2,
    outcome: "partial",
    candidateKeys: ["glucose_serum"],
    conflictCodes: [],
    admissibilityRejections: ["definition_not_reviewed"],
  } as unknown as RegistryV2NormalizationRevisionReadBoundary["resolver_evidence"],
});
const legacyPartial = readPersistedDecision({
  relation: legacyPartialRevision,
  observation: legacyPartialObservation,
});
assert.equal(legacyPartial.quality, "available");
assert.deepEqual(legacyPartial.operationalEvidence?.candidateKeys, [
  "glucose_serum",
]);
const projectedLegacyPartial = projectLaboratoryOutcome({
  observation: legacyPartialObservation,
  relation: legacyPartialRevision,
});
assert.equal(
  projectedLegacyPartial.resolutionDetails.incompleteReason,
  "definition_not_reviewed",
);
assert.equal(projectedLegacyPartial.storedAnalyteKey, "glucose");
assert.deepEqual(projectedLegacyPartial.resolutionDetails.storedIdentity, {
  measurementDefinitionKey: null,
  analyteKey: null,
  winningCandidateKey: null,
  selectedCandidateKey: null,
});

const unsupportedTrace = read(
  revision({
    resolver_decision_trace: { ...trace, schemaVersion: "3" },
    resolver_trace_schema_version: "3",
  }),
);
assert.equal(unsupportedTrace.quality, "unavailable");
assert.equal(hasCode(unsupportedTrace, "trace_schema_unsupported"), true);
assert.equal(unsupportedTrace.technicalTrace, null);

const conflictingIdentity = read(
  revision({
    measurement_definition_key: "alt_serum_catalytic_activity",
    analyte_key: "alt",
    resolver_evidence: {
      ...operationalEvidence,
      selectedCandidateKey: "alt_serum_catalytic_activity",
    },
  }),
);
assert.equal(conflictingIdentity.source, "persisted");
assert.equal(conflictingIdentity.quality, "conflict");
assert.equal(hasCode(conflictingIdentity, "selected_candidate_conflict"), true);
assert.equal(
  hasCode(conflictingIdentity, "measurement_identity_conflict"),
  true,
);
assert.equal(
  conflictingIdentity.stored.measurementDefinitionKey,
  "alt_serum_catalytic_activity",
);
assert.equal(
  conflictingIdentity.technicalTrace?.winningCandidateKey,
  "glucose_serum",
);
assert.equal(conflictingIdentity.currentBindingReady, false);

const lineageConflict = read(
  revision({
    extracted_biomarker_id: "source-2",
    observation_id: "observation-2",
  }),
);
assert.equal(lineageConflict.quality, "conflict");
assert.equal(hasCode(lineageConflict, "source_lineage_conflict"), true);

const multipleActive = read([revision(), revision({ id: "revision-2" })]);
assert.equal(multipleActive.source, "persisted");
assert.equal(multipleActive.quality, "conflict");
assert.equal(hasCode(multipleActive, "multiple_active_revisions"), true);
assert.equal(multipleActive.activeRevision, null);
assert.equal(multipleActive.stored.outcome, null);
assert.equal(multipleActive.technicalTrace, null);
assert.equal(multipleActive.operationalEvidence, null);
const reorderedMultipleActive = read([
  revision({ id: "revision-2" }),
  revision(),
]);
assert.deepEqual(reorderedMultipleActive.conflicts, multipleActive.conflicts);
assert.deepEqual(
  reorderedMultipleActive.qualityCodes,
  multipleActive.qualityCodes,
);

const projectedMultipleActive = projectLaboratoryOutcome({
  observation,
  relation: [revision(), revision({ id: "revision-2" })],
});
assert.equal(
  projectedMultipleActive.resolutionDetails.eligibility.exclusions.assessment,
  "no_active_revision",
);
const unknownTrace = {
  schemaVersion: "2",
  outcome: "resolved",
  decisionKind: "single_reviewed_candidate",
  inputEvidenceHash: "e".repeat(64),
  catalogManifestVersion: trace.catalogManifestVersion,
  catalogManifestDigest: trace.catalogManifestDigest,
  resolverVersion: trace.resolverVersion,
  winningCandidateKey: "archived_unknown_marker",
  candidates: [
    {
      candidateKey: "archived_unknown_marker",
      maturity: "reviewed",
      score: 80,
      accepted: [{ code: "alias_normalized_match", strength: "strong" }],
      rejected: [],
      missingAxes: [],
      conflicts: [],
      aliasKey: "archived:registry:1",
      aliasMatchType: "normalized",
      aliasLocale: "en",
      aliasLaboratory: null,
      aliasFoldFallback: false,
    },
  ],
  missingAxes: [],
  conflicts: [],
} as const satisfies PersistedResolverDecisionTrace;
const unknownCatalog = readPersistedDecision({
  relation: revision({
    measurement_definition_key: "archived_unknown_marker",
    analyte_key: "archived_unknown_analyte",
    input_evidence_hash: unknownTrace.inputEvidenceHash,
    resolver_decision_trace: unknownTrace,
    resolver_trace_schema_version: unknownTrace.schemaVersion,
    resolver_evidence: {
      version: 2,
      selectedCandidateKey: unknownTrace.winningCandidateKey,
      outcome: unknownTrace.outcome,
      candidates: [{ candidateKey: unknownTrace.winningCandidateKey }],
    },
  }),
  observation: {
    ...observation,
    measurement_definition_key: "archived_unknown_marker",
  },
});
assert.equal(unknownCatalog.source, "persisted");
assert.equal(unknownCatalog.quality, "unavailable");
assert.equal(hasCode(unknownCatalog, "catalog_definition_unavailable"), true);
assert.equal(unknownCatalog.currentCatalog.status, "unavailable");
assert.equal(unknownCatalog.currentBindingReady, false);
assert.equal(
  unknownCatalog.stored.measurementDefinitionKey,
  "archived_unknown_marker",
);

const preview = read(revision({ is_active: false }), resolution);
assert.equal(preview.source, "preview");
assert.equal(preview.quality, "available");
assert.equal(preview.notPersisted, true);
assert.deepEqual(preview.qualityCodes, ["preview_not_persisted"]);
assert.equal(preview.stored.outcome, "resolved");
assert.equal(preview.stored.measurementDefinitionKey, null);
assert.equal(preview.currentBindingReady, false);
assert.equal(preview.preview?.measurementDefinitionKey, "glucose_serum");

const noDecision = read(null);
assert.equal(noDecision.source, "none");
assert.equal(noDecision.quality, "unavailable");
assert.equal(noDecision.notPersisted, false);
assert.deepEqual(noDecision.qualityCodes, ["no_active_revision"]);
assert.equal(noDecision.stored.outcome, null);
assert.equal(noDecision.preview, null);

console.log("verify-historical-persisted-decision-read: all checks passed");
