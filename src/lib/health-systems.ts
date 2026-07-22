import { observationIdentityKey, type BodySystemId, type SystemScoreability, type ValueKind } from "@/lib/biomarkers";
import {
  BODY_SYSTEM_LABELS,
  getRegistryV2ExpectedSpecimen,
  getRegistryV2ScoreContributionGroups,
  getRegistryV2ScoreReadinessGroups,
  getRegistryV2ScoreRole,
  getRegistryV2System,
  listRegistryV2CoverageKeys,
  NAMED_BODY_SYSTEMS,
  NON_SCOREABLE_SYSTEMS,
} from "@/lib/biomarkers/registry-v2-runtime";
import { getReviewedAssessmentBinding } from "@/lib/biomarkers";

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
  if (
    mime.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif)$/i.test(filename)
  ) {
    return "image";
  }
  return "unknown";
}

export type { BodySystemId };

/** @deprecated Use `nutrients`. Kept for client compat. */
export type LegacyBodySystemId = "vitamins";

export type MarkerStatus = "in_range" | "out_of_range" | "unknown";

export type ObservationInput = {
  biomarker_key: string;
  /** Required Registry 2.0 identity for concrete assessment inputs. */
  measurement_definition_key?: string | null;
  resolution_status?: "resolved" | "partial" | "ambiguous" | "unmapped" | null;
  name: string;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  document_id: string | null;
  observation_kind?: "lab" | "instrumental";
  value_kind?: ValueKind;
  value_text?: string | null;
  ordinal?: number | null;
  specimen?: string;
  modifier?: string;
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
  key: string;
  measurement_definition_key?: string | null;
  name: string;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  status: MarkerStatus;
  observed_at: string;
  document_id: string | null;
  observation_kind?: "lab" | "instrumental";
  source: MarkerSource | null;
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

export type SystemInsight = {
  id: BodySystemId;
  name: string;
  state_score: number | null;
  data_confidence: number;
  scoreability: SystemScoreability;
  score_readiness: SystemScoreReadiness;
  primary_source: MarkerSource | null;
  why_highlighted: string[];
  markers: SystemMarker[];
};

export type ScoreReadinessGroup = {
  keys: string[];
  status: "satisfied" | "missing" | "present_without_reference";
  satisfied_by: string | null;
  present_without_reference: string[];
};

export type SystemScoreReadiness = {
  required_groups: ScoreReadinessGroup[];
  missing_groups: string[][];
  present_without_reference: string[];
};

export type ProfileDisplayState =
  | "onboarding"
  | "no_recognized_biomarkers"
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
  overall_state_score: number | null;
  overall_data_confidence: number;
  scoreable_named_system_count: number;
  scoreable_named_system_total: number;
  overall_assessment_dismissal_key?: string;
  systems: SystemInsight[];
  sources: HealthProfileSource[];
  holistic_synthesis: HolisticSynthesis | null;
  synthesis_stale?: boolean;
};

const BODY_SYSTEMS: Record<
  Exclude<BodySystemId, "general">,
  { name: string }
> = {
  cardiovascular: { name: BODY_SYSTEM_LABELS.cardiovascular },
  metabolic: { name: BODY_SYSTEM_LABELS.metabolic },
  thyroid: { name: BODY_SYSTEM_LABELS.thyroid },
  liver: { name: BODY_SYSTEM_LABELS.liver },
  kidney: { name: BODY_SYSTEM_LABELS.kidney },
  blood: { name: BODY_SYSTEM_LABELS.blood },
  nutrients: { name: BODY_SYSTEM_LABELS.nutrients },
  inflammation: { name: BODY_SYSTEM_LABELS.inflammation },
};

const IN_RANGE_SCORE = 95;
const UNKNOWN_REF_SCORE = 70;
const OUT_OF_RANGE_BASE = 55;
const OUT_OF_RANGE_MIN = 20;

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

export function getMarkerStatus(
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
  valueKind: ValueKind = "numeric"
): MarkerStatus {
  if (valueKind !== "numeric" || value == null) return "unknown";
  if (refLow == null && refHigh == null) return "unknown";
  if (refLow != null && value < refLow) return "out_of_range";
  if (refHigh != null && value > refHigh) return "out_of_range";
  return "in_range";
}

export function markerStateScore(
  status: MarkerStatus,
  value: number | null,
  refLow: number | null,
  refHigh: number | null
): number {
  if (status === "in_range") return IN_RANGE_SCORE;
  if (status === "unknown" || value == null) return UNKNOWN_REF_SCORE;

  let deviation = 0;
  if (refLow != null && value < refLow) {
    deviation = Math.min(1, (refLow - value) / Math.max(refLow, 1));
  } else if (refHigh != null && value > refHigh) {
    deviation = Math.min(1, (value - refHigh) / Math.max(refHigh, 1));
  }

  return Math.max(OUT_OF_RANGE_MIN, Math.round(OUT_OF_RANGE_BASE - deviation * 35));
}

