import {
  getReviewedAssessmentBinding,
  type BodySystemId,
  type SystemScoreability,
  type ValueKind,
} from "@/lib/biomarkers";
import { getRegistryV2System } from "@/lib/biomarkers/registry-v2-runtime";
import type { SourceRegion } from "@/lib/documents/source-region";
import {
  HEALTH_PROFILE_FRESHNESS_POLICY,
  type FreshnessStatus,
  type HealthProfileFreshnessPolicy,
} from "@/lib/health-profile-freshness";
import type { HealthProfileReportedResults } from "@/lib/health-profile-reported-results";
import type { MarkerStatus } from "@/lib/health-profile-marker-status";
export type { MarkerStatus } from "@/lib/health-profile-marker-status";
import {
  evaluateHealthProfileScorePolicy,
  REGISTRY_V2_SCORE_READINESS_CONTEXT,
  type AssessmentCandidate,
} from "@/lib/health-profile-score-policy";

export type DocumentType =
  | "lab_result"
  | "instrumental_report"
  | "consultation_note"
  | "discharge_summary"
  | "prescription"
  | "referral"
  | "dicom";

export type FileKind = "pdf" | "image" | "unknown";

export const DOCUMENT_TYPES: DocumentType[] = [
  "lab_result",
  "instrumental_report",
  "consultation_note",
  "discharge_summary",
  "prescription",
  "referral",
  "dicom",
];

export const UPLOADABLE_DOCUMENT_TYPES: DocumentType[] = [
  "lab_result",
  "instrumental_report",
  "consultation_note",
  "discharge_summary",
  "prescription",
  "referral",
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  lab_result: "Lab results",
  instrumental_report: "Imaging study",
  consultation_note: "Consultation",
  discharge_summary: "Discharge summary",
  prescription: "Prescription",
  referral: "Referral",
  dicom: "Medical images (DICOM)",
};

const LEGACY_DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
  lab: "lab_result",
  imaging: "instrumental_report",
  consultation: "consultation_note",
};

export function normalizeDocumentType(value: string): DocumentType | null {
  if (DOCUMENT_TYPES.includes(value as DocumentType)) {
    return value as DocumentType;
  }
  return LEGACY_DOCUMENT_TYPE_MAP[value] ?? null;
}

export function isDocumentType(value: string): value is DocumentType {
  return normalizeDocumentType(value) !== null;
}

export function isUploadableDocumentType(value: string): value is DocumentType {
  const normalized = normalizeDocumentType(value);
  return normalized !== null && UPLOADABLE_DOCUMENT_TYPES.includes(normalized);
}

export function resolveFileKind(mimeType: string, filename: string): FileKind {
  const mime = mimeType.toLowerCase();
  if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(filename)) {
    return "image";
  }
  return "unknown";
}

export type { BodySystemId };

/** @deprecated Use `nutrients`. Kept for client compat. */
export type LegacyBodySystemId = "vitamins";

export type ObservationInput = {
  /** Stable source observation id when the persistence read provides one. */
  observation_id?: string | null;
  biomarker_key: string;
  /** Required Registry 2.0 identity for concrete assessment inputs. */
  measurement_definition_key?: string | null;
  resolution_status?: "resolved" | "partial" | "ambiguous" | "unmapped" | null;
  name: string;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string | null;
  document_id: string | null;
  observation_kind?: "lab" | "instrumental";
  value_kind?: ValueKind;
  value_text?: string | null;
  ordinal?: number | null;
  specimen?: string;
  modifier?: string;
  /** Source provenance copied from the write-once observation row. */
  source_page?: number | null;
  source_text?: string | null;
  source_region?: SourceRegion | null;
  /** Present when unit conversion was applied for display. */
  converted?: boolean;
  conversion_note?: string | null;
  original_value?: number;
  original_unit?: string;
};

export type HealthProfileSource = {
  id: string;
  original_filename: string;
  observed_at: string | null;
  lab_name: string | null;
  document_type?: string | null;
};

export type MarkerSource = HealthProfileSource;

export type SystemMarker = {
  observation_id?: string | null;
  key: string;
  measurement_definition_key?: string | null;
  name: string;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  status: MarkerStatus;
  freshness_status: FreshnessStatus;
  observed_at: string | null;
  document_id: string | null;
  observation_kind?: "lab" | "instrumental";
  source: MarkerSource | null;
  source_page?: number | null;
  source_text?: string | null;
  source_region?: SourceRegion | null;
  score_role?: "core" | "extended" | "display";
  value_kind?: ValueKind;
  value_text?: string | null;
  ordinal?: number | null;
  specimen?: string;
  modifier?: string;
  converted?: boolean;
  conversion_note?: string | null;
  original_value?: number;
  original_unit?: string;
};

