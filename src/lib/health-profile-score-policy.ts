import {
  observationIdentityKey,
  type BodySystemId,
  type NamedBodySystemId,
  type ScoreContributionGroup,
  type ScoreRequiredGroup,
  type ScoreRole,
  type SystemScoreability,
  type ValueKind,
} from "@/lib/biomarkers";
import {
  BODY_SYSTEM_LABELS,
  getRegistryV2ScoreContributionGroups,
  getRegistryV2ScoreReadinessGroups,
  listRegistryV2CoverageKeys,
  NAMED_BODY_SYSTEMS,
  NON_SCOREABLE_SYSTEMS,
} from "@/lib/biomarkers/registry-v2-runtime";
import {
  evaluateSystemObservationFreshness,
  isCompleteCalendarDate,
  type FreshnessStatus,
  type HealthProfileFreshnessPolicy,
} from "@/lib/health-profile-freshness";
import {
  getMarkerStatus,
  type MarkerStatus,
} from "@/lib/health-profile-marker-status";
import type {
  HealthProfileScoreProvenance,
  MarkerSource,
  ObservationInput,
  ScoreContributor,
  ScoreExclusion,
  ScoreExclusionReason,
  ScoreReadinessGroup,
  ScoreReadinessReason,
  SystemMarker,
  SystemScoreProvenance,
  SystemScoreReadiness,
} from "@/lib/health-systems";

/**
 * The single score/readiness policy seam. Its inputs have already passed
 * assessment admission; this module performs identity selection, freshness,
 * readiness, scoring, confidence, provenance, and aggregate calculation.
 * Profile assembly and presentation remain outside this module.
 */

export const HEALTH_PROFILE_SCORE_ALGORITHM_VERSION = "eh145-score-v1" as const;

export type AssessmentCandidate = Readonly<{
  observation: ObservationInput;
  system_id: BodySystemId;
  assessment_input_key: string;
  measurement_definition_key: string;
  score_role: ScoreRole;
  expected_specimen: string | null;
  source: MarkerSource | null;
}>;

export type ScoreReadinessRegistryContext = Readonly<{
  named_systems: readonly NamedBodySystemId[];
  non_scoreable_systems: ReadonlySet<NamedBodySystemId>;
  readiness_groups_by_system: ReadonlyMap<
    BodySystemId,
    readonly ScoreRequiredGroup[]
  >;
  contribution_groups_by_system: ReadonlyMap<
    BodySystemId,
    readonly ScoreContributionGroup[]
  >;
  coverage_keys_by_system: ReadonlyMap<BodySystemId, readonly string[]>;
}>;

export type ScoreReadinessPolicyContext = Readonly<{
  asOf: string;
  evaluatedAt: string;
  freshnessPolicy: HealthProfileFreshnessPolicy;
  registry: ScoreReadinessRegistryContext;
}>;

export type ScoreReadinessPolicySystemResult = Readonly<{
  id: BodySystemId;
  name: string;
  state_score: number | null;
  data_confidence: number;
  scoreability: SystemScoreability;
  score_readiness: SystemScoreReadiness;
  score_provenance: SystemScoreProvenance;
  markers: SystemMarker[];
}>;

export type ScoreReadinessPolicyResult = Readonly<{
  systems: ScoreReadinessPolicySystemResult[];
  selected_observation_count: number;
  overall_state_score: number | null;
  overall_data_confidence: number;
  scoreable_named_system_count: number;
  scoreable_named_system_total: number;
  score_algorithm_version: typeof HEALTH_PROFILE_SCORE_ALGORITHM_VERSION;
  score_provenance: HealthProfileScoreProvenance;
  freshness_policy_version: string;
  freshness_evaluated_at: string;
}>;

type PolicyMarker = SystemMarker & {
  expected_specimen: string | null;
};

type SelectedCandidate = AssessmentCandidate & {
  observation: ObservationInput & {
    biomarker_key: string;
    measurement_definition_key: string;
    specimen: string;
    modifier: string;
  };
};