function latestByIdentity(observations: ObservationInput[]): Map<string, ObservationInput> {
  const map = new Map<string, ObservationInput>();
  for (const obs of observations) {
    if (obs.observation_kind && obs.observation_kind !== "lab") continue;
    if (obs.resolution_status && obs.resolution_status !== "resolved") continue;
    if (!obs.measurement_definition_key) continue;
    const binding = getReviewedAssessmentBinding(obs.measurement_definition_key);
    if (!binding) continue;
    const key = binding.binding.assessmentInputKey;
    const specimen = obs.specimen ?? "unspecified";
    const modifier = obs.modifier ?? "none";
    const id = observationIdentityKey(key, specimen, modifier);
    const existing = map.get(id);
    if (!existing || obs.observed_at > existing.observed_at) {
      map.set(id, {
        ...obs,
        biomarker_key: key,
        measurement_definition_key: binding.definition.key,
        specimen,
        modifier,
      });
    }
  }
  return map;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function markerRole(marker: SystemMarker): "core" | "extended" | "display" {
  return getRegistryV2ScoreRole(marker.measurement_definition_key ?? marker.key);
}

/** Numeric markers that can contribute to a system state score. */
function isNumericMarker(marker: SystemMarker): boolean {
  const kind = marker.value_kind ?? "numeric";
  return kind === "numeric" && marker.value != null && Number.isFinite(marker.value);
}

/** Core markers with known lab ref status — preferred score drivers. */
function isCoreScoreEligible(marker: SystemMarker): boolean {
  return isNumericMarker(marker) && markerRole(marker) === "core" && marker.status !== "unknown";
}

/**
 * Soft drivers used only when a system has no core markers at all
 * (e.g. General with unmapped/specialty labs, or blood differentials alone).
 * Without this fallback, systems with only display/extended markers scored 0/100
 * and were labeled "Needs attention" even when every value was in range.
 */
function isSoftScoreEligible(marker: SystemMarker): boolean {
  return isNumericMarker(marker) && marker.status !== "unknown";
}

function averageMarkerStateScores(markers: SystemMarker[]): number {
  return average(
    markers.map((marker) =>
      markerStateScore(marker.status, marker.value, marker.ref_low, marker.ref_high)
    )
  );
}

function hasUsableDocumentReference(marker: SystemMarker): boolean {
  return marker.ref_low != null || marker.ref_high != null;
}

function matchesReviewedSpecimen(marker: SystemMarker): boolean {
  const expected = getRegistryV2ExpectedSpecimen(marker.measurement_definition_key ?? marker.key);
  if (!expected) return true;
  return marker.specimen === expected;
}

function isUsableCoreMarker(marker: SystemMarker): boolean {
  return (
    isNumericMarker(marker) &&
    markerRole(marker) === "core" &&
    hasUsableDocumentReference(marker) &&
    matchesReviewedSpecimen(marker)
  );
}

function pickUsableMarker(keys: readonly string[], markers: SystemMarker[]): SystemMarker | null {
  for (const key of keys) {
    const marker = markers.find((candidate) => candidate.key === key && isUsableCoreMarker(candidate));
    if (marker) return marker;
  }
  return null;
}

function resolveReadinessGroup(keys: readonly string[], markers: SystemMarker[]): ScoreReadinessGroup {
  const satisfied = pickUsableMarker(keys, markers);
  if (satisfied) {
    return {
      keys: [...keys],
      status: "satisfied",
      satisfied_by: satisfied.key,
      present_without_reference: [],
    };
  }

  const presentWithoutReference = markers
    .filter((marker) => keys.includes(marker.key) && !isUsableCoreMarker(marker))
    .map((marker) => marker.key);

  return {
    keys: [...keys],
    status: presentWithoutReference.length > 0 ? "present_without_reference" : "missing",
    satisfied_by: null,
    present_without_reference: [...new Set(presentWithoutReference)],
  };
}

export function evaluateSystemScoreReadiness(
  systemId: BodySystemId,
  markers: SystemMarker[]
): { scoreability: SystemScoreability; readiness: SystemScoreReadiness } {
  if (systemId === "general") {
    return {
      scoreability: "supporting_only",
      readiness: { required_groups: [], missing_groups: [], present_without_reference: [] },
    };
  }

  if (NON_SCOREABLE_SYSTEMS.has(systemId)) {
    return {
      scoreability: "non_scoreable",
      readiness: { required_groups: [], missing_groups: [], present_without_reference: [] },
    };
  }

  const groups = getRegistryV2ScoreReadinessGroups(systemId).map((keys) =>
    resolveReadinessGroup(keys, markers)
  );
  const missingGroups = groups.filter((group) => group.status === "missing").map((group) => group.keys);
  const withoutReference = groups.flatMap((group) => group.present_without_reference);

  return {
    scoreability: groups.every((group) => group.status === "satisfied") ? "scoreable" : "incomplete",
    readiness: {
      required_groups: groups,
      missing_groups: missingGroups,
      present_without_reference: [...new Set(withoutReference)],
    },
  };
}

export function computeSystemStateScore(
  systemId: BodySystemId,
  markers: SystemMarker[]
): number | null {
  const { scoreability } = evaluateSystemScoreReadiness(systemId, markers);
  if (scoreability !== "scoreable" || systemId === "general") return null;

  const contributionScores = getRegistryV2ScoreContributionGroups(systemId)
    .map((group) => pickUsableMarker(group.keys, markers))
    .filter((marker): marker is SystemMarker => marker !== null)
    .map((marker) => markerStateScore(marker.status, marker.value, marker.ref_low, marker.ref_high));

  return contributionScores.length > 0 ? average(contributionScores) : null;

  // 1) Prefer core markers with known reference ranges
  const coreEligible = markers.filter(isCoreScoreEligible);
  if (coreEligible.length > 0) {
    return averageMarkerStateScores(coreEligible);
  }

  // 2) Core present but all unknown-ref → mild unknown score (do not drop to 0)
  const core = markers.filter((m) => markerRole(m) === "core" && isNumericMarker(m));
  if (core.length > 0) {
    return averageMarkerStateScores(core);
  }

  // 3) No core drivers: soft-score any numeric markers with known refs
  //    (display/extended/unmapped). Keeps General & specialty-only systems honest.
  const softEligible = markers.filter(isSoftScoreEligible);
  if (softEligible.length > 0) {
    return averageMarkerStateScores(softEligible);
  }

  // 4) Only numeric-without-ref → mild unknown average
  const numericOnly = markers.filter(isNumericMarker);
  if (numericOnly.length > 0) {
    return averageMarkerStateScores(numericOnly);
  }

  // Truly nothing scoreable (empty / qualitative-only)
  return 0;
}

export function computeSystemDataConfidence(
  systemId: BodySystemId,
  markers: SystemMarker[]
): number {
  if (markers.length === 0) return 0;

  if (systemId === "general") {
    const withRef = markers.filter((marker) => marker.status !== "unknown").length;
    return Math.round((withRef / markers.length) * 100);
  }

  const coverageKeys = listRegistryV2CoverageKeys(systemId);
  const presentKeys = new Set(markers.map((marker) => marker.key));
  const coverageDenom = Math.max(coverageKeys.length, 1);
  const coveragePart =
    (coverageKeys.filter((key) => presentKeys.has(key)).length / coverageDenom) * 100;

  // Ref quality among present numeric non-display markers
  const scorable = markers.filter(
    (m) =>
      markerRole(m) !== "display" &&
      (m.value_kind ?? "numeric") === "numeric" &&
      m.value != null
  );
  const pool = scorable.length > 0 ? scorable : markers.filter((m) => (m.value_kind ?? "numeric") === "numeric");
  const withRef = pool.filter((marker) => marker.status !== "unknown").length;
  const refPart = pool.length > 0 ? (withRef / pool.length) * 100 : 0;

  return Math.round(coveragePart * 0.6 + refPart * 0.4);
}

export function selectPrimarySource(markers: SystemMarker[]): MarkerSource | null {
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
      marker.status === "out_of_range" &&
      markerRole(marker) === "core"
  );
  if (outOfRange.length > 0) {
    return outOfRange.map(
      (marker) =>
        `${marker.name}: ${marker.value} ${marker.unit} (outside lab reference range, observed ${marker.observed_at})`
    );
  }

  if (markers.length > 0) {
    return [`Based on ${markers.length} marker${markers.length === 1 ? "" : "s"} from your uploaded records.`];
  }

  return [];
}

