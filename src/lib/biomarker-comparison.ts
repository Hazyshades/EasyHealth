import { isCensoredLabValueCell } from "@/lib/biomarkers";

export type ComparisonDocumentSource = {
  id: string;
  original_filename: string;
  lab_name?: string | null;
};

export type ComparisonObservation = {
  id: string;
  name: string;
  measurement_definition_key: string | null;
  trend_eligible?: boolean;
  conversion_eligible?: boolean;
  value: number | string | null;
  unit: string | null;
  ref_low: number | string | null;
  ref_high: number | string | null;
  observed_at: string | null;
  document_id: string | null;
  documents?: ComparisonDocumentSource | null;
  value_kind?: string | null;
  value_text?: string | null;
  original_value?: number | string | null;
  original_unit?: string | null;
  original_ref_low?: number | string | null;
  original_ref_high?: number | string | null;
  converted?: boolean;
  specimen?: string | null;
  modifier?: string | null;
};

export type MeasurementComparisonPoint = {
  id: string;
  observedAt: string;
  displayValue: number;
  displayUnit: string | null;
  displayReferenceLow: number | null;
  displayReferenceHigh: number | null;
  nativeValue: number;
  nativeUnit: string | null;
  nativeReferenceLow: number | null;
  nativeReferenceHigh: number | null;
  conversionEligible: boolean;
  converted: boolean;
  source: {
    documentId: string;
    href: string;
    filename: string;
    laboratory: string | null;
  } | null;
};

export type MeasurementComparisonSeries = {
  id: string;
  measurementDefinitionKey: string;
  label: string;
  unit: string | null;
  normalized: boolean;
  points: MeasurementComparisonPoint[];
};

export type ComparisonDateRange = {
  from: string | null;
  to: string | null;
};

function numericValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonEmpty(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeComparisonUnit(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/μ/g, "µ")
    .replace(/\s+/g, " ");
}

export function isComparisonIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function pointSource(observation: ComparisonObservation): MeasurementComparisonPoint["source"] {
  const documentId = nonEmpty(observation.document_id);
  if (!documentId) return null;
  const document = observation.documents ?? null;
  return {
    documentId,
    href: `/app/documents/${documentId}`,
    filename: nonEmpty(document?.original_filename) ?? "Source document",
    laboratory: nonEmpty(document?.lab_name),
  };
}

function projectPoint(observation: ComparisonObservation): MeasurementComparisonPoint | null {
  if (isCensoredLabValueCell(observation.value_text) || isCensoredLabValueCell(observation.value)) {
    return null;
  }
  if (observation.value_kind && observation.value_kind !== "numeric") return null;
  if (!observation.trend_eligible || !observation.measurement_definition_key) return null;
  if (!isComparisonIsoDate(observation.observed_at)) return null;

  const displayValue = numericValue(observation.value);
  if (displayValue === null) return null;

  const nativeValue = numericValue(observation.original_value) ?? displayValue;
  return {
    id: observation.id,
    observedAt: observation.observed_at,
    displayValue,
    displayUnit: nonEmpty(observation.unit),
    displayReferenceLow: numericValue(observation.ref_low),
    displayReferenceHigh: numericValue(observation.ref_high),
    nativeValue,
    nativeUnit: nonEmpty(observation.original_unit),
    nativeReferenceLow:
      observation.original_ref_low === undefined
        ? null
        : numericValue(observation.original_ref_low),
    nativeReferenceHigh:
      observation.original_ref_high === undefined
        ? null
        : numericValue(observation.original_ref_high),
    conversionEligible: observation.conversion_eligible === true,
    converted: observation.converted === true,
    source: pointSource(observation),
  };
}


export function buildMeasurementComparisonSeries(
  observations: readonly ComparisonObservation[],
): MeasurementComparisonSeries[] {
  const definitionGroups = new Map<
    string,
    { name: string; points: MeasurementComparisonPoint[] }
  >();

  for (const observation of observations) {
    const point = projectPoint(observation);
    const definitionKey = observation.measurement_definition_key;
    if (!point || !definitionKey) continue;

    const group = definitionGroups.get(definitionKey) ?? {
      name: nonEmpty(observation.name) ?? "Measurement",
      points: [],
    };
    group.points.push(point);
    definitionGroups.set(definitionKey, group);
  }

  const series: MeasurementComparisonSeries[] = [];
  for (const [measurementDefinitionKey, group] of definitionGroups) {
    const displayUnitGroups = new Map<string, MeasurementComparisonPoint[]>();
    for (const point of group.points) {
      const displayUnitKey =
        normalizeComparisonUnit(point.displayUnit) || "__unit_not_recorded__";
      const points = displayUnitGroups.get(displayUnitKey) ?? [];
      points.push(point);
      displayUnitGroups.set(displayUnitKey, points);
    }

    for (const [displayUnitKey, displayPoints] of displayUnitGroups) {
      const conversionEligible = displayPoints.every((point) => point.conversionEligible);
      const nativeUnitKeys = new Set(
        displayPoints.map(
          (point) =>
            normalizeComparisonUnit(point.nativeUnit) || "__native_unit_not_recorded__",
        ),
      );
      const splitByNativeUnit = !conversionEligible && nativeUnitKeys.size > 1;
      const nativeGroups = new Map<string, MeasurementComparisonPoint[]>();

      for (const point of displayPoints) {
        const nativeUnitKey = splitByNativeUnit
          ? normalizeComparisonUnit(point.nativeUnit) || "__native_unit_not_recorded__"
          : "__shared__";
        const points = nativeGroups.get(nativeUnitKey) ?? [];
        points.push(point);
        nativeGroups.set(nativeUnitKey, points);
      }

      for (const [nativeUnitKey, points] of nativeGroups) {
        const sortedPoints = [...points].sort((left, right) => {
          const byDate = left.observedAt.localeCompare(right.observedAt);
          return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
        });
        const unit = sortedPoints[0]?.displayUnit ?? null;
        const nativeVariant =
          splitByNativeUnit && sortedPoints[0]?.nativeUnit
            ? ` (native ${sortedPoints[0].nativeUnit})`
            : splitByNativeUnit
              ? " (native unit not recorded)"
              : "";
        series.push({
          id: `${measurementDefinitionKey}::${displayUnitKey}::${nativeUnitKey}`,
          measurementDefinitionKey,
          label: `${group.name || "Measurement"}${unit ? ` · ${unit}` : " · Unit not recorded"}${nativeVariant}`,
          unit,
          normalized:
            conversionEligible && sortedPoints.some((point) => point.converted),
          points: sortedPoints,
        });
      }
    }
  }

  return series.sort((left, right) => {
    const byLabel = left.label.localeCompare(right.label);
    return byLabel !== 0 ? byLabel : left.id.localeCompare(right.id);
  });
}

export function filterMeasurementComparisonSeries(
  series: readonly MeasurementComparisonSeries[],
  range: ComparisonDateRange,
): MeasurementComparisonSeries[] {
  return series
    .map((item) => ({
      ...item,
      points: item.points.filter((point) => {
        if (range.from && point.observedAt < range.from) return false;
        if (range.to && point.observedAt > range.to) return false;
        return true;
      }),
    }))
    .filter((item) => item.points.length > 0);
}