export type ScoreExclusionReason =
  | "no_active_revision"
  | "incomplete_resolution"
  | "candidate_only_identity"
  | "assessment_binding_ineligible"
  | "non_numeric_value"
  | "missing_reference_range"
  | "specimen_mismatch"
  | "not_core"
  | "duplicate_contribution_group"
  | "not_in_contribution_group"
  | "score_not_available"
  | "system_not_scoreable";

type ScoreEvidenceItem = {
  observation_id: string | null;
  system_id: BodySystemId;
  key: string;
  measurement_definition_key: string | null;
  name: string;
  value: number | null;
  value_text: string | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  status: MarkerStatus;
  observed_at: string | null;
  document_id: string | null;
  source: MarkerSource | null;
  source_page: number | null;
  source_text: string | null;
  source_region: SourceRegion | null;
};

export type ScoreContributor = ScoreEvidenceItem & {
  contribution_group: string;
  contribution_score: number;
};

export type ScoreExclusion = ScoreEvidenceItem & {
  reason: ScoreExclusionReason;
  reason_detail: string | null;
  contribution_group: string | null;
};

export type SystemScoreProvenance = {
  algorithm_version: string;
  readiness_groups: ScoreReadinessGroup[];
  contributors: ScoreContributor[];
  excluded: ScoreExclusion[];
};

export type HealthProfileScoreProvenance = {
  algorithm_version: string;
  excluded_observations: ScoreExclusion[];
};

export type SystemInsight = {
  id: BodySystemId;
  name: string;
  state_score: number | null;
  data_confidence: number;
  scoreability: SystemScoreability;
  score_readiness: SystemScoreReadiness;
  score_provenance: SystemScoreProvenance;
  primary_source: MarkerSource | null;
  why_highlighted: string[];
  markers: SystemMarker[];
};

export type ScoreReadinessReasonCode =
  | "missing"
  | "invalid"
  | "outdated"
  | "unknown_date";

export type ScoreReadinessReason = {
  code: ScoreReadinessReasonCode;
  required_group: string[] | null;
  present_keys: string[];
};

export type ScoreReadinessGroup = {
  keys: string[];
  status: "satisfied" | "missing" | "invalid" | "outdated" | "unknown_date";
  satisfied_by: string | null;
  present_keys: string[];
};

export type SystemScoreReadiness = {
  required_groups: ScoreReadinessGroup[];
  reasons: ScoreReadinessReason[];
};

export type ProfileDisplayState =
  | "onboarding"
  | "no_recognized_biomarkers"
  | "reported_but_not_scoreable"
  | "body_map";

export type HolisticSynthesis = {
  text: string;
  generated_at: string;
  source_document_ids: string[];
  disclaimer: string;
};

export type HealthProfileResult = {
  records_used_count: number;
  biomarker_observation_count: number;
  profile_display_state: ProfileDisplayState;
  reported_results: HealthProfileReportedResults;
  overall_state_score: number | null;
  overall_data_confidence: number;
  scoreable_named_system_count: number;
  assessment_freshness: "current" | "outdated";
  scoreable_named_system_total: number;
  score_algorithm_version: string;
  score_provenance: HealthProfileScoreProvenance;
  overall_assessment_dismissal_key?: string;
  freshness_policy_version?: string;
  freshness_evaluated_at?: string;
  systems: SystemInsight[];
  sources: HealthProfileSource[];
  holistic_synthesis: HolisticSynthesis | null;
  synthesis_stale?: boolean;
};

export function normalizeBodySystemId(id: string): BodySystemId {
  if (id === "vitamins") return "nutrients";
  const known: BodySystemId[] = [
    "cardiovascular",
    "metabolic",
    "thyroid",
    "liver",
    "kidney",
    "blood",
    "nutrients",
    "inflammation",
    "general",
  ];
  return known.includes(id as BodySystemId) ? (id as BodySystemId) : "general";
}

export function getSystemForMarker(key: string): BodySystemId {
  return getRegistryV2System(key);
}

export function selectPrimarySource(
  markers: SystemMarker[],
): MarkerSource | null {
  const weights = new Map<string, { source: MarkerSource; weight: number }>();

  for (const marker of markers) {
    if (!marker.document_id || !marker.source) continue;
    const existing = weights.get(marker.document_id);
    const weight = marker.status === "out_of_range" ? 2 : 1;
    if (existing) {
      existing.weight += weight;
    } else {
      weights.set(marker.document_id, { source: marker.source, weight });
    }
  }

  let best: { source: MarkerSource; weight: number } | null = null;
  for (const entry of weights.values()) {
    if (!best || entry.weight > best.weight) {
      best = entry;
    }
  }

  return best?.source ?? null;
}

