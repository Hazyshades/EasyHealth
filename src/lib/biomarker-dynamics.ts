import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { normalizeComparisonUnit } from "@/lib/biomarker-comparison";
import {
  BIOMARKER_DIRECTION_POLICY_VERSION,
  getBiomarkerDirectionTolerance,
  type BiomarkerDirectionTolerance,
} from "@/lib/biomarker-dynamics-policy";

export const BIOMARKER_DYNAMICS_SCHEMA_VERSION = "eh-149-dynamics-v1";

export type BiomarkerDynamicsScopeKind = "profile_current" | "report_immutable";

export type BiomarkerDynamicsPeriod = Readonly<{
  start: string;
  end: string;
}>;

export type BiomarkerDynamicsIdentity = Readonly<{
  measurementDefinitionKey: string;
  analyteKey: string | null;
  specimen: string | null;
  modifier: string | null;
  method: string | null;
  scale: string | null;
}>;

export type BiomarkerDynamicsConversion = Readonly<{
  applied: boolean;
  note: string | null;
  nativeUnit: string | null;
  displayUnit: string | null;
}>;

export type AuthorizedBiomarkerComparisonPoint = Readonly<{
  observationId: string;
  documentId: string;
  observedAt: string;
  nativeValue: number;
  nativeUnit: string | null;
  nativeReferenceLow: number | null;
  nativeReferenceHigh: number | null;
  displayValue: number;
  displayUnit: string | null;
  displayReferenceLow: number | null;
  displayReferenceHigh: number | null;
  conversion: BiomarkerDynamicsConversion;
  identity: BiomarkerDynamicsIdentity;
  source: Readonly<{
    documentId: string;
    filename: string;
    laboratory: string | null;
    href: string;
  }>;
}>;

export type AuthorizedBiomarkerComparisonCandidate = Readonly<{
  observationId: string;
  documentId: string | null;
  label: string | null;
  valueKind: string | null;
  identity: Partial<BiomarkerDynamicsIdentity> | null;
  point: AuthorizedBiomarkerComparisonPoint | null;
}>;

export type AuthorizedBiomarkerComparisonSeries = Readonly<{
  id: string;
  label: string;
  measurementDefinitionKey: string;
  analyteKey: string | null;
  displayUnit: string | null;
  nativeUnit: string | null;
  normalized: boolean;
  identity: BiomarkerDynamicsIdentity;
  points: readonly AuthorizedBiomarkerComparisonPoint[];
}>;

export type BiomarkerDynamicsExclusionReason =
  | "undated"
  | "non_numeric"
  | "ineligible"
  | "unsupported_unit";

export type AuthorizedBiomarkerComparisonExclusion = Readonly<{
  observationId: string;
  documentId: string | null;
  label: string | null;
  reason: BiomarkerDynamicsExclusionReason;
  detail: string;
  identity: Partial<BiomarkerDynamicsIdentity> | null;
  unit: string | null;
}>;

export type BiomarkerDynamicsIncompatibilityReason =
  | "measurement_definition"
  | "specimen"
  | "modifier"
  | "method"
  | "scale"
  | "unit";

export type BiomarkerDynamicsIncompatibility = Readonly<{
  id: string;
  label: string;
  reason: BiomarkerDynamicsIncompatibilityReason;
  detail: string;
  seriesIds: readonly string[];
  observationIds: readonly string[];
}>;

export type AuthorizedBiomarkerComparison = Readonly<{
  scopeKind: BiomarkerDynamicsScopeKind;
  scopeDocumentIds: readonly string[];
  candidates: readonly AuthorizedBiomarkerComparisonCandidate[];
  series: readonly AuthorizedBiomarkerComparisonSeries[];
  excluded: readonly AuthorizedBiomarkerComparisonExclusion[];
  incompatibilities: readonly BiomarkerDynamicsIncompatibility[];
  generatedAt: string;
}>;

export type BiomarkerDynamicsDirection =
  | "increasing"
  | "decreasing"
  | "stable"
  | "not_available";

export type BiomarkerDynamicsLimitationCode =
  | BiomarkerDynamicsExclusionReason
  | "comparison_unavailable"
  | "direction_policy_unavailable";

