export type DocumentType = "lab" | "imaging" | "consultation" | "dicom";

export const DOCUMENT_TYPES: DocumentType[] = ["lab", "imaging", "consultation", "dicom"];

export function isDocumentType(value: string): value is DocumentType {
  return DOCUMENT_TYPES.includes(value as DocumentType);
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
};

export type SystemMarker = {
  key: string;
  name: string;
  value: number;
  unit: string;
  status: MarkerStatus;
  observed_at: string;
  document_id: string | null;
};

export type SystemInsight = {
  id: BodySystemId;
  name: string;
  coverage: number;
  markers: SystemMarker[];
};

export type HealthProfileSource = {
  id: string;
  original_filename: string;
  observed_at: string | null;
  lab_name: string | null;
};

export type HealthProfileResult = {
  records_used_count: number;
  overall_coverage: number;
  systems: SystemInsight[];
  sources: HealthProfileSource[];
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

function systemCoverage(expectedMarkers: string[], presentKeys: Set<string>): number {
  if (expectedMarkers.length === 0) return presentKeys.size > 0 ? 100 : 0;
  const present = expectedMarkers.filter((k) => presentKeys.has(k)).length;
  return Math.round((present / expectedMarkers.length) * 100);
}

export function buildHealthProfile(
  observations: ObservationInput[],
  sources: HealthProfileSource[]
): HealthProfileResult {
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
      status: getMarkerStatus(Number(obs.value), obs.ref_low, obs.ref_high),
      observed_at: obs.observed_at,
      document_id: obs.document_id,
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

    const presentKeys = new Set(markers.map((m) => m.key));
    let coverage: number;
    let name: string;

    if (systemId === "general") {
      coverage = 100;
      name = "General";
    } else {
      const config = BODY_SYSTEMS[systemId];
      name = config.name;
      coverage = systemCoverage(config.markers, presentKeys);
    }

    systems.push({ id: systemId, name, coverage, markers });
  }

  const coverageValues = systems.map((s) => s.coverage);
  const overall_coverage =
    coverageValues.length > 0
      ? Math.round(coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length)
      : 0;

  return {
    records_used_count: sources.length,
    overall_coverage,
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
