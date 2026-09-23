/**
 * EH-149: Biomarker Dynamics Report — pure projection layer.
 *
 * Public signature:
 *   buildBiomarkerDynamicsReport(input: AuthorizedBiomarkerComparison, period)
 *     -> BiomarkerDynamicsReport
 *
 * Pure: never resolves authorization or queries storage.
 */

import {
  compareCanonicalObservationId,
  computeDirection,
  DIRECTION_POLICY_VERSION,
  type DirectionTolerance,
} from "./biomarker-dynamics-policy";
import { normalizeComparisonUnit } from "./biomarker-comparison";

export const BIOMARKER_DYNAMICS_SCHEMA_VERSION = "1";

export type BiomarkerDynamicsLimitationType =
  | "undated"
  | "non_numeric"
  | "ineligible"
  | "unsupported_unit"
  | "comparison_unavailable"
  | "scope_excluded"
  | "tolerance_unavailable";

export type BiomarkerDynamicsLimitation = {
  type: BiomarkerDynamicsLimitationType;
  message: string;
  detail?: string;
  observationId?: string;
};

export type BiomarkerDynamicsIncompatibility = {
  groupingReason: string;
  affectedSeriesLabels: string[];
};

export type BiomarkerDynamicsPoint = {
  id: string;
  observedAt: string;
  documentId: string;
  nativeValue: number | null;
  nativeUnit: string | null;
  displayValue: number | null;
  displayUnit: string | null;
  nativeReferenceLow: number | null;
  nativeReferenceHigh: number | null;
  displayReferenceLow: number | null;
  displayReferenceHigh: number | null;
  conversionMetadata: {
    converted: boolean;
    originalValue: number | null;
    originalUnit: string | null;
    conversionEligible: boolean;
  } | null;
  source: {
    documentId: string;
    href: string;
    filename: string;
    laboratory: string | null;
  } | null;
};

export type BiomarkerDynamicsStatistics = {
  pointCount: number;
  min: number | null;
  max: number | null;
  latest: BiomarkerDynamicsPoint | null;
  nativeUnit: string | null;
  displayUnit: string | null;
};

export type BiomarkerDynamicsDirectionValue =
  | "increasing"
  | "decreasing"
  | "stable"
  | "not_available";

export type BiomarkerDynamicsDirection = {
  value: BiomarkerDynamicsDirectionValue;
  tolerance: DirectionTolerance | undefined;
  limitation: BiomarkerDynamicsLimitation | null;
};

export type BiomarkerDynamicsSeries = {
  id: string;
  measurementDefinitionKey: string;
  label: string;
  specimen: string | null;
  modifier: string | null;
  method: string | null;
  scale: string | null;
  unit: string | null;
  direction: BiomarkerDynamicsDirection;
  statistics: BiomarkerDynamicsStatistics;
  points: BiomarkerDynamicsPoint[];
  limitations: BiomarkerDynamicsLimitation[];
  tolerance: DirectionTolerance | undefined;
};

export type AuthorizedComparisonObservation = {
  id: string;
  name: string;
  value: number | string | null;
  unit: string | null;
  originalValue: number | string | null;
  originalUnit: string | null;
  refLow: number | string | null;
  refHigh: number | string | null;
  originalRefLow: number | string | null;
  originalRefHigh: number | string | null;
  observedAt: string | null;
  documentId: string | null;
  documents?: {
    id: string;
    original_filename: string;
    lab_name?: string | null;
  } | null;
  valueKind: string | null;
  converted: boolean;
  conversionEligible: boolean;
  trendEligible: boolean;
  specimen: string | null;
  modifier: string | null;
  method: string | null;
  scale: string | null;
  measurementDefinitionKey: string | null;
};

export type AuthorizedBiomarkerComparison = {
  scope_kind: "profile_current" | "report_immutable";
  scope_document_ids: string[];
  series: Array<{
    id: string;
    measurementDefinitionKey: string;
    name: string;
    specimen: string | null;
    modifier: string | null;
    method: string | null;
    scale: string | null;
    observations: AuthorizedComparisonObservation[];
  }>;
  excluded: Array<{
    observationId: string;
    reason: "undated" | "non_numeric" | "ineligible" | "unsupported_unit";
    message: string;
    detail?: string;
  }>;
  incompatibilities: Array<{
    groupingReason: string;
    affectedLabels: string[];
  }>;
};

