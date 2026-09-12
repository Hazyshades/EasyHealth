import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getReviewedAssessmentBinding } from "../src/lib/biomarkers";
import {
  projectLaboratoryOutcome,
  type LaboratoryOutcomeSummary,
} from "../src/lib/documents/incomplete-laboratory-outcomes";
import {
  projectHealthProfileLaboratoryAdmission,
  type HealthProfileLaboratoryAdmission,
  type HealthProfileLaboratoryInput,
} from "../src/lib/health-profile-input";
import { getRegistryV2System } from "../src/lib/biomarkers/registry-v2-runtime";
import type { RegistryV2NormalizationRevisionReadBoundary } from "../src/lib/documents/observation-read-boundaries";
import { hashHealthProfileSnapshotInput } from "../src/lib/health-profile-snapshot-canonical";
import {
  projectHealthProfileReportedResults,
  type HealthProfileReportedResults,
  type ReportedResultProjectionRow,
} from "../src/lib/health-profile-reported-results";
import { HEALTH_PROFILE_FRESHNESS_POLICY } from "../src/lib/health-profile-freshness";
import { getMarkerStatus } from "../src/lib/health-profile-marker-status";
import type {
  HealthProfileSource,
  ScoreExclusion,
} from "../src/lib/health-systems";

const INPUT_PATH = new URL(
  "./fixtures/health-profile-admission-baseline.input.json",
  import.meta.url,
);
const EXPECTED_PATH = new URL(
  "./fixtures/health-profile-admission-baseline.expected.json",
  import.meta.url,
);

type FixtureObservation = Parameters<
  typeof projectHealthProfileLaboratoryAdmission
>[0]["observation"] & {
  id: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  relation:
    | RegistryV2NormalizationRevisionReadBoundary
    | readonly RegistryV2NormalizationRevisionReadBoundary[]
    | null;
};

type FixtureExtractedRow = {
  id: string;
  document_id: string;
  linkedObservationId: string | null;
  biomarker_key: string | null;
  biomarker_name: string;
  value_numeric: number | string | null;
  value_text: string | null;
  value_kind: string | null;
  ordinal: number | null;
  unit: string | null;
  raw_unit: string | null;
  reference_range: string | null;
  raw_reference_range: string | null;
  record_status: string | null;
  is_current: boolean | null;
  is_published: boolean | null;
  measurement_definition_key: string | null;
  relation:
    | RegistryV2NormalizationRevisionReadBoundary
    | readonly RegistryV2NormalizationRevisionReadBoundary[]
    | null;
};

type Fixture = {
  fixtureVersion: string;
  labUnitSystem: "us" | "si";
  freshnessAsOf: string;
  freshnessEvaluatedAt: string;
  sources: HealthProfileSource[];
  observations: FixtureObservation[];
  extractedRows: FixtureExtractedRow[];
};

type BaselineReportedResultRow = {
  id: string;
  document_id: string;
  outcome: LaboratoryOutcomeSummary["outcome"];
  assessment_exclusion: LaboratoryOutcomeSummary["resolutionDetails"]["eligibility"]["exclusions"]["assessment"];
  incomplete_reason: LaboratoryOutcomeSummary["resolutionDetails"]["incompleteReason"];
  ready_for_scoring: boolean;
};

type BaselineExpected = {
  fixtureVersion: string;
  freshnessAsOf: string;
  freshnessEvaluatedAt: string;
  inputs: HealthProfileLaboratoryInput[];
  excludedObservations: ScoreExclusion[];
  reportedResultRows: BaselineReportedResultRow[];
  reportedResults: HealthProfileReportedResults;
  hash: string;
};