export function buildWhyHighlighted(markers: SystemMarker[]): string[] {
  const outOfRange = markers.filter(
    (marker) =>
      marker.status === "out_of_range" && marker.score_role === "core",
  );
  if (outOfRange.length > 0) {
    return outOfRange.map(
      (marker) =>
        `${marker.name}: ${marker.value} ${marker.unit} (outside lab reference range, observed ${marker.observed_at ?? "date unavailable"})`,
    );
  }

  if (markers.length > 0) {
    return [
      `Based on ${markers.length} marker${markers.length === 1 ? "" : "s"} from your uploaded records.`,
    ];
  }

  return [];
}

export type HealthProfileBuildOptions = Readonly<{
  /** Exclusions captured before Health Profile projection (EH-145). */
  excludedObservations?: readonly ScoreExclusion[];
  /** Reported extracted rows kept separate from score admission. */
  reportedResults?: HealthProfileReportedResults;
  freshnessAsOf?: string;
  freshnessEvaluatedAt?: string;
  freshnessPolicy?: HealthProfileFreshnessPolicy;
}>;
export function buildHealthProfile(
  observations: ObservationInput[],
  sources: HealthProfileSource[],
  options: HealthProfileBuildOptions = {},
): Omit<HealthProfileResult, "holistic_synthesis"> {
  const freshnessEvaluatedAt =
    options.freshnessEvaluatedAt ?? new Date().toISOString();
  const freshnessAsOf =
    options.freshnessAsOf ?? freshnessEvaluatedAt.slice(0, 10);
  const freshnessPolicy =
    options.freshnessPolicy ?? HEALTH_PROFILE_FRESHNESS_POLICY;
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const candidates: AssessmentCandidate[] = observations.flatMap(
    (observation) => {
      if (
        observation.observation_kind &&
        observation.observation_kind !== "lab"
      ) {
        return [];
      }
      if (
        observation.resolution_status &&
        observation.resolution_status !== "resolved"
      ) {
        return [];
      }

      const binding = observation.measurement_definition_key
        ? getReviewedAssessmentBinding(observation.measurement_definition_key)
        : null;
      const definition = binding?.definition ?? null;
      if (!binding || !definition) return [];

      return [
        {
          observation,
          system_id:
            binding.binding.system ??
            getSystemForMarker(observation.biomarker_key),
          assessment_input_key: binding.binding.assessmentInputKey,
          measurement_definition_key: definition.key,
          score_role: binding.binding.scoreRole,
          expected_specimen:
            definition.specimen !== "unspecified" ? definition.specimen : null,
          source: observation.document_id
            ? (sourceById.get(observation.document_id) ?? null)
            : null,
        },
      ];
    },
  );
  const policy = evaluateHealthProfileScorePolicy(candidates, {
    asOf: freshnessAsOf,
    evaluatedAt: freshnessEvaluatedAt,
    freshnessPolicy,
    registry: REGISTRY_V2_SCORE_READINESS_CONTEXT,
  });

  const systems: SystemInsight[] = policy.systems.map((system) => {
    const preProjectionExclusions =
      options.excludedObservations?.filter(
        (item) => item.system_id === system.id,
      ) ?? [];
    return {
      ...system,
      score_provenance: {
        ...system.score_provenance,
        excluded: [
          ...system.score_provenance.excluded,
          ...preProjectionExclusions,
        ],
      },
      primary_source: selectPrimarySource(system.markers),
      why_highlighted: buildWhyHighlighted(system.markers),
    };
  });
  const renderedSystemIds = new Set(systems.map((system) => system.id));
  const profileExcluded = [
    ...systems.flatMap((system) => system.score_provenance.excluded),
    ...(options.excludedObservations ?? []).filter(
      (item) => !renderedSystemIds.has(item.system_id),
    ),
  ];
  const reportedResults = options.reportedResults ?? {
    reported_count: 0,
    ready_for_scoring_count: 0,
    needs_document_details_count: 0,
    awaiting_catalog_review_count: 0,
    awaiting_verification_count: 0,
    source_document_count: 0,
  };

  return {
    records_used_count: sources.length,
    biomarker_observation_count: policy.selected_observation_count,
    profile_display_state:
      policy.selected_observation_count > 0
        ? "body_map"
        : reportedResults.reported_count > 0 &&
            reportedResults.ready_for_scoring_count === 0
          ? "reported_but_not_scoreable"
          : sources.length > 0
            ? "no_recognized_biomarkers"
            : "onboarding",
    reported_results: reportedResults,
    assessment_freshness: "current",
    overall_state_score: policy.overall_state_score,
    overall_data_confidence: policy.overall_data_confidence,
    scoreable_named_system_count: policy.scoreable_named_system_count,
    scoreable_named_system_total: policy.scoreable_named_system_total,
    score_algorithm_version: policy.score_algorithm_version,
    score_provenance: {
      algorithm_version: policy.score_provenance.algorithm_version,
      excluded_observations: profileExcluded,
    },
    freshness_policy_version: policy.freshness_policy_version,
    freshness_evaluated_at: policy.freshness_evaluated_at,
    systems,
    sources,
  };
}