const SCORE_IN_RANGE = 95;
const SCORE_UNKNOWN_REFERENCE = 70;
const SCORE_OUT_OF_RANGE_BASE = 55;
const SCORE_OUT_OF_RANGE_MIN = 20;

export const REGISTRY_V2_SCORE_READINESS_CONTEXT: ScoreReadinessRegistryContext =
  {
    named_systems: NAMED_BODY_SYSTEMS,
    non_scoreable_systems: NON_SCOREABLE_SYSTEMS,
    readiness_groups_by_system: new Map(
      NAMED_BODY_SYSTEMS.map((systemId) => [
        systemId,
        getRegistryV2ScoreReadinessGroups(systemId),
      ]),
    ),
    contribution_groups_by_system: new Map(
      NAMED_BODY_SYSTEMS.map((systemId) => [
        systemId,
        getRegistryV2ScoreContributionGroups(systemId),
      ]),
    ),
    coverage_keys_by_system: new Map(
      NAMED_BODY_SYSTEMS.map((systemId) => [
        systemId,
        listRegistryV2CoverageKeys(systemId),
      ]),
    ),
  };

function compareCandidateRecency(
  left: SelectedCandidate,
  right: SelectedCandidate,
): number {
  const leftDate = left.observation.observed_at;
  const rightDate = right.observation.observed_at;
  const leftHasDate = isCompleteCalendarDate(leftDate);
  const rightHasDate = isCompleteCalendarDate(rightDate);
  if (!leftHasDate && rightHasDate) return -1;
  if (leftHasDate && !rightHasDate) return 1;
  if (leftHasDate && rightHasDate) {
    const byDate = leftDate.trim().localeCompare(rightDate.trim());
    if (byDate !== 0) return byDate;
  }

  const leftTie = `${left.observation.observation_id ?? ""}:${left.observation.document_id ?? ""}`;
  const rightTie = `${right.observation.observation_id ?? ""}:${right.observation.document_id ?? ""}`;
  return leftTie.localeCompare(rightTie);
}