export type BiomarkerDynamicsLimitation = Readonly<{
  code: BiomarkerDynamicsLimitationCode;
  message: string;
  observationIds: readonly string[];
  seriesId: string | null;
}>;

export type BiomarkerDynamicsStatistics = Readonly<{
  pointCount: number;
  minimum: number | null;
  maximum: number | null;
  latest: AuthorizedBiomarkerComparisonPoint | null;
}>;

export type BiomarkerDynamicsSeries = Readonly<{
  id: string;
  label: string;
  measurementDefinitionKey: string;
  analyteKey: string | null;
  displayUnit: string | null;
  nativeUnit: string | null;
  normalized: boolean;
  identity: BiomarkerDynamicsIdentity;
  statistics: BiomarkerDynamicsStatistics;
  direction: BiomarkerDynamicsDirection;
  directionTolerance: BiomarkerDirectionTolerance | null;
  points: readonly AuthorizedBiomarkerComparisonPoint[];
  limitations: readonly BiomarkerDynamicsLimitation[];
}>;

export type BiomarkerDynamicsReport = Readonly<{
  schemaVersion: string;
  directionPolicyVersion: string;
  generatedAt: string;
  period: BiomarkerDynamicsPeriod | null;
  scope: Readonly<{
    kind: BiomarkerDynamicsScopeKind;
    documentIds: readonly string[];
  }>;
  series: readonly BiomarkerDynamicsSeries[];
  excluded: readonly AuthorizedBiomarkerComparisonExclusion[];
  limitations: readonly BiomarkerDynamicsLimitation[];
  incompatibilities: readonly BiomarkerDynamicsIncompatibility[];
  disclaimer: string;
}>;

export class BiomarkerDynamicsPeriodError extends Error {
  readonly code = "invalid_period";

  constructor(
    message = "Dynamics period must use canonical dates with start <= end",
  ) {
    super(message);
    this.name = "BiomarkerDynamicsPeriodError";
  }
}

const CANONICAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCanonicalBiomarkerDynamicsDate(
  value: unknown,
): value is string {
  if (typeof value !== "string") return false;
  const match = CANONICAL_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseBiomarkerDynamicsPeriod(
  period: unknown,
): BiomarkerDynamicsPeriod | null {
  if (period == null) return null;
  if (typeof period !== "object") throw new BiomarkerDynamicsPeriodError();
  const value = period as { start?: unknown; end?: unknown };
  if (
    !isCanonicalBiomarkerDynamicsDate(value.start) ||
    !isCanonicalBiomarkerDynamicsDate(value.end)
  ) {
    throw new BiomarkerDynamicsPeriodError();
  }
  if (value.start > value.end) throw new BiomarkerDynamicsPeriodError();
  return { start: value.start, end: value.end };
}

function numericTimestamp(value: string): number | null {
  if (isCanonicalBiomarkerDynamicsDate(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function utcCalendarDate(value: string): string | null {
  if (isCanonicalBiomarkerDynamicsDate(value)) return value;
  const timestamp = numericTimestamp(value);
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function compareUuidBytes(left: string, right: string): number {
  const leftMatch =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      left,
    );
  const rightMatch =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      right,
    );
  if (!leftMatch || !rightMatch) return left.localeCompare(right);
  const leftBytes = left.replaceAll("-", "").toLowerCase();
  const rightBytes = right.replaceAll("-", "").toLowerCase();
  return leftBytes < rightBytes ? -1 : leftBytes > rightBytes ? 1 : 0;
}

function comparePoints(
  left: AuthorizedBiomarkerComparisonPoint,
  right: AuthorizedBiomarkerComparisonPoint,
): number {
  const leftTimestamp = numericTimestamp(left.observedAt);
  const rightTimestamp = numericTimestamp(right.observedAt);
  if (
    leftTimestamp !== null &&
    rightTimestamp !== null &&
    leftTimestamp !== rightTimestamp
  ) {
    return leftTimestamp - rightTimestamp;
  }
  if (left.observedAt !== right.observedAt)
    return left.observedAt.localeCompare(right.observedAt);
  return compareUuidBytes(left.observationId, right.observationId);
}

function periodIncludes(
  observedAt: string,
  period: BiomarkerDynamicsPeriod | null,
): boolean {
  if (!period) return true;
  const date = utcCalendarDate(observedAt);
  return date !== null && date >= period.start && date <= period.end;
}

function limitation(
  code: BiomarkerDynamicsLimitationCode,
  message: string,
  observationIds: readonly string[] = [],
  seriesId: string | null = null,
): BiomarkerDynamicsLimitation {
  return { code, message, observationIds, seriesId };
}

function exclusionMessage(
  exclusion: AuthorizedBiomarkerComparisonExclusion,
): string {
  switch (exclusion.reason) {
    case "undated":
      return "This result has no usable observed date and is excluded from the selected period statistics.";
    case "non_numeric":
      return "This result is qualitative or not a finite number, so it is not used in numeric statistics.";
    case "ineligible":
      return "This result is not eligible for a dynamics comparison under the current Registry decision.";
    case "unsupported_unit":
      return "This result is not combined across unit variants; when a safe native projection is available, it remains in its native unit.";
  }
}

function identityDifference(
  left: BiomarkerDynamicsIdentity,
  right: BiomarkerDynamicsIdentity,
): BiomarkerDynamicsIncompatibilityReason | null {
  if (left.measurementDefinitionKey !== right.measurementDefinitionKey)
    return "measurement_definition";
  if (left.specimen !== right.specimen) return "specimen";
  if (left.modifier !== right.modifier) return "modifier";
  if (left.method !== right.method) return "method";
  if (left.scale !== right.scale) return "scale";
  return null;
}

function buildIncompatibilityDetail(
  reason: BiomarkerDynamicsIncompatibilityReason,
): string {
  switch (reason) {
    case "measurement_definition":
      return "The same display name maps to different measurement definitions.";
    case "specimen":
      return "The same display name uses different specimens.";
    case "modifier":
      return "The same display name uses different modifiers.";
    case "method":
      return "The same display name uses different methods.";
    case "scale":
      return "The same display name uses different scales.";
    case "unit":
      return "The same display name uses units that cannot be safely combined.";
  }
}

function reportIncompatibilities(
  series: readonly AuthorizedBiomarkerComparisonSeries[],
): BiomarkerDynamicsIncompatibility[] {
  const byLabel = new Map<string, AuthorizedBiomarkerComparisonSeries[]>();
  for (const item of series) {
    const key = item.label.trim().toLocaleLowerCase();
    const group = byLabel.get(key) ?? [];
    group.push(item);
    byLabel.set(key, group);
  }

  const result: BiomarkerDynamicsIncompatibility[] = [];
  for (const [labelKey, group] of byLabel) {
    if (group.length < 2) continue;
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < group.length;
        rightIndex += 1
      ) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        const reason =
          identityDifference(left.identity, right.identity) ??
          (left.displayUnit !== right.displayUnit ? "unit" : null);
        if (!reason) continue;
        const seriesIds = [left.id, right.id].sort();
        const observationIds = [...left.points, ...right.points]
          .map((point) => point.observationId)
          .sort(compareUuidBytes);
        result.push({
          id: `${labelKey}::${reason}::${seriesIds.join("|")}`,
          label: left.label,
          reason,
          detail: buildIncompatibilityDetail(reason),
          seriesIds,
          observationIds,
        });
      }
    }
  }
  return result;
}

