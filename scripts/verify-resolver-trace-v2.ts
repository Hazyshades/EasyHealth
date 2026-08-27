import assert from "node:assert/strict";

import {
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  RESOLVER_DECISION_TRACE_SCHEMA_VERSION,
  SUPPORTED_RESOLVER_DECISION_TRACE_SCHEMA_VERSIONS,
  buildPersistedResolverDecisionTrace,
  isPersistedResolverDecisionTrace,
  resolveMeasurementDefinition,
  type PersistedResolverDecisionTrace,
  type PersistedResolverDecisionTraceV2,
} from "../src/lib/biomarkers";
import { MEASUREMENT_CATALOG_MANIFEST_DIGEST } from "../src/lib/biomarkers/measurement-registry-release";
import { buildNormalizationReview } from "../src/lib/documents/normalization-review";
import type { NormalizationRevisionSummary } from "../src/lib/documents/normalization-review";
import { buildNormalizationResolutionPayload } from "../src/lib/documents/observation-normalization-writer";

const failures: string[] = [];
function check(name: string, run: () => void): void {
  try {
    run();
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const TRACE_OPTIONS = {
  inputEvidenceHash: "a".repeat(64),
  catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
  catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  resolverVersion: MEASUREMENT_RESOLVER_VERSION,
};

/**
 * A schema-1 trace exactly as it was written before schema 2 existed. Rows like
 * this are already stored against patients; they must keep validating and must
 * never need a backfill.
 */
const STORED_V1_TRACE = {
  schemaVersion: "1",
  outcome: "resolved",
  decisionKind: "single_reviewed_candidate",
  inputEvidenceHash: "b".repeat(64),
  catalogManifestVersion: "2026-08-03.0",
  catalogManifestDigest: "c".repeat(64),
  resolverVersion: "10",
  winningCandidateKey: "alt_serum_catalytic_activity",
  candidates: [
    {
      candidateKey: "alt_serum_catalytic_activity",
      maturity: "reviewed",
      score: 61,
      accepted: [
        { code: "alias_normalized_match", strength: "strong" },
        { code: "unit_compatible", strength: "strong" },
      ],
      rejected: [],
      missingAxes: [],
      conflicts: [],
    },
  ],
  missingAxes: [],
  conflicts: [],
} as const;

// ---------------------------------------------------------------------------
// 1. Schema 1 stays valid; schema 2 is what new decisions write
// ---------------------------------------------------------------------------

check("supported versions are 1 and 2", () => {
  assert.deepEqual([...SUPPORTED_RESOLVER_DECISION_TRACE_SCHEMA_VERSIONS], ["1", "2"]);
  assert.equal(RESOLVER_DECISION_TRACE_SCHEMA_VERSION, "2");
});

check("an already-stored schema-1 trace still validates", () => {
  assert.equal(isPersistedResolverDecisionTrace(STORED_V1_TRACE), true);
});

check("a stored schema-1 trace needs no backfill to remain readable", () => {
  const parsed = STORED_V1_TRACE as unknown as PersistedResolverDecisionTrace;
  assert.equal(parsed.schemaVersion, "1");
  // Reading it must not require any schema-2 field.
  assert.equal("aliasKey" in parsed.candidates[0]!, false);
  assert.equal(isPersistedResolverDecisionTrace(parsed), true);
});

check("new decisions are written as schema 2", () => {
  const resolution = resolveMeasurementDefinition({
    rawLabel: "Гемоглобин",
    rawUnit: "g/L",
    specimen: "whole_blood",
    valueKind: "numeric",
  });
  const trace = buildPersistedResolverDecisionTrace(resolution, TRACE_OPTIONS);
  assert.equal(trace.schemaVersion, "2");
  assert.equal(isPersistedResolverDecisionTrace(trace), true);
});

// ---------------------------------------------------------------------------
// 2. Alias evidence is present, correct and locale-aware
// ---------------------------------------------------------------------------

function traceFor(rawLabel: string, rawUnit: string, specimen: string): PersistedResolverDecisionTraceV2 {
  const resolution = resolveMeasurementDefinition({
    rawLabel,
    rawUnit,
    specimen,
    valueKind: "numeric",
  });
  const trace = buildPersistedResolverDecisionTrace(resolution, TRACE_OPTIONS);
  if (trace.schemaVersion !== "2") throw new Error("expected a schema-2 trace");
  return trace;
}

check("a Russian match records its locale and admitting alias", () => {
  const trace = traceFor("Гемоглобин", "g/L", "whole_blood");
  const winner = trace.candidates.find(
    (candidate) => candidate.candidateKey === trace.winningCandidateKey,
  );
  assert.ok(winner, "the winning candidate is present in the trace");
  assert.equal(winner.aliasLocale, "ru");
  assert.equal(winner.aliasFoldFallback, false);
  assert.ok(winner.aliasKey.length > 0);
  assert.ok(["exact", "normalized", "ocr_variant", "bounded_fuzzy", "token_set"].includes(winner.aliasMatchType));
});

check("a Spanish accent-fold match records the fallback", () => {
  const trace = traceFor("Trigliceridos", "mmol/L", "serum");
  const winner = trace.candidates.find(
    (candidate) => candidate.candidateKey === trace.winningCandidateKey,
  );
  assert.ok(winner, "the winning candidate is present in the trace");
  assert.equal(winner.aliasLocale, "es");
  assert.equal(winner.aliasFoldFallback, true);
});

check("an accented Spanish match does not claim the fallback", () => {
  const trace = traceFor("Triglicéridos", "mmol/L", "serum");
  const winner = trace.candidates.find(
    (candidate) => candidate.candidateKey === trace.winningCandidateKey,
  );
  assert.ok(winner, "the winning candidate is present in the trace");
  assert.equal(winner.aliasLocale, "es");
  assert.equal(winner.aliasFoldFallback, false);
});

check("an English match records locale en", () => {
  const trace = traceFor("ALT (alanine aminotransferase)", "U/L", "serum");
  const winner = trace.candidates.find(
    (candidate) => candidate.candidateKey === trace.winningCandidateKey,
  );
  assert.ok(winner, "the winning candidate is present in the trace");
  assert.equal(winner.aliasLocale, "en");
});

// ---------------------------------------------------------------------------
// 3. Malformed and unsupported traces are rejected
// ---------------------------------------------------------------------------

check("an unsupported schema version is rejected", () => {
  assert.equal(
    isPersistedResolverDecisionTrace({ ...STORED_V1_TRACE, schemaVersion: "3" }),
    false,
  );
});

check("a schema-2 trace missing alias evidence is rejected", () => {
  const trace = traceFor("Гемоглобин", "g/L", "whole_blood");
  const broken = {
    ...trace,
    candidates: trace.candidates.map((candidate) => {
      const { aliasLocale: _dropped, ...rest } = candidate;
      return rest;
    }),
  };
  assert.equal(isPersistedResolverDecisionTrace(broken), false);
});

check("a schema-1 trace carrying alias evidence is rejected", () => {
  const broken = {
    ...STORED_V1_TRACE,
    candidates: STORED_V1_TRACE.candidates.map((candidate) => ({
      ...candidate,
      aliasKey: "smuggled:alias:1",
      aliasMatchType: "normalized",
      aliasLocale: "ru",
      aliasLaboratory: null,
      aliasFoldFallback: false,
    })),
  };
  assert.equal(isPersistedResolverDecisionTrace(broken), false);
});

check("an unsupported alias locale is rejected", () => {
  const trace = traceFor("Гемоглобин", "g/L", "whole_blood");
  const broken = {
    ...trace,
    candidates: trace.candidates.map((candidate) => ({ ...candidate, aliasLocale: "de" })),
  };
  assert.equal(isPersistedResolverDecisionTrace(broken), false);
});

// ---------------------------------------------------------------------------
// 4. One source of truth: trace and resolver_evidence cannot diverge
// ---------------------------------------------------------------------------

check("the writer payload carries consistent alias facts", () => {
  const input = {
    rawLabel: "Гемоглобин",
    rawUnit: "g/L",
    specimen: "whole_blood",
    valueKind: "numeric" as const,
  };
  const resolution = resolveMeasurementDefinition(input);
  const payload = buildNormalizationResolutionPayload(input, resolution);
  assert.equal(payload.resolver_trace_schema_version, "2");
  const trace = payload.resolver_decision_trace;
  if (trace.schemaVersion !== "2") throw new Error("expected a schema-2 trace");
  for (const candidate of trace.candidates) {
    const evidence = payload.resolver_evidence.candidates.find(
      (item) => item.candidateKey === candidate.candidateKey,
    );
    assert.ok(evidence, `resolver_evidence has candidate ${candidate.candidateKey}`);
    assert.equal(evidence.matchedAlias.key, candidate.aliasKey);
    assert.equal(evidence.matchedAlias.locale ?? "en", candidate.aliasLocale);
    assert.equal(evidence.matchedAlias.foldFallback === true, candidate.aliasFoldFallback);
  }
});

check("a divergent payload is refused before it reaches the database", () => {
  const input = {
    rawLabel: "Гемоглобин",
    rawUnit: "g/L",
    specimen: "whole_blood",
    valueKind: "numeric" as const,
  };
  const resolution = resolveMeasurementDefinition(input);
  const tampered = {
    ...resolution,
    decisionTrace: {
      ...resolution.decisionTrace,
      candidates: resolution.decisionTrace.candidates.map((candidate) => ({
        ...candidate,
        matchedAlias: { ...candidate.matchedAlias, locale: "es" },
      })),
    },
  };
  assert.throws(
    () => buildNormalizationResolutionPayload(input, tampered),
    /Alias evidence diverges/,
  );
});

// ---------------------------------------------------------------------------
// 5. Readers accept both versions
// ---------------------------------------------------------------------------

const REVIEW_ROW = {
  id: "row-1",
  biomarker_key: "hemoglobin",
  biomarker_name: "Hemoglobin",
  raw_name: "Гемоглобин",
  unit: "g/L",
  raw_unit: "g/L",
  raw_value_text: "142",
  value_kind: "numeric",
  source_text: "Гемоглобин, цельная кровь 142 g/L",
  confidence: 0.9,
  specimen: "whole_blood",
};

function revisionWith(trace: unknown, version: string): NormalizationRevisionSummary {
  return {
    id: "rev-1",
    extracted_biomarker_id: "row-1",
    measurement_definition_key: "hemoglobin_whole_blood",
    analyte_key: "hemoglobin",
    resolver_result: "resolved",
    mapping_confidence: 0.8,
    mapping_confidence_band: "medium",
    verification_status: "user_verified",
    is_active: true,
    catalog_manifest_version: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    resolver_version: MEASUREMENT_RESOLVER_VERSION,
    normalization_version: "7",
    resolver_decision_trace: trace,
    resolver_trace_schema_version: version,
    created_at: "2026-08-10T00:00:00.000Z",
  } as NormalizationRevisionSummary;
}

check("the review reader surfaces a stored schema-1 trace", () => {
  const review = buildNormalizationReview(REVIEW_ROW, [
    revisionWith(STORED_V1_TRACE, "1"),
  ]);
  assert.equal(review.decisionTrace.availability, "persisted");
  assert.equal(review.decisionTrace.trace?.schemaVersion, "1");
});

check("the review reader surfaces a stored schema-2 trace", () => {
  const trace = traceFor("Гемоглобин", "g/L", "whole_blood");
  const review = buildNormalizationReview(REVIEW_ROW, [revisionWith(trace, "2")]);
  assert.equal(review.decisionTrace.availability, "persisted");
  assert.equal(review.decisionTrace.trace?.schemaVersion, "2");
});

check("the review reader rejects a trace whose column version disagrees", () => {
  const trace = traceFor("Гемоглобин", "g/L", "whole_blood");
  const review = buildNormalizationReview(REVIEW_ROW, [revisionWith(trace, "9")]);
  assert.notEqual(review.decisionTrace.availability, "persisted");
  assert.equal(review.decisionTrace.trace, null);
});

if (failures.length > 0) {
  console.error(`verify-resolver-trace-v2: ${failures.length} check(s) failed`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log("verify-resolver-trace-v2: all checks passed");
}
