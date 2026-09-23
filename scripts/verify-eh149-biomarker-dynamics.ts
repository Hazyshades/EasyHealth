import assert from "node:assert/strict";
import { createReportBodySchema } from "../src/lib/report-prompts";
import {
  buildBiomarkerDynamicsReport,
  isCanonicalBiomarkerDynamicsDate,
  parseBiomarkerDynamicsPeriod,
  type AuthorizedBiomarkerComparison,
  type AuthorizedBiomarkerComparisonPoint,
  type AuthorizedBiomarkerComparisonSeries,
  type BiomarkerDynamicsIdentity,
} from "../src/lib/biomarker-dynamics";
import {
  BiomarkerDynamicsAuthorizationError,
  buildAuthorizedBiomarkerComparison,
  type DynamicsObservation,
} from "../src/lib/biomarker-dynamics-server";
import {
  createPersistedBiomarkerDynamicsBinding,
  InvalidPersistedBiomarkerDynamicsError,
  resolvePersistedBiomarkerDynamics,
} from "../src/lib/reports";

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "eh149-test-integrity-key";
}

const UUID = (suffix: string) =>
  `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const PROFILE_DOCUMENT = UUID("1");
const SECOND_DOCUMENT = UUID("2");

const identity = (
  measurementDefinitionKey = "glucose_serum",
  overrides: Partial<BiomarkerDynamicsIdentity> = {},
): BiomarkerDynamicsIdentity => ({
  measurementDefinitionKey,
  analyteKey: "glucose",
  specimen: "serum",
  modifier: "none",
  method: "enzymatic",
  scale: "ratio",
  ...overrides,
});

function point(
  id: string,
  observedAt: string,
  displayValue: number,
  overrides: Partial<AuthorizedBiomarkerComparisonPoint> = {},
): AuthorizedBiomarkerComparisonPoint {
  const documentId = overrides.documentId ?? PROFILE_DOCUMENT;
  const unit = overrides.displayUnit ?? "mmol/L";
  return {
    observationId: UUID(id),
    documentId,
    observedAt,
    nativeValue: displayValue,
    nativeUnit: unit,
    nativeReferenceLow: 3.5,
    nativeReferenceHigh: 6.1,
    displayValue,
    displayUnit: unit,
    displayReferenceLow: 3.5,
    displayReferenceHigh: 6.1,
    conversion: {
      applied: false,
      note: null,
      nativeUnit: unit,
      displayUnit: unit,
    },
    identity: identity(),
    source: {
      documentId,
      filename: `${id}.pdf`,
      laboratory: "Synthetic Lab",
      href: `/app/documents/${documentId}`,
    },
    ...overrides,
  };
}

function series(
  id: string,
  label: string,
  points: readonly AuthorizedBiomarkerComparisonPoint[],
  overrides: Partial<AuthorizedBiomarkerComparisonSeries> = {},
): AuthorizedBiomarkerComparisonSeries {
  const firstPoint = points[0];
  return {
    id,
    label,
    measurementDefinitionKey:
      firstPoint?.identity.measurementDefinitionKey ?? "glucose_serum",
    analyteKey: firstPoint?.identity.analyteKey ?? "glucose",
    displayUnit: firstPoint?.displayUnit ?? "mmol/L",
    nativeUnit: firstPoint?.nativeUnit ?? "mmol/L",
    normalized: false,
    identity: firstPoint?.identity ?? identity(),
    points,
    ...overrides,
  };
}

function comparison(
  seriesItems: readonly AuthorizedBiomarkerComparisonSeries[],
  overrides: Partial<AuthorizedBiomarkerComparison> = {},
): AuthorizedBiomarkerComparison {
  return {
    scopeKind: "profile_current",
    scopeDocumentIds: [PROFILE_DOCUMENT, SECOND_DOCUMENT],
    candidates: [],
    series: seriesItems,
    excluded: [],
    incompatibilities: [],
    generatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

const ordered = buildBiomarkerDynamicsReport(
  comparison([
    series("glucose", "Glucose", [
      point("a", "2026-01-10T10:00:00Z", 5.4),
      point("1", "2026-01-10T10:00:00Z", 5.2),
    ]),
  ]),
);
assert.deepEqual(
  ordered.series[0]?.points.map((item) => item.observationId),
  [UUID("1"), UUID("a")],
  "equal timestamps use canonical UUID byte ordering",
);

const periodReport = buildBiomarkerDynamicsReport(
  comparison([
    series("glucose", "Glucose", [
      point("early", "2026-01-10T23:59:59Z", 5.2),
      point("end", "2026-01-11T00:00:00Z", 5.8),
      point("late", "2026-01-12T00:00:00Z", 9),
    ]),
  ]),
  { start: "2026-01-10", end: "2026-01-11" },
);
assert.equal(periodReport.series[0]?.statistics.pointCount, 2);
assert.equal(periodReport.series[0]?.statistics.minimum, 5.2);
assert.equal(periodReport.series[0]?.statistics.maximum, 5.8);
assert.equal(periodReport.series[0]?.direction, "increasing");
assert.deepEqual(
  periodReport.series[0]?.points.map((item) => item.observationId),
  [UUID("early"), UUID("end")],
  "period boundaries include timestamps anywhere on the end calendar date",
);

const stableReport = buildBiomarkerDynamicsReport(
  comparison([
    series("glucose", "Glucose", [
      point("stable-1", "2026-01-01", 5),
      point("stable-2", "2026-01-02", 5.04),
    ]),
  ]),
);
assert.equal(stableReport.series[0]?.direction, "stable");
assert.equal(
  stableReport.series[0]?.directionTolerance?.policyVersion,
  "eh-149-direction-v1",
);

const onePointReport = buildBiomarkerDynamicsReport(
  comparison([
    series("glucose", "Glucose", [point("single", "2026-01-01", 5)]),
  ]),
);
assert.equal(onePointReport.series[0]?.direction, "not_available");
assert.equal(onePointReport.series[0]?.directionTolerance, null);
assert.equal(
  onePointReport.series[0]?.limitations[0]?.code,
  "comparison_unavailable",
);

const policyUnavailableReport = buildBiomarkerDynamicsReport(
  comparison([
    series(
      "unknown",
      "Unknown measurement",
      [
        point("unknown-1", "2026-01-01", 1, {
          identity: identity("not_in_reviewed_policy"),
        }),
        point("unknown-2", "2026-01-02", 2, {
          identity: identity("not_in_reviewed_policy"),
        }),
      ],
      {
        measurementDefinitionKey: "not_in_reviewed_policy",
        identity: identity("not_in_reviewed_policy"),
      },
    ),
  ]),
);
assert.equal(policyUnavailableReport.series[0]?.direction, "not_available");
assert.equal(
  policyUnavailableReport.series[0]?.limitations[0]?.code,
  "direction_policy_unavailable",
);

const incompatibleReport = buildBiomarkerDynamicsReport(
  comparison([
    series("glucose-a", "Glucose", [point("compat-a", "2026-01-01", 5)], {
      measurementDefinitionKey: "glucose_serum",
    }),
    series(
      "glucose-b",
      "Glucose",
      [
        point("compat-b", "2026-01-01", 5, {
          identity: identity("different_glucose_definition"),
        }),
      ],
      {
        measurementDefinitionKey: "different_glucose_definition",
        identity: identity("different_glucose_definition"),
      },
    ),
  ]),
);
assert.equal(
  incompatibleReport.incompatibilities[0]?.reason,
  "measurement_definition",
);

const identityAxisFixtures: Array<
  readonly [
    "measurementDefinitionKey" | "specimen" | "modifier" | "method" | "scale",
    string,
  ]
> = [
  ["measurementDefinitionKey", "different_definition"],
  ["specimen", "plasma"],
  ["modifier", "post_prandial"],
  ["method", "mass_spectrometry"],
  ["scale", "ordinal"],
];
for (const [axis, value] of identityAxisFixtures) {
  const leftIdentity = identity("axis_left");
  const rightIdentity = {
    ...identity("axis_left"),
    [axis]: value,
  } as BiomarkerDynamicsIdentity;
  const axisReport = buildBiomarkerDynamicsReport(
    comparison([
      series(
        "axis-left",
        "Axis fixture",
        [
          point(`axis-left-${axis}`, "2026-01-01", 1, {
            identity: leftIdentity,
          }),
        ],
        { identity: leftIdentity },
      ),
      series(
        "axis-right",
        "Axis fixture",
        [
          point(`axis-right-${axis}`, "2026-01-01", 1, {
            identity: rightIdentity,
          }),
        ],
        {
          identity: rightIdentity,
          measurementDefinitionKey: rightIdentity.measurementDefinitionKey,
        },
      ),
    ]),
  );
  assert.equal(
    axisReport.incompatibilities[0]?.reason,
    axis === "measurementDefinitionKey" ? "measurement_definition" : axis,
    `identity axis ${axis} stays separate`,
  );
}

const unitReport = buildBiomarkerDynamicsReport(
  comparison([
    series("unit-left", "Unit fixture", [point("unit-left", "2026-01-01", 1)]),
    series("unit-right", "Unit fixture", [
      point("unit-right", "2026-01-01", 1, { displayUnit: "mg/dL" }),
    ]),
  ]),
);
assert.equal(unitReport.incompatibilities[0]?.reason, "unit");

const excludedReport = buildBiomarkerDynamicsReport(
  comparison(
    [series("glucose", "Glucose", [point("valid", "2026-01-01", 5)])],
    {
      excluded: [
        {
          observationId: UUID("qualitative"),
          documentId: PROFILE_DOCUMENT,
          label: "Glucose",
          reason: "non_numeric",
          detail: "Qualitative fixture",
          identity: identity(),
          unit: null,
        },
        {
          observationId: UUID("undated"),
          documentId: PROFILE_DOCUMENT,
          label: "Glucose",
          reason: "undated",
          detail: "Undated fixture",
          identity: identity(),
          unit: null,
        },
        {
          observationId: UUID("ineligible"),
          documentId: PROFILE_DOCUMENT,
          label: "Glucose",
          reason: "ineligible",
          detail: "Ineligible fixture",
          identity: identity(),
          unit: null,
        },
        {
          observationId: UUID("unsupported"),
          documentId: PROFILE_DOCUMENT,
          label: "Glucose",
          reason: "unsupported_unit",
          detail: "Unsafe conversion fixture",
          identity: identity(),
          unit: null,
        },
      ],
    },
  ),
);
assert.deepEqual(
  new Set(excludedReport.limitations.map((item) => item.code)),
  new Set(["non_numeric", "undated", "ineligible", "unsupported_unit"]),
);
const plasmaIdentity = identity("glucose_plasma", { specimen: "plasma" });
const scopedExclusionReport = buildBiomarkerDynamicsReport(
  comparison(
    [
      series("scoped-serum", "Glucose", [
        point("scoped-serum-point", "2026-01-01", 5),
      ]),
      series(
        "scoped-plasma",
        "Glucose",
        [
          point("scoped-plasma-point", "2026-01-01", 5, {
            identity: plasmaIdentity,
          }),
        ],
        { identity: plasmaIdentity },
      ),
    ],
    {
      excluded: [
        {
          observationId: UUID("scoped-excluded"),
          documentId: PROFILE_DOCUMENT,
          label: "Glucose",
          reason: "undated",
          detail: "Scoped exclusion fixture",
          identity: identity(),
          unit: "mmol/L",
        },
      ],
    },
  ),
);
assert.equal(
  scopedExclusionReport.series
    .find((item) => item.id === "scoped-serum")
    ?.limitations.some((item) => item.code === "undated"),
  true,
);
assert.equal(
  scopedExclusionReport.series
    .find((item) => item.id === "scoped-plasma")
    ?.limitations.some((item) => item.code === "undated"),
  false,
);

assert.equal(isCanonicalBiomarkerDynamicsDate("2026-02-28"), true);
assert.equal(isCanonicalBiomarkerDynamicsDate("2026-02-29"), false);
assert.throws(
  () =>
    parseBiomarkerDynamicsPeriod({ start: "2026-02-02", end: "2026-02-01" }),
  /canonical dates/,
);
assert.throws(
  () =>
    parseBiomarkerDynamicsPeriod({ start: "2026-02-30", end: "2026-03-01" }),
  /canonical dates/,
);

const validReportRequest = createReportBodySchema.safeParse({
  title: "Synthetic dynamics report",
  report_type: "general_practice",
  detail_level: "standard",
  document_ids: null,
  biomarker_dynamics_period: { start: "2026-01-01", end: "2026-01-31" },
});
assert.equal(validReportRequest.success, true);
const invalidReportRequest = createReportBodySchema.safeParse({
  title: "Synthetic dynamics report",
  report_type: "general_practice",
  detail_level: "standard",
  biomarker_dynamics_period: { start: "2026-02-02", end: "2026-02-01" },
});
assert.equal(invalidReportRequest.success, false);

const outOfScopeObservation = {
  id: UUID("out-of-scope"),
  observation_kind: "lab",
  analyte_key: "glucose",
  measurement_definition_key: "glucose_serum",
  resolution_status: "resolved",
  name: "Glucose",
  value: 5,
  unit: "mmol/L",
  ref_low: 3.5,
  ref_high: 6.1,
  observed_at: "2026-01-01",
  document_id: SECOND_DOCUMENT,
  value_kind: "numeric",
  value_text: null,
  raw_reference_text: null,
  specimen: "serum",
  modifier: "none",
  documents: {
    id: SECOND_DOCUMENT,
    original_filename: "outside.pdf",
    archived_at: null,
  },
  source_extracted_biomarker: null,
  normalization_revision: null,
} satisfies DynamicsObservation;
assert.throws(
  () =>
    buildAuthorizedBiomarkerComparison({
      observations: [outOfScopeObservation],
      scopeKind: "report_immutable",
      scopeDocumentIds: [PROFILE_DOCUMENT],
      unitSystem: "si",
      generatedAt: "2026-02-01T00:00:00.000Z",
    }),
  (error: unknown) => error instanceof BiomarkerDynamicsAuthorizationError,
);
const mismatchedSourceObservation: DynamicsObservation = {
  ...outOfScopeObservation,
  document_id: PROFILE_DOCUMENT,
};
assert.throws(
  () =>
    buildAuthorizedBiomarkerComparison({
      observations: [mismatchedSourceObservation],
      scopeKind: "profile_current",
      scopeDocumentIds: [PROFILE_DOCUMENT],
      unitSystem: "si",
      generatedAt: "2026-02-01T00:00:00.000Z",
    }),
  (error: unknown) => error instanceof BiomarkerDynamicsAuthorizationError,
);

const inScopeObservation: DynamicsObservation = {
  ...outOfScopeObservation,
  document_id: PROFILE_DOCUMENT,
  documents: {
    id: PROFILE_DOCUMENT,
    original_filename: "inside.pdf",
    archived_at: null,
  },
};
const profileCurrentComparison = buildAuthorizedBiomarkerComparison({
  observations: [inScopeObservation],
  scopeKind: "profile_current",
  scopeDocumentIds: [PROFILE_DOCUMENT],
  unitSystem: "si",
  generatedAt: "2026-02-01T00:00:00.000Z",
});
assert.deepEqual(profileCurrentComparison.scopeDocumentIds, [PROFILE_DOCUMENT]);
const immutableComparison = buildAuthorizedBiomarkerComparison({
  observations: [inScopeObservation],
  scopeKind: "report_immutable",
  scopeDocumentIds: [PROFILE_DOCUMENT],
  unitSystem: "si",
  generatedAt: "2026-02-01T00:00:00.000Z",
});
assert.deepEqual(immutableComparison.scopeDocumentIds, [PROFILE_DOCUMENT]);

const immutable = buildBiomarkerDynamicsReport(
  comparison([series("glucose", "Glucose", [point("3", "2026-01-01", 5)])], {
    scopeKind: "report_immutable",
    scopeDocumentIds: [PROFILE_DOCUMENT],
    excluded: [
      {
        observationId: UUID("4"),
        documentId: PROFILE_DOCUMENT,
        label: "Glucose",
        reason: "non_numeric",
        detail: "Synthetic non-numeric exclusion",
        identity: identity(),
        unit: "mmol/L",
      },
    ],
  }),
  { start: "2026-01-01", end: "2026-01-31" },
);
const binding = createPersistedBiomarkerDynamicsBinding(immutable);
assert.deepEqual(
  resolvePersistedBiomarkerDynamics({ biomarker_dynamics: binding }),
  binding,
);

const currentIntegrityKeyId = process.env.BIOMARKER_DYNAMICS_INTEGRITY_KEY_ID;
const previousIntegrityKeyId =
  process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_KEY_ID;
const previousIntegritySecret =
  process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_SECRET;
process.env.BIOMARKER_DYNAMICS_INTEGRITY_KEY_ID = "service-role-v2";
process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_KEY_ID =
  binding.integrity_key_id;
process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.deepEqual(
  resolvePersistedBiomarkerDynamics({ biomarker_dynamics: binding }),
  binding,
  "previous integrity keys remain valid during rotation",
);
if (currentIntegrityKeyId === undefined) {
  delete process.env.BIOMARKER_DYNAMICS_INTEGRITY_KEY_ID;
} else {
  process.env.BIOMARKER_DYNAMICS_INTEGRITY_KEY_ID = currentIntegrityKeyId;
}
if (previousIntegrityKeyId === undefined) {
  delete process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_KEY_ID;
} else {
  process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_KEY_ID =
    previousIntegrityKeyId;
}
if (previousIntegritySecret === undefined) {
  delete process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_SECRET;
} else {
  process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_SECRET =
    previousIntegritySecret;
}

const tamperedLimitations = structuredClone(binding) as Record<string, unknown>;
const limitationsDto = tamperedLimitations.dto as Record<string, unknown>;
limitationsDto.limitations = [];
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({
      biomarker_dynamics: tamperedLimitations,
    }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);

const tamperedScope = structuredClone(binding) as Record<string, unknown>;
tamperedScope.report_scope_document_ids = [SECOND_DOCUMENT];
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({ biomarker_dynamics: tamperedScope }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);

const tamperedPoint = structuredClone(binding) as Record<string, unknown>;
const tamperedDto = tamperedPoint.dto as Record<string, unknown>;
const tamperedSeries = tamperedDto.series as Array<Record<string, unknown>>;
const tamperedPoints = tamperedSeries[0]?.points as Array<
  Record<string, unknown>
>;
if (!tamperedPoints?.[0]) throw new Error("Fixture point missing");
tamperedPoints[0].documentId = SECOND_DOCUMENT;
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({ biomarker_dynamics: tamperedPoint }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);
const tamperedObservedAt = structuredClone(binding) as Record<string, unknown>;
const observedAtDto = tamperedObservedAt.dto as Record<string, unknown>;
const observedAtSeries = observedAtDto.series as Array<Record<string, unknown>>;
const observedAtPoints = observedAtSeries[0]?.points as Array<
  Record<string, unknown>
>;
if (!observedAtPoints?.[0]) throw new Error("Fixture date point missing");
observedAtPoints[0].observedAt = "not-a-date";
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({
      biomarker_dynamics: tamperedObservedAt,
    }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);

const tamperedCalendarDate = structuredClone(binding) as Record<
  string,
  unknown
>;
const calendarDateDto = tamperedCalendarDate.dto as Record<string, unknown>;
const calendarDateSeries = calendarDateDto.series as Array<
  Record<string, unknown>
>;
const calendarDatePoints = calendarDateSeries[0]?.points as Array<
  Record<string, unknown>
>;
if (!calendarDatePoints?.[0]) throw new Error("Fixture calendar point missing");
calendarDatePoints[0].observedAt = "2026-02-30";
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({
      biomarker_dynamics: tamperedCalendarDate,
    }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);

const tamperedSource = structuredClone(binding) as Record<string, unknown>;
const sourceDto = tamperedSource.dto as Record<string, unknown>;
const sourceSeries = sourceDto.series as Array<Record<string, unknown>>;
if (!sourceSeries[0]) throw new Error("Fixture source series missing");
sourceSeries[0].label = "Forged source label";
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({
      biomarker_dynamics: tamperedSource,
    }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);
const missingDtoCollections = structuredClone(binding) as Record<
  string,
  unknown
>;
const missingDto = missingDtoCollections.dto as Record<string, unknown>;
delete missingDto.incompatibilities;
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({
      biomarker_dynamics: missingDtoCollections,
    }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);
const tamperedStatistics = structuredClone(binding) as Record<string, unknown>;
const statisticsDto = tamperedStatistics.dto as Record<string, unknown>;
const statisticsSeries = statisticsDto.series as Array<Record<string, unknown>>;
if (!statisticsSeries[0]?.statistics) {
  throw new Error("Fixture statistics missing");
}
const statistics = statisticsSeries[0].statistics as Record<string, unknown>;
statistics.minimum = 999;
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({
      biomarker_dynamics: tamperedStatistics,
    }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);

const tamperedDirection = structuredClone(binding) as Record<string, unknown>;
const directionDto = tamperedDirection.dto as Record<string, unknown>;
const directionSeries = directionDto.series as Array<Record<string, unknown>>;
if (!directionSeries[0]) throw new Error("Fixture direction missing");
directionSeries[0].direction = "increasing";
assert.throws(
  () =>
    resolvePersistedBiomarkerDynamics({
      biomarker_dynamics: tamperedDirection,
    }),
  (error: unknown) => error instanceof InvalidPersistedBiomarkerDynamicsError,
);

console.log("verify-eh149-biomarker-dynamics: all checks passed");