function uniqueLimitations(
  values: readonly BiomarkerDynamicsLimitation[],
): BiomarkerDynamicsLimitation[] {
  const seen = new Set<string>();
  const result: BiomarkerDynamicsLimitation[] = [];
  for (const value of values) {
    const key = `${value.code}::${value.seriesId ?? ""}::${value.observationIds.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}
const DYNAMICS_IDENTITY_KEYS: readonly (keyof BiomarkerDynamicsIdentity)[] = [
  "measurementDefinitionKey",
  "analyteKey",
  "specimen",
  "modifier",
  "method",
  "scale",
];

function exclusionMatchesSeries(
  exclusion: AuthorizedBiomarkerComparisonExclusion,
  series: AuthorizedBiomarkerComparisonSeries,
): boolean {
  if (
    exclusion.label?.trim().toLocaleLowerCase() !==
    series.label.trim().toLocaleLowerCase()
  ) {
    return false;
  }

  const identity = exclusion.identity;
  if (!identity?.measurementDefinitionKey) return false;
  for (const key of DYNAMICS_IDENTITY_KEYS) {
    const value = identity[key];
    if (value != null && value !== series.identity[key]) return false;
  }

  const excludedUnit = normalizeComparisonUnit(exclusion.unit);
  if (
    excludedUnit &&
    ![series.displayUnit, series.nativeUnit]
      .map((unit) => normalizeComparisonUnit(unit))
      .includes(excludedUnit)
  ) {
    return false;
  }

  return true;
}

function buildSeries(
  input: AuthorizedBiomarkerComparisonSeries,
  period: BiomarkerDynamicsPeriod | null,
  exclusions: readonly AuthorizedBiomarkerComparisonExclusion[],
): BiomarkerDynamicsSeries {
  const points = input.points
    .filter((point) => periodIncludes(point.observedAt, period))
    .sort(comparePoints);
  const values = points.map((point) => point.displayValue);
  const tolerance =
    points.length >= 2
      ? getBiomarkerDirectionTolerance(
          input.measurementDefinitionKey,
          input.displayUnit,
        )
      : null;
  const seriesLimitations: BiomarkerDynamicsLimitation[] = [];

  const matchingExclusions = exclusions.filter((item) =>
    exclusionMatchesSeries(item, input),
  );
  for (const exclusion of matchingExclusions) {
    seriesLimitations.push(
      limitation(
        exclusion.reason,
        exclusionMessage(exclusion),
        [exclusion.observationId],
        input.id,
      ),
    );
  }

  let direction: BiomarkerDynamicsDirection = "not_available";
  if (points.length < 2) {
    seriesLimitations.push(
      limitation(
        "comparison_unavailable",
        "At least two numeric points are required for a numeric direction.",
        points.map((point) => point.observationId),
        input.id,
      ),
    );
  } else if (!tolerance) {
    seriesLimitations.push(
      limitation(
        "direction_policy_unavailable",
        "An approved numeric direction threshold is unavailable for this exact definition and display unit.",
        points.map((point) => point.observationId),
        input.id,
      ),
    );
  } else {
    const first = points[0].displayValue;
    const latest = points[points.length - 1].displayValue;
    const delta = latest - first;
    const threshold = Math.max(
      tolerance.absolute,
      tolerance.relative * Math.abs(first),
    );
    if (Math.abs(delta) <= threshold) direction = "stable";
    else if (delta > threshold) direction = "increasing";
    else direction = "decreasing";
  }

  return {
    id: input.id,
    label: input.label,
    measurementDefinitionKey: input.measurementDefinitionKey,
    analyteKey: input.analyteKey,
    displayUnit: input.displayUnit,
    nativeUnit: input.nativeUnit,
    normalized: input.normalized,
    identity: input.identity,
    statistics: {
      pointCount: points.length,
      minimum: values.length > 0 ? Math.min(...values) : null,
      maximum: values.length > 0 ? Math.max(...values) : null,
      latest: points[points.length - 1] ?? null,
    },
    direction,
    directionTolerance: tolerance,
    points,
    limitations: uniqueLimitations(seriesLimitations),
  };
}

export function buildBiomarkerDynamicsReport(
  input: AuthorizedBiomarkerComparison,
  selectedPeriod: unknown = null,
): BiomarkerDynamicsReport {
  const period = parseBiomarkerDynamicsPeriod(selectedPeriod);
  const series = input.series.map((item) =>
    buildSeries(item, period, input.excluded),
  );
  const limitations = input.excluded.map((exclusion) =>
    limitation(exclusion.reason, exclusionMessage(exclusion), [
      exclusion.observationId,
    ]),
  );
  const incompatibilities =
    input.incompatibilities.length > 0
      ? [...input.incompatibilities]
      : reportIncompatibilities(input.series);

  return {
    schemaVersion: BIOMARKER_DYNAMICS_SCHEMA_VERSION,
    directionPolicyVersion: BIOMARKER_DIRECTION_POLICY_VERSION,
    generatedAt: input.generatedAt,
    period,
    scope: {
      kind: input.scopeKind,
      documentIds: [...input.scopeDocumentIds],
    },
    series,
    excluded: [...input.excluded],
    limitations: uniqueLimitations(limitations),
    incompatibilities,
    disclaimer: MEDICAL_DISCLAIMER,
  };
}