export type BiomarkerDynamicsPeriod = {
  start: string;
  end: string;
};

export type BiomarkerDynamicsReport = {
  schemaVersion: string;
  directionPolicyVersion: string;
  period: BiomarkerDynamicsPeriod | null;
  series: BiomarkerDynamicsSeries[];
  incompatibilities: BiomarkerDynamicsIncompatibility[];
  limitations: BiomarkerDynamicsLimitation[];
  disclaimer: string;
  generationMetadata: {
    scopeKind: "profile_current" | "report_immutable";
    scopeDocumentIds: string[];
    generatedAt: string;
  };
};

/** Frozen extension handed to EH-148 / required by EH-153. */
export type FrozenBiomarkerDynamicsExtension = {
  schemaVersion: string;
  directionPolicyVersion: string;
  biomarker_dynamics_period: BiomarkerDynamicsPeriod;
  report_scope_document_ids: string[];
  generatedAt: string;
  report: BiomarkerDynamicsReport;
};

export const DYNAMICS_DISCLAIMER =
  "Numeric direction describes movement only (increasing, decreasing, or stable). It is not improvement, deterioration, treatment response, or a diagnosis. Educational information only — not medical advice.";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCanonicalDate(
  value: string | null | undefined,
): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

export type PeriodValidation =
  | { valid: true; period: BiomarkerDynamicsPeriod | null }
  | { valid: false; error: string };

/**
 * Omitting both start and end means no period filter.
 * Providing either requires both canonical YYYY-MM-DD values with start <= end.
 */
export function validatePeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): PeriodValidation {
  const hasStart = Boolean(start);
  const hasEnd = Boolean(end);
  if (!hasStart && !hasEnd) {
    return { valid: true, period: null };
  }
  if (!hasStart || !hasEnd) {
    return {
      valid: false,
      error: "Period requires both start and end as canonical YYYY-MM-DD",
    };
  }
  if (!isValidCanonicalDate(start) || !isValidCanonicalDate(end)) {
    return {
      valid: false,
      error: "Period must use canonical YYYY-MM-DD format",
    };
  }
  if (start! > end!) {
    return { valid: false, error: "Period start must be <= end" };
  }
  return { valid: true, period: { start: start!, end: end! } };
}

function utcCalendarDate(observedAt: string): string {
  return observedAt.includes("T") ? observedAt.split("T")[0]! : observedAt.slice(0, 10);
}

function isWithinPeriod(
  observedAt: string | null,
  period: BiomarkerDynamicsPeriod | null,
): boolean {
  if (!observedAt) return false;
  if (!period) return true;
  const dateStr = utcCalendarDate(observedAt);
  if (!ISO_DATE_RE.test(dateStr)) return false;
  return dateStr >= period.start && dateStr <= period.end;
}

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

function pointSource(
  documentId: string | null,
  documents?: {
    id: string;
    original_filename: string;
    lab_name?: string | null;
  } | null,
): BiomarkerDynamicsPoint["source"] {
  const id = nonEmpty(documentId);
  if (!id) return null;
  return {
    documentId: id,
    href: `/app/documents/${id}`,
    filename: nonEmpty(documents?.original_filename) ?? "Source document",
    laboratory: nonEmpty(documents?.lab_name),
  };
}

function sortDynamicsPoints(points: BiomarkerDynamicsPoint[]): BiomarkerDynamicsPoint[] {
  return [...points].sort((a, b) => {
    const byDate = a.observedAt.localeCompare(b.observedAt);
    return byDate !== 0 ? byDate : compareCanonicalObservationId(a.id, b.id);
  });
}

function projectDynamicsPoint(
  obs: AuthorizedComparisonObservation,
  period: BiomarkerDynamicsPeriod | null,
  scopeDocumentIds: ReadonlySet<string>,
): BiomarkerDynamicsPoint | null {
  if (!obs.trendEligible) return null;
  if (!obs.measurementDefinitionKey) return null;
  if (!obs.documentId || !scopeDocumentIds.has(obs.documentId)) return null;
  if (!isWithinPeriod(obs.observedAt, period)) return null;
  if (obs.valueKind && obs.valueKind !== "numeric") return null;

  const displayValue = numericValue(obs.value);
  if (displayValue === null) return null;

  const nativeValue = numericValue(obs.originalValue) ?? displayValue;
  const observedAt = obs.observedAt ?? "";

  return {
    id: obs.id,
    observedAt,
    documentId: obs.documentId,
    nativeValue,
    nativeUnit: nonEmpty(obs.originalUnit),
    displayValue,
    displayUnit: nonEmpty(obs.unit),
    nativeReferenceLow: numericValue(obs.originalRefLow),
    nativeReferenceHigh: numericValue(obs.originalRefHigh),
    displayReferenceLow: numericValue(obs.refLow),
    displayReferenceHigh: numericValue(obs.refHigh),
    conversionMetadata: {
      converted: obs.converted,
      originalValue: numericValue(obs.originalValue),
      originalUnit: nonEmpty(obs.originalUnit),
      conversionEligible: obs.conversionEligible,
    },
    source: pointSource(obs.documentId, obs.documents),
  };
}

