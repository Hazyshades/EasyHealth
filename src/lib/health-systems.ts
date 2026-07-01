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

export type BodySystemId =
  | "cardiovascular"
  | "metabolic"
  | "thyroid"
  | "liver"
  | "kidney"
  | "blood"
  | "vitamins"
  | "general";

export type MarkerStatus = "in_range" | "out_of_range" | "unknown";

export type ObservationInput = {
  biomarker_key: string;
  name: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  document_id: string | null;
  observation_kind?: "lab" | "instrumental";
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
  name: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  status: MarkerStatus;
  observed_at: string;
  document_id: string | null;
  observation_kind?: "lab" | "instrumental";
  source: MarkerSource | null;
};

export type SystemInsight = {
  id: BodySystemId;
  name: string;
  state_score: number;
  data_confidence: number;
  primary_source: MarkerSource | null;
  why_highlighted: string[];
  markers: SystemMarker[];
};

export type HolisticSynthesis = {
  text: string;
  generated_at: string;
  source_document_ids: string[];
  disclaimer: string;
};

export type HealthProfileResult = {
  records_used_count: number;
  overall_state_score: number;
  overall_data_confidence: number;
  systems: SystemInsight[];
  sources: HealthProfileSource[];
  holistic_synthesis: HolisticSynthesis | null;
  synthesis_stale?: boolean;
};

const BODY_SYSTEMS: Record<
  Exclude<BodySystemId, "general">,
  { name: string; markers: string[] }
> = {
  cardiovascular: {
    name: "Cardiovascular",
    markers: ["ldl", "hdl", "total_cholesterol", "triglycerides", "apob", "non_hdl_cholesterol"],
  },
  metabolic: {
    name: "Metabolic",
    markers: ["glucose", "hba1c", "insulin", "fasting_glucose"],
  },
  thyroid: {
    name: "Thyroid",
    markers: ["tsh", "t3", "t4", "free_t4", "free_t3"],
  },
  liver: {
    name: "Liver",
    markers: ["alt", "ast", "ggt", "bilirubin", "alp"],
  },
  kidney: {
    name: "Kidney",
    markers: ["creatinine", "egfr", "bun", "urea"],
  },
  blood: {
    name: "Blood",
    markers: ["hemoglobin", "hematocrit", "wbc", "rbc", "platelets"],
  },
  vitamins: {
    name: "Vitamins & minerals",
    markers: ["vitamin_d", "ferritin", "iron", "b12", "folate"],
  },
};

const MARKER_TO_SYSTEM = new Map<string, Exclude<BodySystemId, "general">>();
for (const [systemId, system] of Object.entries(BODY_SYSTEMS)) {
  for (const marker of system.markers) {
    MARKER_TO_SYSTEM.set(marker, systemId as Exclude<BodySystemId, "general">);
  }
}

const IN_RANGE_SCORE = 95;
const UNKNOWN_REF_SCORE = 70;
const OUT_OF_RANGE_BASE = 55;
const OUT_OF_RANGE_MIN = 20;

export function getSystemForMarker(key: string): BodySystemId {
  return MARKER_TO_SYSTEM.get(key) ?? "general";
}

export function getMarkerStatus(
  value: number,
  refLow: number | null,
  refHigh: number | null
): MarkerStatus {
  if (refLow == null && refHigh == null) return "unknown";
  if (refLow != null && value < refLow) return "out_of_range";
  if (refHigh != null && value > refHigh) return "out_of_range";
  return "in_range";
}

export function markerStateScore(
  status: MarkerStatus,
  value: number,
  refLow: number | null,
  refHigh: number | null
): number {
  if (status === "in_range") return IN_RANGE_SCORE;
  if (status === "unknown") return UNKNOWN_REF_SCORE;

  let deviation = 0;
  if (refLow != null && value < refLow) {
    deviation = Math.min(1, (refLow - value) / Math.max(refLow, 1));
  } else if (refHigh != null && value > refHigh) {
    deviation = Math.min(1, (value - refHigh) / Math.max(refHigh, 1));
  }

  return Math.max(OUT_OF_RANGE_MIN, Math.round(OUT_OF_RANGE_BASE - deviation * 35));
}