export type BodyMapAnchor = {
  anchorX: number;
  anchorY: number;
  label: string;
  side: "left" | "right";
};

/** Anatomical anchor on the silhouette; badge x/y are computed for even column spacing. */
export const BODY_MAP_ANCHORS: Record<BodySystemId, BodyMapAnchor> = {
  cardiovascular: { anchorX: 205, anchorY: 148, label: "Heart", side: "left" },
  blood: { anchorX: 218, anchorY: 158, label: "Blood", side: "left" },
  thyroid: { anchorX: 225, anchorY: 92, label: "Thyroid", side: "left" },
  kidney: { anchorX: 212, anchorY: 208, label: "Kidney", side: "left" },
  nutrients: { anchorX: 215, anchorY: 232, label: "Nutrients", side: "left" },
  inflammation: {
    anchorX: 200,
    anchorY: 180,
    label: "Inflammation",
    side: "left",
  },
  liver: { anchorX: 248, anchorY: 168, label: "Liver", side: "right" },
  metabolic: { anchorX: 248, anchorY: 198, label: "Metabolic", side: "right" },
  general: { anchorX: 238, anchorY: 252, label: "General", side: "right" },
};

const BODY_MAP_LEFT_X = 158;
const BODY_MAP_RIGHT_X = 304;
const BODY_MAP_COLUMN_TOP = 118;
const BODY_MAP_COLUMN_BOTTOM = 248;

function columnYPositions(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [(BODY_MAP_COLUMN_TOP + BODY_MAP_COLUMN_BOTTOM) / 2];
  const step = (BODY_MAP_COLUMN_BOTTOM - BODY_MAP_COLUMN_TOP) / (count - 1);
  return Array.from(
    { length: count },
    (_, i) => BODY_MAP_COLUMN_TOP + i * step,
  );
}

function sortByAnchorY(ids: BodySystemId[]): BodySystemId[] {
  return [...ids].sort(
    (a, b) => BODY_MAP_ANCHORS[a].anchorY - BODY_MAP_ANCHORS[b].anchorY,
  );
}

function splitIntoColumns(systemIds: BodySystemId[]): {
  left: BodySystemId[];
  right: BodySystemId[];
} {
  const left: BodySystemId[] = [];
  const right: BodySystemId[] = [];

  for (const id of systemIds) {
    const preferred = BODY_MAP_ANCHORS[id].side;
    if (preferred === "left") {
      if (left.length <= right.length) left.push(id);
      else right.push(id);
    } else if (right.length <= left.length) {
      right.push(id);
    } else {
      left.push(id);
    }
  }

  return { left: sortByAnchorY(left), right: sortByAnchorY(right) };
}

export type BodyMapLayout = BodyMapAnchor & { x: number; y: number };

/** Even left/right columns with shared vertical rhythm (reference body-map infographic). */
export function resolveBodyMapLayout(
  systemIds: BodySystemId[],
): Map<BodySystemId, BodyMapLayout> {
  const { left: leftIds, right: rightIds } = splitIntoColumns(systemIds);
  const leftYs = columnYPositions(leftIds.length);
  const rightYs = columnYPositions(rightIds.length);
  const layouts = new Map<BodySystemId, BodyMapLayout>();

  leftIds.forEach((id, index) => {
    const anchor = BODY_MAP_ANCHORS[id];
    layouts.set(id, {
      ...anchor,
      side: "left",
      x: BODY_MAP_LEFT_X,
      y: leftYs[index]!,
    });
  });
  rightIds.forEach((id, index) => {
    const anchor = BODY_MAP_ANCHORS[id];
    layouts.set(id, {
      ...anchor,
      side: "right",
      x: BODY_MAP_RIGHT_X,
      y: rightYs[index]!,
    });
  });

  return layouts;
}

export function stateScoreColor(score: number | null): string {
  if (score == null) return "fill-slate-300 stroke-slate-400";
  if (score >= 70) return "fill-emerald-500 stroke-emerald-600";
  if (score >= 40) return "fill-amber-500 stroke-amber-600";
  return "fill-slate-400 stroke-slate-500";
}

export function stateScoreStroke(score: number | null): string {
  if (score == null) return "#94a3b8";
  if (score >= 70) return "#059669";
  if (score >= 40) return "#d97706";
  return "#64748b";
}

export function assessmentStatusLabel(
  stateScore: number | null,
  dataConfidence: number,
): string {
  if (stateScore == null) return "Assessment unavailable";
  if (dataConfidence < 40) return "Limited data";
  if (stateScore >= 70) return "Stable";
  return "Needs attention";
}