export function buildBiomarkerDynamicsReport(
  input: AuthorizedBiomarkerComparison,
  periodInput: { start: string | null; end: string | null } | null,
): BiomarkerDynamicsReport {
  const validation = validatePeriod(
    periodInput?.start ?? null,
    periodInput?.end ?? null,
  );
  if (!validation.valid) {
    throw new Error(`Invalid period: ${validation.error}`);
  }

  const period = validation.period;
  const now = new Date().toISOString();
  const scopeDocIds = new Set(input.scope_document_ids);
  const limitations: BiomarkerDynamicsLimitation[] = [];
  const incompatibilities: BiomarkerDynamicsIncompatibility[] =
    input.incompatibilities.map((inc) => ({
      groupingReason: inc.groupingReason,
      affectedSeriesLabels: inc.affectedLabels,
    }));

  for (const exc of input.excluded) {
    limitations.push({
      type: exc.reason,
      message: exc.message,
      detail: exc.detail,
      observationId: exc.observationId,
    });
  }

  for (const seriesData of input.series) {
    for (const obs of seriesData.observations) {
      if (obs.documentId && !scopeDocIds.has(obs.documentId)) {
        limitations.push({
          type: "scope_excluded",
          message: `Observation from document ${obs.documentId} is outside the authorized scope`,
          detail:
            "This point was excluded because its source document is not within the authorized report scope",
          observationId: obs.id,
        });
      }
    }
  }

  const series: BiomarkerDynamicsSeries[] = input.series.map((seriesData) => {
    const definitionKey = seriesData.measurementDefinitionKey;
    const points = sortDynamicsPoints(
      seriesData.observations
        .map((obs) => projectDynamicsPoint(obs, period, scopeDocIds))
        .filter((point): point is BiomarkerDynamicsPoint => point !== null),
    );

    const displayUnit = points[0]?.displayUnit ?? null;
    const nativeUnit = points[0]?.nativeUnit ?? null;
    const values = points
      .map((p) => p.displayValue)
      .filter((v): v is number => v !== null);
    const min = values.length > 0 ? Math.min(...values) : null;
    const max = values.length > 0 ? Math.max(...values) : null;
    const latest = points.length > 0 ? points[points.length - 1]! : null;

    const seriesLimitations: BiomarkerDynamicsLimitation[] = [];
    let directionLimitation: BiomarkerDynamicsLimitation | null = null;

    if (points.length < 2) {
      directionLimitation = {
        type: "comparison_unavailable",
        message:
          "Comparison requires at least two numeric data points in the selected period",
        detail:
          points.length === 0
            ? "No numeric points are available in the selected period"
            : "Only one numeric point is available in the selected period",
      };
      seriesLimitations.push(directionLimitation);
    }

    const directionResult = computeDirection(
      definitionKey,
      displayUnit ?? "",
      points.map((point) => ({
        observedAt: point.observedAt,
        observationId: point.id,
        displayValue: point.displayValue!,
      })),
    );

    if (
      points.length >= 2 &&
      directionResult.direction === "not_available" &&
      !directionResult.tolerance
    ) {
      directionLimitation = {
        type: "tolerance_unavailable",
        message:
          "No approved numeric threshold exists for this measurement definition and display unit",
        detail: "Direction classification requires a reviewed tolerance entry",
      };
      seriesLimitations.push(directionLimitation);
    }

    for (const obs of seriesData.observations) {
      if (!obs.observedAt) {
        seriesLimitations.push({
          type: "undated",
          message: "Observation has no date and is excluded from dynamics",
          observationId: obs.id,
        });
      }
      if (obs.valueKind && obs.valueKind !== "numeric") {
        seriesLimitations.push({
          type: "non_numeric",
          message: "Observation is non-numeric and excluded from statistics",
          observationId: obs.id,
        });
      }
    }

    return {
      id: seriesData.id,
      measurementDefinitionKey: definitionKey,
      label: seriesData.name,
      specimen: seriesData.specimen,
      modifier: seriesData.modifier,
      method: seriesData.method,
      scale: seriesData.scale,
      unit: displayUnit,
      direction: {
        value: directionResult.direction,
        tolerance: directionResult.tolerance,
        limitation: directionLimitation,
      },
      statistics: {
        pointCount: points.length,
        min,
        max,
        latest,
        nativeUnit,
        displayUnit,
      },
      points,
      limitations: seriesLimitations,
      tolerance: directionResult.tolerance,
    };
  });

  return {
    schemaVersion: BIOMARKER_DYNAMICS_SCHEMA_VERSION,
    directionPolicyVersion: DIRECTION_POLICY_VERSION,
    period,
    series,
    incompatibilities,
    limitations,
    disclaimer: DYNAMICS_DISCLAIMER,
    generationMetadata: {
      scopeKind: input.scope_kind,
      scopeDocumentIds: [...input.scope_document_ids],
      generatedAt: now,
    },
  };
}

