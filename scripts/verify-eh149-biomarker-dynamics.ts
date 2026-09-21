import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAuthorizedBiomarkerComparison,
  buildBiomarkerDynamicsReport,
  buildFrozenBiomarkerDynamicsExtension,
  resolvePersistedBiomarkerDynamicsExtension,
  validatePeriod,
  type AuthorizedBiomarkerComparison,
  type AuthorizedComparisonObservation,
} from "../src/lib/biomarker-dynamics";
import {
  clearAllDirectionTolerances,
  compareCanonicalObservationId,
  setDirectionTolerance,
} from "../src/lib/biomarker-dynamics-policy";

const UUID = (suffix: string) =>
  `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

function obs(
  idSuffix: string,
  overrides: Partial<AuthorizedComparisonObservation> = {},
): AuthorizedComparisonObservation {
  const id = overrides.id ?? UUID(idSuffix);
  const documentId = overrides.documentId ?? UUID(`d${idSuffix}`);
  return {
    name: "Glucose",
    value: 5.5,
    unit: "mmol/L",
    originalValue: 99,
    originalUnit: "mg/dL",
    refLow: 3.5,
    refHigh: 6.1,
    originalRefLow: 70,
    originalRefHigh: 110,
    observedAt: "2025-02-15",
    documents: {
      id: documentId,
      original_filename: `${idSuffix}.pdf`,
      lab_name: "Synthetic Lab",
    },
    valueKind: "numeric",
    converted: true,
    conversionEligible: true,
    trendEligible: true,
    specimen: "serum",
    modifier: "none",
    method: "automated",
    scale: "quantitative",
    measurementDefinitionKey: "glucose_serum",
    ...overrides,
    id,
    documentId,
  };
}

function comparison(
  overrides: Partial<AuthorizedBiomarkerComparison> = {},
): AuthorizedBiomarkerComparison {
  const documentIds = [UUID("d1"), UUID("d2")];
  return {
    scope_kind: "profile_current",
    scope_document_ids: documentIds,
    series: [
      {
        id: "glucose_serum::mmol/l::__shared__::serum::none::automated::quantitative",
        measurementDefinitionKey: "glucose_serum",
        name: "Glucose · mmol/L",
        specimen: "serum",
        modifier: "none",
        method: "automated",
        scale: "quantitative",
        observations: [
          obs("1", {
            documentId: documentIds[0],
            observedAt: "2025-01-01",
            value: 5.0,
            originalValue: 90,
          }),
          obs("2", {
            documentId: documentIds[0],
            observedAt: "2025-02-15",
            value: 5.5,
            originalValue: 99,
          }),
          obs("3", {
            documentId: documentIds[1],
            observedAt: "2025-03-31T23:59:59.000Z",
            value: 6.0,
            originalValue: 108,
          }),
          obs("4", {
            documentId: documentIds[1],
            observedAt: "2025-04-01",
            value: 7.0,
            originalValue: 126,
          }),
        ],
      },
    ],
    excluded: [],
    incompatibilities: [],
    ...overrides,
  };
}

clearAllDirectionTolerances();

// ── Period validation ───────────────────────────────────────────────────
assert.equal(validatePeriod(null, null).valid, true);
assert.equal(validatePeriod("2025-01-01", "2025-03-31").valid, true);
assert.equal(validatePeriod("2025-01-01T00:00:00Z", "2025-03-31").valid, false);
assert.equal(validatePeriod("2025-03-31", "2025-01-01").valid, false);
assert.equal(validatePeriod("2025-01-01", null).valid, false);
assert.equal(validatePeriod("2025-02-30", "2025-03-01").valid, false);

// ── Inclusive period + end-of-day timestamp ─────────────────────────────
const periodReport = buildBiomarkerDynamicsReport(comparison(), {
  start: "2025-01-01",
  end: "2025-03-31",
});
assert.equal(periodReport.series[0]?.statistics.pointCount, 3);
assert.deepEqual(
  periodReport.series[0]?.points.map((p) => p.id),
  [UUID("1"), UUID("2"), UUID("3")],
);
assert.equal(periodReport.series[0]?.statistics.min, 5);
assert.equal(periodReport.series[0]?.statistics.max, 6);
assert.equal(periodReport.series[0]?.statistics.latest?.displayValue, 6);

assert.throws(
  () =>
    buildBiomarkerDynamicsReport(comparison(), {
      start: "2025-03-31",
      end: "2025-01-01",
    }),
  /Invalid period/,
);

// ── Equal timestamps use canonical observation-ID order ─────────────────
const tieLeft = UUID("aaaa");
const tieRight = UUID("bbbb");
assert.ok(compareCanonicalObservationId(tieLeft, tieRight) < 0);
const tied = buildBiomarkerDynamicsReport(
  comparison({
    series: [
      {
        id: "glucose_serum::mmol/l::__shared__::serum::none::automated::quantitative",
        measurementDefinitionKey: "glucose_serum",
        name: "Glucose · mmol/L",
        specimen: "serum",
        modifier: "none",
        method: "automated",
        scale: "quantitative",
        observations: [
          obs("bbbb", {
            id: tieRight,
            documentId: UUID("d1"),
            observedAt: "2025-02-15T12:00:00.000Z",
            value: 8,
          }),
          obs("aaaa", {
            id: tieLeft,
            documentId: UUID("d1"),
            observedAt: "2025-02-15T12:00:00.000Z",
            value: 4,
          }),
        ],
      },
    ],
  }),
  { start: "2025-01-01", end: "2025-12-31" },
);
assert.deepEqual(
  tied.series[0]?.points.map((p) => p.id),
  [tieLeft, tieRight],
);
assert.equal(tied.series[0]?.statistics.latest?.id, tieRight);

// ── Direction with reviewed tolerance ───────────────────────────────────
setDirectionTolerance("glucose_serum", "mmol/L", {
  absolute: 0.2,
  relative: 0.05,
});
const directed = buildBiomarkerDynamicsReport(comparison(), {
  start: "2025-01-01",
  end: "2025-03-31",
});
assert.equal(directed.series[0]?.direction.value, "increasing");
assert.ok(directed.series[0]?.tolerance);

const stable = buildBiomarkerDynamicsReport(
  comparison({
    series: [
      {
        id: "glucose_serum::mmol/l::__shared__::serum::none::automated::quantitative",
        measurementDefinitionKey: "glucose_serum",
        name: "Glucose · mmol/L",
        specimen: "serum",
        modifier: "none",
        method: "automated",
        scale: "quantitative",
        observations: [
          obs("10", {
            documentId: UUID("d1"),
            observedAt: "2025-01-01",
            value: 5.0,
          }),
          obs("11", {
            documentId: UUID("d1"),
            observedAt: "2025-02-01",
            value: 5.1,
          }),
        ],
      },
    ],
  }),
  { start: "2025-01-01", end: "2025-12-31" },
);
assert.equal(stable.series[0]?.direction.value, "stable");

clearAllDirectionTolerances();
const noPolicy = buildBiomarkerDynamicsReport(comparison(), {
  start: "2025-01-01",
  end: "2025-03-31",
});
assert.equal(noPolicy.series[0]?.direction.value, "not_available");
assert.equal(
  noPolicy.series[0]?.direction.limitation?.type,
  "tolerance_unavailable",
);

// ── One-point / empty comparison ────────────────────────────────────────
const onePoint = buildBiomarkerDynamicsReport(
  comparison({
    series: [
      {
        id: "glucose_serum::mmol/l::__shared__::serum::none::automated::quantitative",
        measurementDefinitionKey: "glucose_serum",
        name: "Glucose · mmol/L",
        specimen: "serum",
        modifier: "none",
        method: "automated",
        scale: "quantitative",
        observations: [
          obs("20", {
            documentId: UUID("d1"),
            observedAt: "2025-02-01",
            value: 5.2,
          }),
        ],
      },
    ],
  }),
  { start: "2025-01-01", end: "2025-12-31" },
);
assert.equal(onePoint.series[0]?.direction.value, "not_available");
assert.equal(
  onePoint.series[0]?.direction.limitation?.type,
  "comparison_unavailable",
);
assert.equal(onePoint.series[0]?.statistics.pointCount, 1);

// ── Exclusions and incompatibilities ────────────────────────────────────
const withExclusions = buildBiomarkerDynamicsReport(
  comparison({
    excluded: [
      {
        observationId: UUID("90"),
        reason: "undated",
        message: "Observation has no observed date",
      },
      {
        observationId: UUID("91"),
        reason: "non_numeric",
        message: "Observation value is not numeric",
      },
      {
        observationId: UUID("92"),
        reason: "ineligible",
        message: "Observation is not trend eligible",
      },
      {
        observationId: UUID("93"),
        reason: "unsupported_unit",
        message: "Observation has an unsupported unit",
      },
    ],
    incompatibilities: [
      {
        groupingReason: "Same display name has incompatible identity: specimen",
        affectedLabels: ["Glucose · mmol/L", "Glucose · mg/dL"],
      },
    ],
  }),
  { start: "2025-01-01", end: "2025-03-31" },
);
assert.equal(withExclusions.limitations.length, 4);
assert.equal(withExclusions.incompatibilities.length, 1);

// ── Scope excludes another owned document ───────────────────────────────
const scopedDoc = UUID("d1");
const otherDoc = UUID("d2");
const scoped = buildBiomarkerDynamicsReport(
  comparison({
    scope_kind: "report_immutable",
    scope_document_ids: [scopedDoc],
    series: [
      {
        id: "glucose_serum::mmol/l::__shared__::serum::none::automated::quantitative",
        measurementDefinitionKey: "glucose_serum",
        name: "Glucose · mmol/L",
        specimen: "serum",
        modifier: "none",
        method: "automated",
        scale: "quantitative",
        observations: [
          obs("30", {
            documentId: scopedDoc,
            observedAt: "2025-02-01",
            value: 5.0,
          }),
          obs("31", {
            documentId: otherDoc,
            observedAt: "2025-02-10",
            value: 9.0,
          }),
        ],
      },
    ],
  }),
  { start: "2025-01-01", end: "2025-12-31" },
);
assert.equal(scoped.series[0]?.statistics.pointCount, 1);
assert.equal(scoped.series[0]?.points[0]?.documentId, scopedDoc);
assert.ok(
  scoped.limitations.some((item) => item.type === "scope_excluded"),
);

// ── Provenance retained on points ───────────────────────────────────────
const point = periodReport.series[0]?.points[0];
assert.ok(point);
assert.equal(point.nativeValue, 90);
assert.equal(point.nativeUnit, "mg/dL");
assert.equal(point.nativeReferenceLow, 70);
assert.ok(point.conversionMetadata?.converted);
assert.ok(point.source?.href.startsWith("/app/documents/"));

// ── Adapter grouping: incompatible units / identity ─────────────────────
const grouped = buildAuthorizedBiomarkerComparison(
  [
    {
      id: UUID("40"),
      name: "Free T4",
      measurement_definition_key: "free_t4_serum",
      value: 1.2,
      unit: "ng/dL",
      ref_low: null,
      ref_high: null,
      observed_at: "2025-02-01",
      document_id: UUID("d1"),
      documents: {
        id: UUID("d1"),
        original_filename: "a.pdf",
        lab_name: null,
      },
      value_kind: "numeric",
      value_text: "1.2",
      converted: false,
      original_value: 1.2,
      original_unit: "ng/dL",
      original_ref_low: null,
      original_ref_high: null,
      trend_eligible: true,
      conversion_eligible: false,
      registry_binding_ready: true,
      specimen: "serum",
      modifier: "none",
      method: "automated",
      scale: "quantitative",
    },
    {
      id: UUID("41"),
      name: "Free T4",
      measurement_definition_key: "free_t4_serum",
      value: 15,
      unit: "pmol/L",
      ref_low: null,
      ref_high: null,
      observed_at: "2025-02-10",
      document_id: UUID("d1"),
      documents: {
        id: UUID("d1"),
        original_filename: "a.pdf",
        lab_name: null,
      },
      value_kind: "numeric",
      value_text: "15",
      converted: false,
      original_value: 15,
      original_unit: "pmol/L",
      original_ref_low: null,
      original_ref_high: null,
      trend_eligible: true,
      conversion_eligible: false,
      registry_binding_ready: true,
      specimen: "serum",
      modifier: "none",
      method: "automated",
      scale: "quantitative",
    },
    {
      id: UUID("42"),
      name: "Glucose",
      measurement_definition_key: "glucose_serum",
      value: null,
      unit: "",
      ref_low: null,
      ref_high: null,
      observed_at: "2025-02-01",
      document_id: UUID("d1"),
      documents: null,
      value_kind: "qualitative",
      value_text: "positive",
      converted: false,
      original_value: null,
      original_unit: null,
      original_ref_low: null,
      original_ref_high: null,
      trend_eligible: true,
      conversion_eligible: false,
      registry_binding_ready: true,
      specimen: "serum",
      modifier: "none",
      method: "automated",
      scale: "quantitative",
    },
    {
      id: UUID("43"),
      name: "Glucose",
      measurement_definition_key: "glucose_serum",
      value: 5.1,
      unit: "mmol/L",
      ref_low: null,
      ref_high: null,
      observed_at: null,
      document_id: UUID("d1"),
      documents: null,
      value_kind: "numeric",
      value_text: "5.1",
      converted: false,
      original_value: 5.1,
      original_unit: "mmol/L",
      original_ref_low: null,
      original_ref_high: null,
      trend_eligible: true,
      conversion_eligible: true,
      registry_binding_ready: true,
      specimen: "serum",
      modifier: "none",
      method: "automated",
      scale: "quantitative",
    },
  ],
  "profile_current",
  [UUID("d1")],
);
assert.equal(grouped.series.length, 2, "incompatible units stay separate");
assert.ok(grouped.incompatibilities.length >= 1);
assert.ok(grouped.excluded.some((item) => item.reason === "undated"));
assert.ok(grouped.excluded.some((item) => item.reason === "non_numeric"));

// ── Frozen extension + fail-closed reader ───────────────────────────────
setDirectionTolerance("glucose_serum", "mmol/L", {
  absolute: 0.1,
  relative: 0,
});
const reportForFreeze = buildBiomarkerDynamicsReport(
  comparison({
    scope_kind: "report_immutable",
    scope_document_ids: [UUID("d1")],
  }),
  { start: "2025-01-01", end: "2025-03-31" },
);
const frozen = buildFrozenBiomarkerDynamicsExtension(
  reportForFreeze,
  { start: "2025-01-01", end: "2025-03-31" },
  [UUID("d1")],
);
const ok = resolvePersistedBiomarkerDynamicsExtension(frozen, [UUID("d1")]);
assert.equal(ok.ok, true);

assert.equal(
  resolvePersistedBiomarkerDynamicsExtension(null).ok,
  false,
  "missing extension fails closed",
);
assert.equal(
  resolvePersistedBiomarkerDynamicsExtension({
    ...frozen,
    schemaVersion: "999",
  }).ok,
  false,
  "tampered schema fails closed",
);
assert.equal(
  resolvePersistedBiomarkerDynamicsExtension({
    ...frozen,
    directionPolicyVersion: "999",
  }).ok,
  false,
  "tampered policy fails closed",
);
assert.equal(
  resolvePersistedBiomarkerDynamicsExtension({
    ...frozen,
    biomarker_dynamics_period: { start: "2024-01-01", end: "2024-01-02" },
    report: {
      ...frozen.report,
      series: [
        {
          ...frozen.report.series[0]!,
          points: [
            {
              ...frozen.report.series[0]!.points[0]!,
              documentId: UUID("outsider"),
            },
          ],
        },
      ],
    },
  }).ok,
  false,
  "out-of-scope frozen point fails closed",
);
assert.equal(
  resolvePersistedBiomarkerDynamicsExtension(frozen, [UUID("d1"), UUID("d2")])
    .ok,
  false,
  "scope mismatch fails closed",
);

// ── Static integration contracts ────────────────────────────────────────
const apiRoute = readFileSync("src/app/api/biomarkers/dynamics/route.ts", "utf8");
assert.match(apiRoute, /getAuthorizedBiomarkerDynamics/);
assert.match(apiRoute, /profile_current/);
assert.doesNotMatch(apiRoute, /observations:\s*body/);

const page = readFileSync(
  "src/app/app/biomarkers/biomarkers-page-client.tsx",
  "utf8",
);
assert.match(page, /\/api\/biomarkers\/dynamics/);
assert.doesNotMatch(page, /buildMeasurementComparisonSeries/);
assert.doesNotMatch(page, /filterMeasurementComparisonSeries/);
assert.match(page, /DIRECTION_LABELS/);
assert.match(page, /Source ledger/);
assert.match(page, /Incompatible series kept separate/);

const reportsRoute = readFileSync("src/app/api/reports/route.ts", "utf8");
assert.match(reportsRoute, /getFrozenBiomarkerDynamicsForReport/);
assert.match(reportsRoute, /biomarker_dynamics_period/);
assert.match(reportsRoute, /biomarker_dynamics/);

const server = readFileSync("src/lib/biomarker-dynamics-server.ts", "utf8");
assert.match(server, /report_immutable/);
assert.match(server, /presentObservation/);
assert.match(server, /projectLaboratoryOutcome/);

console.log("verify-eh149-biomarker-dynamics: all checks passed");
