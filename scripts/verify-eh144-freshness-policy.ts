import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateSystemObservationFreshness,
  HEALTH_PROFILE_FRESHNESS_POLICY,
  type FreshnessStatus,
} from "../src/lib/health-profile-freshness";
import {
  buildHealthProfile,
  computeSystemStateScore,
  evaluateSystemScoreReadiness,
  type ObservationInput,
  type SystemMarker,
} from "../src/lib/health-systems";
import { hashHealthProfileSnapshotInput } from "../src/lib/health-profile-snapshot-canonical";

const AS_OF = "2026-08-23";
const EVALUATED_AT = "2026-08-23T12:00:00.000Z";
const source = {
  id: "document-eh144",
  original_filename: "lipids.pdf",
  observed_at: AS_OF,
  lab_name: "Synthetic Lab",
  document_type: "lab_result",
};

function observation(
  biomarkerKey: string,
  measurementDefinitionKey: string,
  observedAt: string | null,
  value = 100,
  observationId = `observation-${biomarkerKey}`,
): ObservationInput {
  return {
    biomarker_key: biomarkerKey,
    observation_id: observationId,
    measurement_definition_key: measurementDefinitionKey,
    resolution_status: "resolved",
    name: biomarkerKey,
    value,
    unit: "mg/dL",
    ref_low: 0,
    ref_high: 200,
    observed_at: observedAt,
    document_id: source.id,
    observation_kind: "lab",
    value_kind: "numeric",
    specimen: "serum",
  };
}

function marker(
  key: string,
  definitionKey: string,
  freshnessStatus: FreshnessStatus,
): SystemMarker {
  return {
    key,
    measurement_definition_key: definitionKey,
    name: key,
    value: 100,
    unit: "mg/dL",
    ref_low: 0,
    ref_high: 200,
    status: "in_range",
    freshness_status: freshnessStatus,
    observed_at: freshnessStatus === "unknown_date" ? null : AS_OF,
    document_id: source.id,
    observation_kind: "lab",
    source,
    score_role: "core",
    value_kind: "numeric",
    specimen: "serum",
    modifier: "none",
  };
}

assert.equal(HEALTH_PROFILE_FRESHNESS_POLICY.version, "eh-144.v1");
assert.equal(
  HEALTH_PROFILE_FRESHNESS_POLICY.maxAgeDaysBySystem.cardiovascular,
  365,
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: AS_OF,
    asOf: AS_OF,
  }),
  "current",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "2025-08-23",
    asOf: AS_OF,
  }),
  "current",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "2025-08-22",
    asOf: AS_OF,
  }),
  "outdated",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "2026-08-24",
    asOf: AS_OF,
  }),
  "unknown_date",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "2025-01-01",
    asOf: AS_OF,
  }),
  "outdated",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: null,
    asOf: AS_OF,
  }),
  "unknown_date",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "not-a-date",
    asOf: AS_OF,
  }),
  "unknown_date",
);

const currentReadiness = evaluateSystemScoreReadiness("cardiovascular", [
  marker("ldl", "ldl_serum", "current"),
  marker("hdl", "hdl_serum", "current"),
  marker("triglycerides", "triglycerides_serum", "current"),
]);
assert.equal(currentReadiness.scoreability, "scoreable");
assert.equal(
  currentReadiness.readiness.reasons.some((reason) => reason.code === "outdated" || reason.code === "unknown_date"),
  false,
);

const outdatedReadiness = evaluateSystemScoreReadiness("cardiovascular", [
  marker("ldl", "ldl_serum", "outdated"),
  marker("hdl", "hdl_serum", "current"),
  marker("triglycerides", "triglycerides_serum", "current"),
]);
assert.equal(outdatedReadiness.scoreability, "incomplete");
assert.deepEqual(
  outdatedReadiness.readiness.reasons.filter((reason) => reason.code === "outdated").map((reason) => reason.required_group),
  [["ldl", "non_hdl_cholesterol"]],
);
assert.equal(
  computeSystemStateScore("cardiovascular", [
    marker("ldl", "ldl_serum", "outdated"),
    marker("hdl", "hdl_serum", "current"),
    marker("triglycerides", "triglycerides_serum", "current"),
  ]),
  null,
);

const unknownDateReadiness = evaluateSystemScoreReadiness("cardiovascular", [
  marker("ldl", "ldl_serum", "unknown_date"),
  marker("hdl", "hdl_serum", "current"),
  marker("triglycerides", "triglycerides_serum", "current"),
]);
assert.equal(unknownDateReadiness.scoreability, "incomplete");
assert.deepEqual(
  unknownDateReadiness.readiness.reasons.filter((reason) => reason.code === "unknown_date").map((reason) => reason.required_group),
  [["ldl", "non_hdl_cholesterol"]],
);