export function buildFrozenBiomarkerDynamicsExtension(
  report: BiomarkerDynamicsReport,
  period: BiomarkerDynamicsPeriod,
  reportScopeDocumentIds: readonly string[],
): FrozenBiomarkerDynamicsExtension {
  return {
    schemaVersion: report.schemaVersion,
    directionPolicyVersion: report.directionPolicyVersion,
    biomarker_dynamics_period: period,
    report_scope_document_ids: [...reportScopeDocumentIds],
    generatedAt: report.generationMetadata.generatedAt,
    report,
  };
}

export type PersistedDynamicsResolution =
  | { ok: true; extension: FrozenBiomarkerDynamicsExtension }
  | { ok: false; reason: string };

/**
 * Fail-closed reader for a persisted EH-149 extension.
 * Does not rebuild from observations or accept a client-substituted DTO.
 */
export function resolvePersistedBiomarkerDynamicsExtension(
  value: unknown,
  expectedScopeDocumentIds?: readonly string[],
): PersistedDynamicsResolution {
  if (value == null || typeof value !== "object") {
    return { ok: false, reason: "Missing biomarker dynamics extension" };
  }
  const ext = value as Record<string, unknown>;
  if (ext.schemaVersion !== BIOMARKER_DYNAMICS_SCHEMA_VERSION) {
    return { ok: false, reason: "Unsupported or tampered dynamics schema version" };
  }
  if (ext.directionPolicyVersion !== DIRECTION_POLICY_VERSION) {
    return {
      ok: false,
      reason: "Unsupported or tampered dynamics direction-policy version",
    };
  }
  const period = ext.biomarker_dynamics_period;
  if (
    !period ||
    typeof period !== "object" ||
    !isValidCanonicalDate((period as BiomarkerDynamicsPeriod).start) ||
    !isValidCanonicalDate((period as BiomarkerDynamicsPeriod).end) ||
    (period as BiomarkerDynamicsPeriod).start >
      (period as BiomarkerDynamicsPeriod).end
  ) {
    return { ok: false, reason: "Tampered or invalid biomarker_dynamics_period" };
  }
  const scopeIds = ext.report_scope_document_ids;
  if (!Array.isArray(scopeIds) || scopeIds.some((id) => typeof id !== "string")) {
    return { ok: false, reason: "Tampered or missing report_scope_document_ids" };
  }
  if (expectedScopeDocumentIds) {
    const expected = new Set(expectedScopeDocumentIds);
    if (
      scopeIds.length !== expected.size ||
      scopeIds.some((id) => !expected.has(id))
    ) {
      return {
        ok: false,
        reason: "Persisted dynamics scope does not match report scope",
      };
    }
  }
  const report = ext.report;
  if (!report || typeof report !== "object") {
    return { ok: false, reason: "Missing frozen dynamics report payload" };
  }
  const typedReport = report as BiomarkerDynamicsReport;
  for (const series of typedReport.series ?? []) {
    for (const point of series.points ?? []) {
      if (!scopeIds.includes(point.documentId)) {
        return {
          ok: false,
          reason: "Frozen dynamics point is outside persisted report scope",
        };
      }
    }
  }
  if (typeof ext.generatedAt !== "string" || !ext.generatedAt) {
    return { ok: false, reason: "Missing dynamics generation metadata" };
  }

  return {
    ok: true,
    extension: {
      schemaVersion: String(ext.schemaVersion),
      directionPolicyVersion: String(ext.directionPolicyVersion),
      biomarker_dynamics_period: period as BiomarkerDynamicsPeriod,
      report_scope_document_ids: scopeIds as string[],
      generatedAt: String(ext.generatedAt),
      report: typedReport,
    },
  };
}