function selectLatestCandidates(
  candidates: readonly AssessmentCandidate[],
): Map<string, SelectedCandidate> {
  const latest = new Map<string, SelectedCandidate>();

  for (const candidate of candidates) {
    const observation = candidate.observation;

    const specimen = observation.specimen ?? "unspecified";
    const modifier = observation.modifier ?? "none";
    const normalizedObservation = {
      ...observation,
      biomarker_key: candidate.assessment_input_key,
      measurement_definition_key: candidate.measurement_definition_key,
      specimen,
      modifier,
    };
    const selected: SelectedCandidate = {
      ...candidate,
      observation: normalizedObservation,
    };
    const identity = observationIdentityKey(
      candidate.assessment_input_key,
      specimen,
      modifier,
    );
    const existing = latest.get(identity);
    if (!existing || compareCandidateRecency(selected, existing) > 0) {
      latest.set(identity, selected);
    }
  }

  return latest;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function isNumericMarker(marker: PolicyMarker): boolean {
  const kind = marker.value_kind ?? "numeric";
  return (
    kind === "numeric" && marker.value != null && Number.isFinite(marker.value)
  );
}

function hasUsableDocumentReference(marker: PolicyMarker): boolean {
  return marker.ref_low != null || marker.ref_high != null;
}

function matchesReviewedSpecimen(marker: PolicyMarker): boolean {
  return (
    marker.expected_specimen == null ||
    marker.specimen === marker.expected_specimen
  );
}

function isUsableCoreMarker(marker: PolicyMarker): boolean {
  return (
    marker.freshness_status === "current" &&
    isNumericMarker(marker) &&
    marker.score_role === "core" &&
    hasUsableDocumentReference(marker) &&
    matchesReviewedSpecimen(marker)
  );
}

function pickUsableMarker(
  keys: readonly string[],
  markers: readonly PolicyMarker[],
): PolicyMarker | null {
  for (const key of keys) {
    const marker = markers.find(
      (candidate) => candidate.key === key && isUsableCoreMarker(candidate),
    );
    if (marker) return marker;
  }
  return null;
}

function selectContributionMarkers(
  systemId: BodySystemId,
  markers: readonly PolicyMarker[],
  registry: ScoreReadinessRegistryContext,
): { group: ScoreContributionGroup; marker: PolicyMarker }[] {
  return (registry.contribution_groups_by_system.get(systemId) ?? []).flatMap(
    (group) => {
      const marker = pickUsableMarker(group.keys, markers);
      return marker ? [{ group, marker }] : [];
    },
  );
}

function markerStateScore(
  status: MarkerStatus,
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
): number {
  if (status === "in_range") return SCORE_IN_RANGE;
  if (status === "unknown" || value == null) return SCORE_UNKNOWN_REFERENCE;

  let deviation = 0;
  if (refLow != null && value < refLow) {
    deviation = Math.min(1, (refLow - value) / Math.max(refLow, 1));
  } else if (refHigh != null && value > refHigh) {
    deviation = Math.min(1, (value - refHigh) / Math.max(refHigh, 1));
  }

  return Math.max(
    SCORE_OUT_OF_RANGE_MIN,
    Math.round(SCORE_OUT_OF_RANGE_BASE - deviation * 35),
  );
}

function toScoreEvidenceItem(systemId: BodySystemId, marker: PolicyMarker) {
  return {
    observation_id: marker.observation_id ?? null,
    system_id: systemId,
    key: marker.key,
    measurement_definition_key: marker.measurement_definition_key ?? null,
    name: marker.name,
    value: marker.value,
    value_text: marker.value_text ?? null,
    unit: marker.unit,
    ref_low: marker.ref_low,
    ref_high: marker.ref_high,
    status: marker.status,
    observed_at: marker.observed_at,
    document_id: marker.document_id,
    source: marker.source,
    source_page: marker.source_page ?? null,
    source_text: marker.source_text ?? null,
    source_region: marker.source_region ?? null,
  };
}

function buildProfileScoreExclusion(
  systemId: BodySystemId,
  marker: PolicyMarker,
  reason: ScoreExclusionReason,
  reasonDetail: string | null = null,
  contributionGroup: string | null = null,
): ScoreExclusion {
  return {
    ...toScoreEvidenceItem(systemId, marker),
    reason,
    reason_detail: reasonDetail,
    contribution_group: contributionGroup,
  };
}

function resolveReadinessGroup(
  keys: readonly string[],
  markers: readonly PolicyMarker[],
): ScoreReadinessGroup {
  const groupMarkers = markers.filter((marker) => keys.includes(marker.key));
  const satisfied = pickUsableMarker(keys, groupMarkers);
  const presentKeys = [...new Set(groupMarkers.map((marker) => marker.key))];
  const hasUnknownDateMarker = groupMarkers.some(
    (marker) => marker.freshness_status === "unknown_date",
  );
  const hasOutdatedMarker = groupMarkers.some(
    (marker) => marker.freshness_status === "outdated",
  );

  if (satisfied) {
    return {
      keys: [...keys],
      status: "satisfied",
      satisfied_by: satisfied.key,
      present_keys: presentKeys,
    };
  }

  return {
    keys: [...keys],
    status:
      presentKeys.length === 0
        ? "missing"
        : hasUnknownDateMarker
          ? "unknown_date"
          : hasOutdatedMarker
            ? "outdated"
            : "invalid",
    satisfied_by: null,
    present_keys: presentKeys,
  };
}

function evaluateSystemScoreReadiness(
  systemId: BodySystemId,
  markers: readonly PolicyMarker[],
  registry: ScoreReadinessRegistryContext,
): { scoreability: SystemScoreability; readiness: SystemScoreReadiness } {
  if (systemId === "general") {
    return {
      scoreability: "supporting_only",
      readiness: { required_groups: [], reasons: [] },
    };
  }

  if (registry.non_scoreable_systems.has(systemId as NamedBodySystemId)) {
    return {
      scoreability: "non_scoreable",
      readiness: { required_groups: [], reasons: [] },
    };
  }

  const groups = (registry.readiness_groups_by_system.get(systemId) ?? []).map(
    (keys) => resolveReadinessGroup(keys, markers),
  );
  const reasons: ScoreReadinessReason[] = groups.flatMap((group) =>
    group.status === "satisfied"
      ? []
      : [
          {
            code: group.status,
            required_group: group.keys,
            present_keys: group.present_keys,
          },
        ],
  );

  return {
    scoreability: groups.every((group) => group.status === "satisfied")
      ? "scoreable"
      : "incomplete",
    readiness: {
      required_groups: groups,
      reasons,
    },
  };
}

function computeContributionScore(
  systemId: BodySystemId,
  markers: readonly PolicyMarker[],
  registry: ScoreReadinessRegistryContext,
): number | null {
  const selections = selectContributionMarkers(systemId, markers, registry);
  const scores = selections.map(({ marker }) =>
    markerStateScore(
      marker.status,
      marker.value,
      marker.ref_low,
      marker.ref_high,
    ),
  );
  return scores.length > 0 ? average(scores) : null;
}

function buildSystemScoreProvenance(
  systemId: BodySystemId,
  markers: readonly PolicyMarker[],
  readiness: SystemScoreReadiness,
  stateScore: number | null,
  registry: ScoreReadinessRegistryContext,
): SystemScoreProvenance {
  const selections =
    stateScore == null
      ? []
      : selectContributionMarkers(systemId, markers, registry);
  const selectedMarkers = new Set(
    selections.map((selection) => selection.marker),
  );
  const contributors: ScoreContributor[] = selections.map(
    ({ group, marker }) => ({
      ...toScoreEvidenceItem(systemId, marker),
      contribution_group: group.id,
      contribution_score: markerStateScore(
        marker.status,
        marker.value,
        marker.ref_low,
        marker.ref_high,
      ),
    }),
  );
  const contributionGroups =
    registry.contribution_groups_by_system.get(systemId) ?? [];
  const excluded = markers.flatMap((marker): ScoreExclusion[] => {
    if (selectedMarkers.has(marker)) return [];

    let reason: ScoreExclusionReason;
    let reasonDetail: string | null = null;
    let contributionGroup: string | null = null;

    if (
      systemId === "general" ||
      registry.non_scoreable_systems.has(systemId as NamedBodySystemId)
    ) {
      reason = "system_not_scoreable";
    } else if (!isNumericMarker(marker)) {
      reason = "non_numeric_value";
    } else if (marker.score_role !== "core") {
      reason = "not_core";
    } else if (!hasUsableDocumentReference(marker)) {
      reason = "missing_reference_range";
    } else if (!matchesReviewedSpecimen(marker)) {
      reason = "specimen_mismatch";
    } else if (stateScore == null) {
      reason = "score_not_available";
      reasonDetail = "required_readiness_group_incomplete";
    } else {
      const duplicate = contributionGroups.find(
        (group) =>
          group.keys.includes(marker.key) &&
          selections.some(
            (selection) =>
              selection.group.id === group.id && selection.marker !== marker,
          ),
      );
      if (duplicate) {
        reason = "duplicate_contribution_group";
        contributionGroup = duplicate.id;
      } else {
        reason = "not_in_contribution_group";
      }
    }

    return [
      buildProfileScoreExclusion(
        systemId,
        marker,
        reason,
        reasonDetail,
        contributionGroup,
      ),
    ];
  });

  return {
    algorithm_version: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
    readiness_groups: readiness.required_groups,
    contributors,
    excluded,
  };
}

function buildSystemScoreExplanations(
  systemId: BodySystemId,
  markers: readonly PolicyMarker[],
  scoreability: SystemScoreability,
  readiness: SystemScoreReadiness,
  stateScore: number | null,
  registry: ScoreReadinessRegistryContext,
): SystemScoreProvenance {
  if (markers.length === 0) {
    return {
      algorithm_version: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
      readiness_groups: readiness.required_groups,
      contributors: [],
      excluded: [],
    };
  }
  if (scoreability === "scoreable") {
    return buildSystemScoreProvenance(
      systemId,
      markers,
      readiness,
      stateScore,
      registry,
    );
  }
  return {
    algorithm_version: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
    readiness_groups: readiness.required_groups,
    contributors: [],
    excluded: markers.map((marker) =>
      buildProfileScoreExclusion(
        systemId,
        marker,
        systemId === "general" ||
          registry.non_scoreable_systems.has(systemId as NamedBodySystemId)
          ? "system_not_scoreable"
          : !isNumericMarker(marker)
            ? "non_numeric_value"
            : marker.score_role !== "core"
              ? "not_core"
              : !hasUsableDocumentReference(marker)
                ? "missing_reference_range"
                : !matchesReviewedSpecimen(marker)
                  ? "specimen_mismatch"
                  : "score_not_available",
        stateScore == null && isNumericMarker(marker)
          ? "required_readiness_group_incomplete"
          : null,
      ),
    ),
  };
}

function toPolicyMarker(
  candidate: SelectedCandidate,
  context: ScoreReadinessPolicyContext,
): PolicyMarker {
  const observation = candidate.observation;
  const valueKind: ValueKind = observation.value_kind ?? "numeric";
  const numericValue =
    observation.value != null ? Number(observation.value) : null;
  return {
    observation_id: observation.observation_id ?? null,
    key: observation.biomarker_key,
    measurement_definition_key: observation.measurement_definition_key ?? null,
    name: observation.name,
    value: numericValue,
    unit: observation.unit,
    ref_low: observation.ref_low,
    ref_high: observation.ref_high,
    status: getMarkerStatus(
      numericValue,
      observation.ref_low,
      observation.ref_high,
      valueKind,
    ),
    freshness_status: evaluateSystemObservationFreshness({
      systemId: candidate.system_id,
      measuredAt: observation.observed_at,
      asOf: context.asOf,
      policy: context.freshnessPolicy,
    }),
    observed_at: observation.observed_at,
    document_id: observation.document_id,
    observation_kind: observation.observation_kind,
    source: candidate.source,
    source_page: observation.source_page ?? null,
    source_text: observation.source_text ?? null,
    source_region: observation.source_region ?? null,
    score_role: candidate.score_role,
    value_kind: valueKind,
    value_text: observation.value_text ?? null,
    ordinal: observation.ordinal ?? null,
    specimen: observation.specimen,
    modifier: observation.modifier,
    converted: observation.converted,
    conversion_note: observation.conversion_note,
    original_value: observation.original_value,
    original_unit: observation.original_unit,
    expected_specimen: candidate.expected_specimen,
  };
}

function toPublicMarker(marker: PolicyMarker): SystemMarker {
  const { expected_specimen: _expectedSpecimen, ...publicMarker } = marker;
  return publicMarker;
}

function buildSystemResult(
  systemId: BodySystemId,
  markers: readonly PolicyMarker[],
  context: ScoreReadinessPolicyContext,
): ScoreReadinessPolicySystemResult {
  const evaluation = evaluateSystemScoreReadiness(
    systemId,
    markers,
    context.registry,
  );
  const stateScore =
    evaluation.scoreability === "scoreable"
      ? computeContributionScore(systemId, markers, context.registry)
      : null;
  return {
    id: systemId,
    name: systemId === "general" ? "General" : BODY_SYSTEM_LABELS[systemId],
    state_score: stateScore,
    data_confidence: computeSystemDataConfidence(
      systemId,
      markers,
      context.registry,
    ),
    scoreability: evaluation.scoreability,
    score_readiness: evaluation.readiness,
    score_provenance: buildSystemScoreExplanations(
      systemId,
      markers,
      evaluation.scoreability,
      evaluation.readiness,
      stateScore,
      context.registry,
    ),
    markers: markers.map(toPublicMarker),
  };
}

function computeSystemDataConfidence(
  systemId: BodySystemId,
  markers: readonly PolicyMarker[],
  registry: ScoreReadinessRegistryContext,
): number {
  if (markers.length === 0) return 0;

  if (systemId === "general") {
    const withReference = markers.filter(
      (marker) => marker.status !== "unknown",
    ).length;
    return Math.round((withReference / markers.length) * 100);
  }

  const coverageKeys = registry.coverage_keys_by_system.get(systemId) ?? [];
  const presentKeys = new Set(markers.map((marker) => marker.key));
  const coverageDenominator = Math.max(coverageKeys.length, 1);
  const coveragePart =
    (coverageKeys.filter((key) => presentKeys.has(key)).length /
      coverageDenominator) *
    100;
  const scorable = markers.filter(
    (marker) =>
      marker.score_role !== "display" &&
      (marker.value_kind ?? "numeric") === "numeric" &&
      marker.value != null,
  );
  const pool =
    scorable.length > 0
      ? scorable
      : markers.filter(
          (marker) => (marker.value_kind ?? "numeric") === "numeric",
        );
  const withReference = pool.filter(
    (marker) => marker.status !== "unknown",
  ).length;
  const referencePart =
    pool.length > 0 ? (withReference / pool.length) * 100 : 0;

  return Math.round(coveragePart * 0.6 + referencePart * 0.4);
}

export function evaluateHealthProfileScorePolicy(
  candidates: readonly AssessmentCandidate[],
  context: ScoreReadinessPolicyContext,
): ScoreReadinessPolicyResult {
  const latest = selectLatestCandidates(candidates);
  const bySystem = new Map<BodySystemId, PolicyMarker[]>();

  for (const candidate of latest.values()) {
    const markers = bySystem.get(candidate.system_id) ?? [];
    markers.push(toPolicyMarker(candidate, context));
    bySystem.set(candidate.system_id, markers);
  }

  const systems: ScoreReadinessPolicySystemResult[] = [];
  const systemOrder: BodySystemId[] = [
    ...context.registry.named_systems,
    "general",
  ];
  for (const systemId of systemOrder) {
    const markers = bySystem.get(systemId) ?? [];
    if (latest.size === 0 || (systemId === "general" && markers.length === 0))
      continue;
    systems.push(buildSystemResult(systemId, markers, context));
  }

  const scoreableSystems = systems.filter(
    (
      system,
    ): system is ScoreReadinessPolicySystemResult & { state_score: number } =>
      system.id !== "general" &&
      system.scoreability === "scoreable" &&
      system.state_score != null,
  );
  const namedSystems = systems.filter((system) => system.id !== "general");
  const profileExcluded = systems.flatMap(
    (system) => system.score_provenance.excluded,
  );

  return {
    systems,
    selected_observation_count: latest.size,
    overall_state_score:
      scoreableSystems.length >= 3
        ? average(scoreableSystems.map((system) => system.state_score))
        : null,
    overall_data_confidence: average(
      namedSystems.map((system) => system.data_confidence),
    ),
    scoreable_named_system_count: scoreableSystems.length,
    scoreable_named_system_total: context.registry.named_systems.length,
    score_algorithm_version: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
    score_provenance: {
      algorithm_version: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
      excluded_observations: profileExcluded,
    },
    freshness_policy_version: context.freshnessPolicy.version,
    freshness_evaluated_at: context.evaluatedAt,
  };
}