function latestByKey(observations: ObservationInput[]): Map<string, ObservationInput> {
  const map = new Map<string, ObservationInput>();
  for (const obs of observations) {
    const existing = map.get(obs.biomarker_key);
    if (!existing || obs.observed_at > existing.observed_at) {
      map.set(obs.biomarker_key, obs);
    }
  }
  return map;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function computeSystemStateScore(markers: SystemMarker[]): number {
  if (markers.length === 0) return 0;
  return average(
    markers.map((marker) =>
      markerStateScore(marker.status, marker.value, marker.ref_low, marker.ref_high)
    )
  );
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

  const config = BODY_SYSTEMS[systemId];
  const presentKeys = new Set(markers.map((marker) => marker.key));
  const coveragePart = (config.markers.filter((key) => presentKeys.has(key)).length / config.markers.length) * 100;
  const withRef = markers.filter((marker) => marker.status !== "unknown").length;
  const refPart = (withRef / markers.length) * 100;

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
  const outOfRange = markers.filter((marker) => marker.status === "out_of_range");
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
  const latest = latestByKey(observations);
  const bySystem = new Map<BodySystemId, SystemMarker[]>();

  for (const obs of latest.values()) {
    const systemId = getSystemForMarker(obs.biomarker_key);
    const markers = bySystem.get(systemId) ?? [];
    markers.push({
      key: obs.biomarker_key,
      name: obs.name,
      value: Number(obs.value),
      unit: obs.unit,
      ref_low: obs.ref_low,
      ref_high: obs.ref_high,
      status: getMarkerStatus(Number(obs.value), obs.ref_low, obs.ref_high),
      observed_at: obs.observed_at,
      document_id: obs.document_id,
      observation_kind: obs.observation_kind,
      source: obs.document_id ? sourceById.get(obs.document_id) ?? null : null,
    });
    bySystem.set(systemId, markers);
  }

  const systems: SystemInsight[] = [];
  const systemOrder: BodySystemId[] = [
    "cardiovascular",
    "metabolic",
    "thyroid",
    "liver",
    "kidney",
    "blood",
    "vitamins",
    "general",
  ];

  for (const systemId of systemOrder) {
    const markers = bySystem.get(systemId) ?? [];
    if (markers.length === 0) continue;

    const name = systemId === "general" ? "General" : BODY_SYSTEMS[systemId].name;

    systems.push({
      id: systemId,
      name,
      state_score: computeSystemStateScore(markers),
      data_confidence: computeSystemDataConfidence(systemId, markers),
      primary_source: selectPrimarySource(markers),
      why_highlighted: buildWhyHighlighted(markers),
      markers,
    });
  }

  const stateScores = systems.map((system) => system.state_score);
  const confidenceScores = systems.map((system) => system.data_confidence);

  return {
    records_used_count: sources.length,
    overall_state_score: average(stateScores),
    overall_data_confidence: average(confidenceScores),
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
  vitamins: { anchorX: 215, anchorY: 232, label: "Nutrients", side: "left" },
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

export function stateScoreColor(score: number): string {
  if (score >= 70) return "fill-emerald-500 stroke-emerald-600";
  if (score >= 40) return "fill-amber-500 stroke-amber-600";
  return "fill-slate-400 stroke-slate-500";
}

export function stateScoreStroke(score: number): string {
  if (score >= 70) return "#059669";
  if (score >= 40) return "#d97706";
  return "#64748b";
}

export function assessmentStatusLabel(stateScore: number, dataConfidence: number): string {
  if (dataConfidence < 40) return "Limited data";
  if (stateScore >= 70) return "Stable";
  return "Needs attention";
}