export function seriesIdentityKey(input: {
  measurementDefinitionKey: string;
  displayUnit: string | null;
  nativeUnit: string | null;
  splitByNativeUnit: boolean;
  specimen: string | null;
  modifier: string | null;
  method: string | null;
  scale: string | null;
}): string {
  const displayUnitKey =
    normalizeComparisonUnit(input.displayUnit) || "__unit_not_recorded__";
  const nativeUnitKey = input.splitByNativeUnit
    ? normalizeComparisonUnit(input.nativeUnit) || "__native_unit_not_recorded__"
    : "__shared__";
  return [
    input.measurementDefinitionKey,
    displayUnitKey,
    nativeUnitKey,
    input.specimen ?? "unspecified",
    input.modifier ?? "none",
    input.method ?? "unspecified",
    input.scale ?? "unspecified",
  ].join("::");
}

/** Presented observation shape consumed by the authorized comparison builder. */
export type DynamicsPresentedObservation = {
  id: string;
  name: string;
  measurement_definition_key: string | null;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string | null;
  document_id: string | null;
  documents: {
    id: string;
    original_filename: string;
    lab_name?: string | null;
  } | null;
  value_kind: string | null;
  value_text: string | null;
  converted: boolean;
  original_value: number | null;
  original_unit: string | null;
  original_ref_low: number | null;
  original_ref_high: number | null;
  trend_eligible: boolean;
  conversion_eligible: boolean;
  registry_binding_ready: boolean;
  specimen: string | null;
  modifier: string | null;
  method: string | null;
  scale: string | null;
};

/**
 * Pure builder for the authorized comparison snapshot.
 * Callers supply already-presented rows; this never queries storage.
 */