const currentProfile = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", AS_OF),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const currentCardiovascular = currentProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(currentCardiovascular);
assert.equal(currentCardiovascular.state_score !== null, true);
assert.equal(currentProfile.freshness_policy_version, "eh-144.v1");
assert.equal(currentProfile.freshness_evaluated_at, EVALUATED_AT);
assert.equal(
  currentCardiovascular.markers.every((item) => item.freshness_status === "current"),
  true,
);

const outdatedProfile = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", "2025-01-01"),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const outdatedCardiovascular = outdatedProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(outdatedCardiovascular);
assert.equal(outdatedCardiovascular.state_score, null);
assert.deepEqual(
  outdatedCardiovascular.score_readiness.reasons.filter((reason) => reason.code === "outdated").map((reason) => reason.required_group),
  [["ldl", "non_hdl_cholesterol"]],
);
assert.equal(
  outdatedCardiovascular.markers.find((item) => item.key === "ldl")?.observed_at,
  "2025-01-01",
);

const unknownDateProfile = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", null),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const unknownDateCardiovascular = unknownDateProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(unknownDateCardiovascular);
assert.equal(unknownDateCardiovascular.state_score, null);
assert.deepEqual(
  unknownDateCardiovascular.score_readiness.reasons.filter((reason) => reason.code === "unknown_date").map((reason) => reason.required_group),
  [["ldl", "non_hdl_cholesterol"]],
);
assert.equal(
  unknownDateCardiovascular.markers.find((item) => item.key === "ldl")?.observed_at,
  null,
);

const alternativeCurrentProfile = buildHealthProfile(
  [
    observation("non_hdl_cholesterol", "non_hdl_cholesterol_serum", AS_OF),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const alternativeCardiovascular = alternativeCurrentProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(alternativeCardiovascular);
assert.equal(alternativeCardiovascular.state_score !== null, true);

const firstInput = observation("ldl", "ldl_serum", AS_OF, 80, "observation-a");
const secondInput = observation("ldl", "ldl_serum", AS_OF, 120, "observation-b");
const deterministicProfile = buildHealthProfile(
  [firstInput, secondInput],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const deterministicMarker = deterministicProfile.systems
  .find((system) => system.id === "cardiovascular")
  ?.markers.find((item) => item.key === "ldl");
assert.equal(deterministicMarker?.value, 120);

const knownDateWinsOverMalformedDate = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", "2025-01-01", 80, "observation-known-date"),
    observation("ldl", "ldl_serum", "not-a-date", 120, "observation-malformed-date"),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const knownDateMarker = knownDateWinsOverMalformedDate.systems
  .find((system) => system.id === "cardiovascular")
  ?.markers.find((item) => item.key === "ldl");
assert.equal(knownDateMarker?.observed_at, "2025-01-01");

const hashWithPolicy = hashHealthProfileSnapshotInput({
  freshness_policy_version: "eh-144.v1",
  freshness_as_of: AS_OF,
  inputs: [firstInput],
});
const hashWithDifferentPolicy = hashHealthProfileSnapshotInput({
  freshness_policy_version: "eh-144.v2",
  freshness_as_of: AS_OF,
  inputs: [firstInput],
});
assert.notEqual(hashWithPolicy, hashWithDifferentPolicy);

const drawerSource = readFileSync(
  resolve(process.cwd(), "src/components/health-profile-drawer.tsx"),
  "utf8",
);
const profilePageSource = readFileSync(
  resolve(process.cwd(), "src/app/app/profile/page.tsx"),
  "utf8",
);
assert.match(drawerSource, /outdated data/);
assert.match(drawerSource, /date unavailable/);
assert.match(profilePageSource, /observed_at \?\? "Date unavailable"/);
assert.doesNotMatch(drawerSource, /order\s+(?:a\s+)?(?:new\s+)?tests?/i);
const healthProfileRouteSource = readFileSync(
  resolve(process.cwd(), "src/app/api/health-profile/route.ts"),
  "utf8",
);
const bodySilhouetteSource = readFileSync(
  resolve(process.cwd(), "src/components/body-silhouette.tsx"),
  "utf8",
);
assert.match(healthProfileRouteSource, /freshness_policy_version/);
assert.match(healthProfileRouteSource, /freshness_evaluated_at/);
assert.match(
  healthProfileRouteSource,
  /value\.freshness_policy_version !== HEALTH_PROFILE_FRESHNESS_POLICY\.version/,
);
assert.match(bodySilhouetteSource, /outdated evidence/);
assert.match(bodySilhouetteSource, /medical date unavailable/);

console.log("verify-eh144-freshness-policy: all checks passed");