export function buildHealthProfile(
  observations: ObservationInput[],
  sources: HealthProfileSource[]
): Omit<HealthProfileResult, "holistic_synthesis"> {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const latest = latestByIdentity(observations);
  const bySystem = new Map<BodySystemId, SystemMarker[]>();

  for (const obs of latest.values()) {
    const key = obs.biomarker_key;
    const systemId = getSystemForMarker(key);
    const valueKind = obs.value_kind ?? "numeric";
    const numericValue = obs.value != null ? Number(obs.value) : null;
    const markers = bySystem.get(systemId) ?? [];
    markers.push({
      key,
      measurement_definition_key: obs.measurement_definition_key ?? null,
      name: obs.name,
      value: numericValue,
      unit: obs.unit,
      ref_low: obs.ref_low,
      ref_high: obs.ref_high,
      status: getMarkerStatus(numericValue, obs.ref_low, obs.ref_high, valueKind),
      observed_at: obs.observed_at,
      document_id: obs.document_id,
      observation_kind: obs.observation_kind,
      source: obs.document_id ? sourceById.get(obs.document_id) ?? null : null,
      score_role: getRegistryV2ScoreRole(obs.measurement_definition_key ?? key),
      value_kind: valueKind,
      value_text: obs.value_text ?? null,
      ordinal: obs.ordinal ?? null,
      specimen: obs.specimen ?? "unspecified",
      modifier: obs.modifier ?? "none",
      converted: obs.converted,
      conversion_note: obs.conversion_note,
      original_value: obs.original_value,
      original_unit: obs.original_unit,
    });
    bySystem.set(systemId, markers);
  }

  const systems: SystemInsight[] = [];
  const systemOrder: BodySystemId[] = [...NAMED_BODY_SYSTEMS, "general"];

  for (const systemId of systemOrder) {
    const markers = bySystem.get(systemId) ?? [];
    if (latest.size === 0 || (systemId === "general" && markers.length === 0)) continue;

    const name = systemId === "general" ? "General" : BODY_SYSTEMS[systemId].name;
    const { scoreability, readiness } = evaluateSystemScoreReadiness(systemId, markers);

    systems.push({
      id: systemId,
      name,
      state_score: computeSystemStateScore(systemId, markers),
      data_confidence: computeSystemDataConfidence(systemId, markers),
      scoreability,
      score_readiness: readiness,
      primary_source: selectPrimarySource(markers),
      why_highlighted: buildWhyHighlighted(markers),
      markers,
    });
  }

  const scoreableSystems = systems.filter(
    (system): system is SystemInsight & { state_score: number } =>
      system.id !== "general" && system.scoreability === "scoreable" && system.state_score != null
  );
  const namedSystems = systems.filter((system) => system.id !== "general");
  const confidenceScores = namedSystems.map((system) => system.data_confidence);
  const biomarkerObservationCount = latest.size;

  return {
    records_used_count: sources.length,
    biomarker_observation_count: biomarkerObservationCount,
    profile_display_state:
      biomarkerObservationCount > 0
        ? "body_map"
        : sources.length > 0
          ? "no_recognized_biomarkers"
          : "onboarding",
    overall_state_score:
      scoreableSystems.length >= 3 ? average(scoreableSystems.map((system) => system.state_score)) : null,
    overall_data_confidence: average(confidenceScores),
    scoreable_named_system_count: scoreableSystems.length,
    scoreable_named_system_total: NAMED_BODY_SYSTEMS.length,
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
  inflammation: { anchorX: 200, anchorY: 180, label: "Inflammation", side: "left" },
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
  return Array.from({ length: count }, (_, i) => BODY_MAP_COLUMN_TOP + i * step);
}

function sortByAnchorY(ids: BodySystemId[]): BodySystemId[] {
  return [...ids].sort(
    (a, b) => BODY_MAP_ANCHORS[a].anchorY - BODY_MAP_ANCHORS[b].anchorY
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
export function resolveBodyMapLayout(systemIds: BodySystemId[]): Map<BodySystemId, BodyMapLayout> {
  const { left: leftIds, right: rightIds } = splitIntoColumns(systemIds);
  const leftYs = columnYPositions(leftIds.length);
  const rightYs = columnYPositions(rightIds.length);
  const layouts = new Map<BodySystemId, BodyMapLayout>();

  leftIds.forEach((id, index) => {
    const anchor = BODY_MAP_ANCHORS[id];
    layouts.set(id, { ...anchor, side: "left", x: BODY_MAP_LEFT_X, y: leftYs[index]! });
  });
  rightIds.forEach((id, index) => {
    const anchor = BODY_MAP_ANCHORS[id];
    layouts.set(id, { ...anchor, side: "right", x: BODY_MAP_RIGHT_X, y: rightYs[index]! });
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

export function assessmentStatusLabel(stateScore: number | null, dataConfidence: number): string {
  if (stateScore == null) return "Assessment unavailable";
  if (dataConfidence < 40) return "Limited data";
  if (stateScore >= 70) return "Stable";
  return "Needs attention";
}