function readJson<T>(url: URL): T {
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

const fixture = readJson<Fixture>(INPUT_PATH);
const expected = readJson<BaselineExpected>(EXPECTED_PATH);
const sourceById = new Map(
  fixture.sources.map((source) => [source.id, source]),
);
const observationById = new Map(
  fixture.observations.map((observation) => [observation.id, observation]),
);
const admissionsByObservationId = new Map<
  string,
  HealthProfileLaboratoryAdmission
>();

for (const observation of fixture.observations) {
  admissionsByObservationId.set(
    observation.id,
    projectHealthProfileLaboratoryAdmission({
      observation,
      relation: observation.relation,
      labUnitSystem: fixture.labUnitSystem,
    }),
  );
}

const excludedObservations: ScoreExclusion[] = [];
const inputs: HealthProfileLaboratoryInput[] = [];
for (const observation of fixture.observations) {
  const admission = admissionsByObservationId.get(observation.id)!;
  if (admission.kind === "accepted") {
    inputs.push(admission.input);
    continue;
  }

  const definitionKey =
    admission.evidence.binding.measurementDefinitionKey ??
    observation.measurement_definition_key;
  const reviewedBinding = definitionKey
    ? getReviewedAssessmentBinding(definitionKey)
    : null;
  const systemId =
    reviewedBinding?.binding.system ??
    (definitionKey ? getRegistryV2System(definitionKey) : "general");
  const reason: ScoreExclusion["reason"] =
    admission.reason === "no_active_revision" ||
    admission.reason === "incomplete_resolution" ||
    admission.reason === "candidate_only_identity" ||
    admission.reason === "assessment_binding_ineligible"
      ? admission.reason
      : "assessment_binding_ineligible";
  const value = observation.value == null ? null : Number(observation.value);
  const refLow =
    observation.ref_low == null ? null : Number(observation.ref_low);
  const refHigh =
    observation.ref_high == null ? null : Number(observation.ref_high);
  const valueKind =
    observation.value_kind === "qualitative" ||
    observation.value_kind === "ordinal" ||
    observation.value_kind === "text" ||
    observation.value_kind === "numeric"
      ? observation.value_kind
      : "numeric";

  excludedObservations.push({
    observation_id: observation.id,
    system_id: systemId,
    key:
      reviewedBinding?.binding.assessmentInputKey ??
      observation.analyte_key ??
      definitionKey ??
      observation.name,
    measurement_definition_key: definitionKey,
    name: observation.name,
    value: Number.isFinite(value) ? value : null,
    value_text: observation.value_text ?? null,
    unit: observation.unit ?? "",
    ref_low: Number.isFinite(refLow) ? refLow : null,
    ref_high: Number.isFinite(refHigh) ? refHigh : null,
    status: getMarkerStatus(
      Number.isFinite(value) ? value : null,
      Number.isFinite(refLow) ? refLow : null,
      Number.isFinite(refHigh) ? refHigh : null,
      valueKind,
    ),
    observed_at: observation.observed_at,
    document_id: observation.document_id,
    source: observation.document_id
      ? (sourceById.get(observation.document_id) ?? null)
      : null,
    source_page: null,
    source_text: null,
    source_region: null,
    reason,
    reason_detail:
      admission.evidence.resolution.incompleteReason ??
      admission.evidence.outcome.outcome,
    contribution_group: null,
  });
}

const reportedRows: ReportedResultProjectionRow[] = fixture.extractedRows.map(
  (row) => {
    const linkedObservation = row.linkedObservationId
      ? (observationById.get(row.linkedObservationId) ?? null)
      : null;
    const relation = linkedObservation?.relation ?? row.relation;
    const linkedAdmission = linkedObservation
      ? (admissionsByObservationId.get(linkedObservation.id) ?? null)
      : null;
    if (linkedObservation && !linkedAdmission) {
      throw new Error(
        `Missing laboratory admission for observation ${linkedObservation.id}`,
      );
    }

    const observation = linkedObservation ?? {
      id: row.id,
      analyte_key: row.biomarker_key,
      measurement_definition_key: row.measurement_definition_key,
      resolution_status: null,
      name: row.biomarker_name,
      value: row.value_numeric,
      unit: row.unit ?? row.raw_unit,
      ref_low: null,
      ref_high: null,
      raw_reference_text: row.raw_reference_range ?? row.reference_range,
      observed_at: sourceById.get(row.document_id)?.observed_at ?? "",
      document_id: row.document_id,
      observation_kind: "lab" as const,
      value_kind: row.value_kind,
      value_text: row.value_text,
      ordinal: row.ordinal,
      specimen: null,
      modifier: null,
    };
    const outcome =
      linkedAdmission?.evidence.outcome ??
      projectLaboratoryOutcome({ observation, relation });
    const assessmentInput =
      linkedAdmission?.kind === "accepted" ? linkedAdmission.input : null;
    return {
      id: row.id,
      document_id: row.document_id,
      outcome,
      assessment_input: assessmentInput,
    };
  },
);

const reportedResults = projectHealthProfileReportedResults(reportedRows);
const reportedResultRows: BaselineReportedResultRow[] = reportedRows.map(
  (row) => ({
    id: row.id,
    document_id: row.document_id,
    outcome: row.outcome.outcome,
    assessment_exclusion:
      row.outcome.resolutionDetails.eligibility.exclusions.assessment,
    incomplete_reason: row.outcome.resolutionDetails.incompleteReason,
    ready_for_scoring: row.assessment_input !== null,
  }),
);
const hash = hashHealthProfileSnapshotInput({
  freshness_policy_version: HEALTH_PROFILE_FRESHNESS_POLICY.version,
  freshness_as_of: fixture.freshnessAsOf,
  inputs,
  sources: fixture.sources,
  excludedObservations,
  reported_results: reportedResults,
  reported_result_rows: reportedResultRows,
});

assert.equal(fixture.fixtureVersion, expected.fixtureVersion);
assert.equal(fixture.freshnessAsOf, expected.freshnessAsOf);
assert.equal(fixture.freshnessEvaluatedAt, expected.freshnessEvaluatedAt);
assert.deepEqual(
  inputs,
  expected.inputs,
  "admitted inputs changed from the fixed baseline",
);
assert.deepEqual(
  excludedObservations,
  expected.excludedObservations,
  "score exclusions changed from the fixed baseline",
);
assert.deepEqual(
  reportedResultRows,
  expected.reportedResultRows,
  "reported-row admission evidence changed from the fixed baseline",
);
assert.deepEqual(
  reportedResults,
  expected.reportedResults,
  "reported counts changed from the fixed baseline",
);
assert.equal(
  hash,
  expected.hash,
  "snapshot input hash changed from the fixed baseline",
);

console.log(
  JSON.stringify(
    {
      before: {
        inputCount: expected.inputs.length,
        excludedCount: expected.excludedObservations.length,
        reportedRowCount: expected.reportedResultRows.length,
        reportedResults: expected.reportedResults,
        hash: expected.hash,
      },
      after: {
        inputCount: inputs.length,
        excludedCount: excludedObservations.length,
        reportedRowCount: reportedResultRows.length,
        reportedResults,
        hash,
      },
    },
    null,
    2,
  ),
);
console.log(
  "verify-health-profile-admission-baseline: fixed baseline parity passed",
);