export function buildAuthorizedBiomarkerComparison(
  observations: readonly DynamicsPresentedObservation[],
  scope: "profile_current" | "report_immutable",
  scopeDocumentIds: readonly string[],
): AuthorizedBiomarkerComparison {
  const scopeSet = new Set(scopeDocumentIds);
  const excluded: AuthorizedBiomarkerComparison["excluded"] = [];
  const retained: DynamicsPresentedObservation[] = [];

  for (const obs of observations) {
    if (!obs.document_id || !scopeSet.has(obs.document_id)) {
      continue;
    }
    if (!obs.measurement_definition_key || !obs.trend_eligible) {
      excluded.push({
        observationId: obs.id,
        reason: "ineligible",
        message: !obs.measurement_definition_key
          ? "Observation has no measurement definition key"
          : "Observation is not trend eligible",
      });
      continue;
    }
    if (!obs.observed_at) {
      excluded.push({
        observationId: obs.id,
        reason: "undated",
        message: "Observation has no observed date",
      });
      continue;
    }
    if (obs.value_kind && obs.value_kind !== "numeric") {
      excluded.push({
        observationId: obs.id,
        reason: "non_numeric",
        message: "Observation value is not numeric",
      });
      continue;
    }
    if (obs.value == null || !Number.isFinite(obs.value)) {
      excluded.push({
        observationId: obs.id,
        reason: "non_numeric",
        message: "Observation value is not numeric",
      });
      continue;
    }
    if (
      obs.unit != null &&
      obs.unit.trim() !== "" &&
      normalizeComparisonUnit(obs.unit) === ""
    ) {
      excluded.push({
        observationId: obs.id,
        reason: "unsupported_unit",
        message: "Observation has an unsupported unit",
      });
      continue;
    }
    retained.push(obs);
  }

  const byDefinition = new Map<string, DynamicsPresentedObservation[]>();
  for (const obs of retained) {
    const key = obs.measurement_definition_key!;
    const list = byDefinition.get(key) ?? [];
    list.push(obs);
    byDefinition.set(key, list);
  }

  const seriesMap = new Map<
    string,
    AuthorizedBiomarkerComparison["series"][number]
  >();

  for (const [definitionKey, group] of byDefinition) {
    const byDisplayUnit = new Map<string, DynamicsPresentedObservation[]>();
    for (const obs of group) {
      const displayKey =
        normalizeComparisonUnit(obs.unit) || "__unit_not_recorded__";
      const list = byDisplayUnit.get(displayKey) ?? [];
      list.push(obs);
      byDisplayUnit.set(displayKey, list);
    }

    for (const [, displayGroup] of byDisplayUnit) {
      const conversionEligible = displayGroup.every(
        (row) => row.conversion_eligible,
      );
      const nativeUnitKeys = new Set(
        displayGroup.map(
          (row) =>
            normalizeComparisonUnit(row.original_unit) ||
            "__native_unit_not_recorded__",
        ),
      );
      const splitByNativeUnit = !conversionEligible && nativeUnitKeys.size > 1;

      for (const row of displayGroup) {
        const id = seriesIdentityKey({
          measurementDefinitionKey: definitionKey,
          displayUnit: row.unit,
          nativeUnit: row.original_unit,
          splitByNativeUnit,
          specimen: row.specimen,
          modifier: row.modifier,
          method: row.method,
          scale: row.scale,
        });

        if (!seriesMap.has(id)) {
          const unitLabel = row.unit?.trim() ? row.unit : "Unit not recorded";
          const nativeVariant =
            splitByNativeUnit && row.original_unit
              ? ` (native ${row.original_unit})`
              : splitByNativeUnit
                ? " (native unit not recorded)"
                : "";
          seriesMap.set(id, {
            id,
            measurementDefinitionKey: definitionKey,
            name: `${row.name || "Measurement"} · ${unitLabel}${nativeVariant}`,
            specimen: row.specimen,
            modifier: row.modifier,
            method: row.method,
            scale: row.scale,
            observations: [],
          });
        }

        const candidate: AuthorizedComparisonObservation = {
          id: row.id,
          name: row.name,
          value: row.value,
          unit: row.unit,
          originalValue: row.original_value,
          originalUnit: row.original_unit,
          refLow: row.ref_low,
          refHigh: row.ref_high,
          originalRefLow: row.original_ref_low,
          originalRefHigh: row.original_ref_high,
          observedAt: row.observed_at,
          documentId: row.document_id,
          documents: row.documents,
          valueKind: row.value_kind ?? "numeric",
          converted: row.converted,
          conversionEligible: row.conversion_eligible,
          trendEligible: row.trend_eligible,
          specimen: row.specimen,
          modifier: row.modifier,
          method: row.method,
          scale: row.scale,
          measurementDefinitionKey: definitionKey,
        };
        seriesMap.get(id)!.observations.push(candidate);
      }
    }
  }

  const incompatibilities: AuthorizedBiomarkerComparison["incompatibilities"] =
    [];
  const byDisplayName = new Map<
    string,
    AuthorizedBiomarkerComparison["series"]
  >();
  for (const series of seriesMap.values()) {
    const displayName = series.name.split(" · ")[0]!.toLowerCase();
    const list = byDisplayName.get(displayName) ?? [];
    list.push(series);
    byDisplayName.set(displayName, list);
  }
  for (const [, group] of byDisplayName) {
    if (group.length < 2) continue;
    const reasons = new Set<string>();
    const labels: string[] = [];
    for (const series of group) {
      labels.push(series.name);
      reasons.add(`definition: ${series.measurementDefinitionKey}`);
      if (series.specimen) reasons.add(`specimen: ${series.specimen}`);
      if (series.modifier && series.modifier !== "none") {
        reasons.add(`modifier: ${series.modifier}`);
      }
      if (series.method) reasons.add(`method: ${series.method}`);
      if (series.scale) reasons.add(`scale: ${series.scale}`);
      const units = new Set(
        series.observations.map(
          (o) => normalizeComparisonUnit(o.unit) || "__none__",
        ),
      );
      if (units.size > 0) {
        reasons.add(`unit: ${[...units].join("|")}`);
      }
    }
    incompatibilities.push({
      groupingReason: `Same display name has incompatible identity: ${[
        ...reasons,
      ].join(", ")}`,
      affectedLabels: labels,
    });
  }

  return {
    scope_kind: scope,
    scope_document_ids: [...scopeDocumentIds],
    series: [...seriesMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    excluded,
    incompatibilities,
  };
}
