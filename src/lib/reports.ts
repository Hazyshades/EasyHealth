import { createHmac } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildDocumentStructuredContext } from "@/lib/documents/structured-context";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { sanitizeReportStrings } from "@/lib/report-text";
import {
  BIOMARKER_DYNAMICS_SCHEMA_VERSION,
  buildBiomarkerDynamicsReport,
  parseBiomarkerDynamicsPeriod,
  type BiomarkerDynamicsPeriod,
  type BiomarkerDynamicsReport,
} from "@/lib/biomarker-dynamics";
import { normalizeComparisonUnit } from "@/lib/biomarker-comparison";
import { BIOMARKER_DIRECTION_POLICY_VERSION } from "@/lib/biomarker-dynamics-policy";

const DEFAULT_DYNAMICS_INTEGRITY_KEY_ID = "service-role-v1";

export type PersistedBiomarkerDynamicsBinding = Readonly<{
  schema_version: typeof BIOMARKER_DYNAMICS_SCHEMA_VERSION;
  direction_policy_version: typeof BIOMARKER_DIRECTION_POLICY_VERSION;
  biomarker_dynamics_period: BiomarkerDynamicsPeriod;
  report_scope_document_ids: readonly string[];
  generated_at: string;
  integrity_key_id: string;
  integrity_tag: string;
  dto: BiomarkerDynamicsReport;
}>;

export class InvalidPersistedBiomarkerDynamicsError extends Error {
  readonly code = "invalid_persisted_biomarker_dynamics";

  constructor(message: string) {
    super(message);
    this.name = "InvalidPersistedBiomarkerDynamicsError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
const DYNAMICS_DIRECTIONS = new Set([
  "increasing",
  "decreasing",
  "stable",
  "not_available",
]);
const DYNAMICS_LIMITATION_CODES = new Set([
  "undated",
  "non_numeric",
  "ineligible",
  "unsupported_unit",
  "comparison_unavailable",
  "direction_policy_unavailable",
]);
const DYNAMICS_EXCLUSION_REASONS = new Set([
  "undated",
  "non_numeric",
  "ineligible",
  "unsupported_unit",
]);
const DYNAMICS_INCOMPATIBILITY_REASONS = new Set([
  "measurement_definition",
  "specimen",
  "modifier",
  "method",
  "scale",
  "unit",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFiniteNumberOrNull(value: unknown): boolean {
  return (
    value === null || (typeof value === "number" && Number.isFinite(value))
  );
}

function isUuidArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isUuid);
}

type DynamicsIntegrityInput = {
  schema_version: string;
  direction_policy_version: string;
  biomarker_dynamics_period: BiomarkerDynamicsPeriod;
  report_scope_document_ids: readonly string[];
  generated_at: string;
  integrity_key_id: string;
  dto: unknown;
};

function canonicalizeDynamicsValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeDynamicsValue).join(",")}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalizeDynamicsValue(value[key])}`,
      )
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "undefined" : serialized;
}

type DynamicsIntegrityKey = Readonly<{
  id: string;
  secret: string;
}>;

function currentDynamicsIntegrityKey(): DynamicsIntegrityKey {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const id =
    process.env.BIOMARKER_DYNAMICS_INTEGRITY_KEY_ID?.trim() ||
    DEFAULT_DYNAMICS_INTEGRITY_KEY_ID;
  if (!secret || !id) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Persisted biomarker dynamics integrity key is unavailable",
    );
  }
  return { id, secret };
}

function dynamicsIntegritySecretFor(keyId: string): string {
  const current = currentDynamicsIntegrityKey();
  if (keyId === current.id) return current.secret;

  const previousId =
    process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_KEY_ID?.trim();
  const previousSecret =
    process.env.BIOMARKER_DYNAMICS_PREVIOUS_INTEGRITY_SECRET?.trim();
  if (keyId === previousId && previousSecret) return previousSecret;

  throw new InvalidPersistedBiomarkerDynamicsError(
    "Persisted biomarker dynamics integrity key is unsupported",
  );
}

function dynamicsIntegrityTag(
  input: DynamicsIntegrityInput,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(canonicalizeDynamicsValue(input))
    .digest("hex");
}

type PersistedDynamicsIdentity = {
  measurementDefinitionKey: string;
  analyteKey: string | null;
  specimen: string | null;
  modifier: string | null;
  method: string | null;
  scale: string | null;
};

function isDynamicsIdentity(
  value: unknown,
): value is PersistedDynamicsIdentity {
  return (
    isObject(value) &&
    isNonEmptyString(value.measurementDefinitionKey) &&
    isNullableString(value.analyteKey) &&
    isNullableString(value.specimen) &&
    isNullableString(value.modifier) &&
    isNullableString(value.method) &&
    isNullableString(value.scale)
  );
}
function sameDynamicsIdentity(
  left: PersistedDynamicsIdentity,
  right: PersistedDynamicsIdentity,
): boolean {
  return (
    left.measurementDefinitionKey === right.measurementDefinitionKey &&
    left.analyteKey === right.analyteKey &&
    left.specimen === right.specimen &&
    left.modifier === right.modifier &&
    left.method === right.method &&
    left.scale === right.scale
  );
}

function isGregorianDynamicsDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

function isDynamicsObservedAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const datePrefix = value.slice(0, 10);
  return (
    isGregorianDynamicsDate(datePrefix) &&
    (value.length === 10 || Number.isFinite(Date.parse(value)))
  );
}

function isDynamicsPoint(
  value: unknown,
  scopeSet: ReadonlySet<string>,
): boolean {
  if (!isObject(value)) return false;
  const source = value.source;
  const conversion = value.conversion;
  return (
    isUuid(value.observationId) &&
    isNonEmptyString(value.documentId) &&
    scopeSet.has(value.documentId) &&
    isDynamicsObservedAt(value.observedAt) &&
    typeof value.nativeValue === "number" &&
    Number.isFinite(value.nativeValue) &&
    isNullableString(value.nativeUnit) &&
    isFiniteNumberOrNull(value.nativeReferenceLow) &&
    isFiniteNumberOrNull(value.nativeReferenceHigh) &&
    typeof value.displayValue === "number" &&
    Number.isFinite(value.displayValue) &&
    isNullableString(value.displayUnit) &&
    isFiniteNumberOrNull(value.displayReferenceLow) &&
    isFiniteNumberOrNull(value.displayReferenceHigh) &&
    isObject(conversion) &&
    typeof conversion.applied === "boolean" &&
    isNullableString(conversion.note) &&
    isNullableString(conversion.nativeUnit) &&
    isNullableString(conversion.displayUnit) &&
    isDynamicsIdentity(value.identity) &&
    isObject(source) &&
    source.documentId === value.documentId &&
    source.href === `/app/documents/${value.documentId}` &&
    isNonEmptyString(source.filename) &&
    isNullableString(source.laboratory)
  );
}

const DYNAMICS_IDENTITY_KEYS = new Set([
  "measurementDefinitionKey",
  "analyteKey",
  "specimen",
  "modifier",
  "method",
  "scale",
]);

function isDynamicsExclusion(
  value: unknown,
  scopeSet: ReadonlySet<string>,
): boolean {
  if (!isObject(value)) return false;
  const identity = value.identity;
  const validIdentity =
    identity === null ||
    (isObject(identity) &&
      Object.keys(identity).every((key) => DYNAMICS_IDENTITY_KEYS.has(key)) &&
      isNonEmptyString(identity.measurementDefinitionKey) &&
      (identity.analyteKey === undefined ||
        isNullableString(identity.analyteKey)) &&
      (identity.specimen === undefined ||
        isNullableString(identity.specimen)) &&
      (identity.modifier === undefined ||
        isNullableString(identity.modifier)) &&
      (identity.method === undefined || isNullableString(identity.method)) &&
      (identity.scale === undefined || isNullableString(identity.scale)));
  return (
    isUuid(value.observationId) &&
    (value.documentId === null ||
      (isNonEmptyString(value.documentId) && scopeSet.has(value.documentId))) &&
    isNullableString(value.label) &&
    typeof value.reason === "string" &&
    DYNAMICS_EXCLUSION_REASONS.has(value.reason) &&
    isNonEmptyString(value.detail) &&
    validIdentity &&
    isNullableString(value.unit)
  );
}

function isDynamicsLimitation(
  value: unknown,
  seriesIds: ReadonlySet<string>,
): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.code === "string" &&
    DYNAMICS_LIMITATION_CODES.has(value.code) &&
    isNonEmptyString(value.message) &&
    isUuidArray(value.observationIds) &&
    (value.seriesId === null ||
      (isNonEmptyString(value.seriesId) && seriesIds.has(value.seriesId)))
  );
}

function isDynamicsIncompatibility(
  value: unknown,
  seriesIds: ReadonlySet<string>,
): boolean {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.label) &&
    typeof value.reason === "string" &&
    DYNAMICS_INCOMPATIBILITY_REASONS.has(value.reason) &&
    isNonEmptyString(value.detail) &&
    Array.isArray(value.seriesIds) &&
    value.seriesIds.length > 0 &&
    value.seriesIds.every(
      (seriesId) => isNonEmptyString(seriesId) && seriesIds.has(seriesId),
    ) &&
    isUuidArray(value.observationIds)
  );
}

function isDynamicsSeries(
  value: unknown,
  scopeSet: ReadonlySet<string>,
): boolean {
  if (!isObject(value)) return false;
  const label = value.label;
  const measurementDefinitionKey = value.measurementDefinitionKey;
  const analyteKey = value.analyteKey;
  const displayUnit = value.displayUnit;
  const nativeUnit = value.nativeUnit;
  const normalized = value.normalized;
  const statistics = value.statistics;
  const directionTolerance = value.directionTolerance;
  const identity = value.identity;
  const points = value.points;
  const limitations = value.limitations;
  if (
    !isNonEmptyString(label) ||
    !isNonEmptyString(measurementDefinitionKey) ||
    !isNullableString(analyteKey) ||
    !isNullableString(displayUnit) ||
    !isNullableString(nativeUnit) ||
    typeof normalized !== "boolean" ||
    !isObject(statistics) ||
    !isDynamicsIdentity(identity) ||
    identity.measurementDefinitionKey !== measurementDefinitionKey ||
    identity.analyteKey !== analyteKey ||
    !Array.isArray(points) ||
    !Array.isArray(limitations)
  ) {
    return false;
  }
  const pointCount = statistics.pointCount;
  if (
    typeof pointCount !== "number" ||
    !Number.isInteger(pointCount) ||
    !isFiniteNumberOrNull(statistics.minimum) ||
    !isFiniteNumberOrNull(statistics.maximum) ||
    (statistics.latest !== null &&
      !isDynamicsPoint(statistics.latest, scopeSet)) ||
    typeof value.direction !== "string" ||
    !DYNAMICS_DIRECTIONS.has(value.direction) ||
    points.length !== pointCount ||
    !points.every((point) => {
      if (
        !isDynamicsPoint(point, scopeSet) ||
        !isObject(point) ||
        !isDynamicsIdentity(point.identity)
      ) {
        return false;
      }
      return (
        sameDynamicsIdentity(point.identity, identity) &&
        point.displayUnit === displayUnit
      );
    })
  ) {
    return false;
  }
  return (
    directionTolerance === null ||
    (isObject(directionTolerance) &&
      isNonEmptyString(directionTolerance.measurementDefinitionKey) &&
      isNonEmptyString(directionTolerance.displayUnit) &&
      typeof directionTolerance.absolute === "number" &&
      Number.isFinite(directionTolerance.absolute) &&
      typeof directionTolerance.relative === "number" &&
      Number.isFinite(directionTolerance.relative) &&
      directionTolerance.measurementDefinitionKey ===
        measurementDefinitionKey &&
      normalizeComparisonUnit(directionTolerance.displayUnit) ===
        normalizeComparisonUnit(displayUnit) &&
      directionTolerance.policyVersion === BIOMARKER_DIRECTION_POLICY_VERSION &&
      directionTolerance.reviewStatus === "reviewed")
  );
}

function isValidDynamicsDto(
  dto: Record<string, unknown>,
  scopeSet: ReadonlySet<string>,
): boolean {
  if (
    !isNonEmptyString(dto.disclaimer) ||
    !Array.isArray(dto.series) ||
    !Array.isArray(dto.excluded) ||
    !Array.isArray(dto.limitations) ||
    !Array.isArray(dto.incompatibilities)
  ) {
    return false;
  }
  const seriesIds = new Set(
    dto.series
      .filter(isObject)
      .map((series) => series.id)
      .filter(isNonEmptyString),
  );
  const exclusionIds = new Set(
    dto.excluded
      .filter(isObject)
      .map((exclusion) => exclusion.observationId)
      .filter(isNonEmptyString),
  );
  const validExcluded = dto.excluded.every((exclusion) =>
    isDynamicsExclusion(exclusion, scopeSet),
  );
  const validSeries = dto.series.every((series) => {
    if (
      !isDynamicsSeries(series, scopeSet) ||
      !isObject(series) ||
      !isNonEmptyString(series.id) ||
      !Array.isArray(series.limitations)
    ) {
      return false;
    }
    const seriesId = series.id;
    return series.limitations.every((limitation) =>
      isDynamicsLimitation(limitation, new Set<string>([seriesId])),
    );
  });
  return (
    seriesIds.size === dto.series.length &&
    exclusionIds.size === dto.excluded.length &&
    validExcluded &&
    validSeries &&
    dto.limitations.every((limitation) =>
      isDynamicsLimitation(limitation, seriesIds),
    ) &&
    dto.incompatibilities.every((incompatibility) =>
      isDynamicsIncompatibility(incompatibility, seriesIds),
    )
  );
}
function sameSerializedValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameSerializedValue(value, right[index]))
    );
  }
  if (isObject(left) || isObject(right)) {
    if (!isObject(left) || !isObject(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          sameSerializedValue(left[key], right[key]),
      )
    );
  }
  return false;
}

function hasDeterministicDynamicsValues(
  dto: Record<string, unknown>,
  period: BiomarkerDynamicsPeriod,
  scopeIds: readonly string[],
): boolean {
  try {
    const report = dto as unknown as BiomarkerDynamicsReport;
    const recomputed = buildBiomarkerDynamicsReport(
      {
        scopeKind: "report_immutable",
        scopeDocumentIds: [...scopeIds],
        candidates: [],
        series: report.series,
        excluded: report.excluded,
        incompatibilities: [],
        generatedAt: report.generatedAt,
      },
      period,
    );

    if (
      !sameSerializedValue(report.limitations, recomputed.limitations) ||
      !sameSerializedValue(
        report.incompatibilities,
        recomputed.incompatibilities,
      )
    ) {
      return false;
    }

    return report.series.every((series) => {
      const expected = recomputed.series.find(
        (candidate) => candidate.id === series.id,
      );
      if (!expected) return false;
      if (!sameSerializedValue(series.points, expected.points)) return false;
      if (!sameSerializedValue(series.limitations, expected.limitations)) {
        return false;
      }
      return (
        series.statistics.pointCount === expected.statistics.pointCount &&
        series.statistics.minimum === expected.statistics.minimum &&
        series.statistics.maximum === expected.statistics.maximum &&
        sameSerializedValue(
          series.statistics.latest,
          expected.statistics.latest,
        ) &&
        series.direction === expected.direction &&
        sameSerializedValue(
          series.directionTolerance,
          expected.directionTolerance,
        )
      );
    });
  } catch {
    return false;
  }
}

export function createPersistedBiomarkerDynamicsBinding(
  report: BiomarkerDynamicsReport,
): PersistedBiomarkerDynamicsBinding {
  const period = parseBiomarkerDynamicsPeriod(report.period);
  if (!period || report.scope.kind !== "report_immutable") {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Only an immutable report dynamics scope with a selected period can be persisted",
    );
  }
  if (
    report.schemaVersion !== BIOMARKER_DYNAMICS_SCHEMA_VERSION ||
    report.directionPolicyVersion !== BIOMARKER_DIRECTION_POLICY_VERSION
  ) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Dynamics schema or direction policy version is not supported",
    );
  }
  const integrityKey = currentDynamicsIntegrityKey();
  const binding = {
    schema_version: BIOMARKER_DYNAMICS_SCHEMA_VERSION,
    direction_policy_version: BIOMARKER_DIRECTION_POLICY_VERSION,
    biomarker_dynamics_period: period,
    report_scope_document_ids: [...report.scope.documentIds],
    generated_at: report.generatedAt,
    integrity_key_id: integrityKey.id,
    dto: report,
  } as const;
  return {
    ...binding,
    integrity_tag: dynamicsIntegrityTag(binding, integrityKey.secret),
  };
}

export function resolvePersistedBiomarkerDynamics(
  content: unknown,
): PersistedBiomarkerDynamicsBinding | null {
  if (!isObject(content) || !("biomarker_dynamics" in content)) return null;
  const raw = content.biomarker_dynamics;
  if (!isObject(raw)) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Persisted biomarker dynamics binding is missing",
    );
  }

  const scopeIds = raw.report_scope_document_ids;
  const dto = raw.dto;
  if (
    raw.schema_version !== BIOMARKER_DYNAMICS_SCHEMA_VERSION ||
    raw.direction_policy_version !== BIOMARKER_DIRECTION_POLICY_VERSION ||
    !isNonEmptyString(raw.integrity_key_id) ||
    typeof raw.generated_at !== "string" ||
    raw.generated_at.length === 0 ||
    !Number.isFinite(Date.parse(raw.generated_at)) ||
    typeof raw.integrity_tag !== "string" ||
    !/^[0-9a-f]{64}$/i.test(raw.integrity_tag) ||
    !Array.isArray(scopeIds) ||
    scopeIds.length === 0 ||
    !scopeIds.every(isUuid) ||
    !isObject(dto)
  ) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Persisted biomarker dynamics metadata is incomplete or unsupported",
    );
  }

  let period: BiomarkerDynamicsPeriod | null;
  try {
    period = parseBiomarkerDynamicsPeriod(raw.biomarker_dynamics_period);
  } catch {
    period = null;
  }
  if (!period) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Persisted biomarker dynamics period is invalid",
    );
  }

  const dtoScope = isObject(dto.scope) ? dto.scope : null;
  const dtoPeriod = isObject(dto.period) ? dto.period : null;
  if (
    dto.schemaVersion !== BIOMARKER_DYNAMICS_SCHEMA_VERSION ||
    dto.directionPolicyVersion !== BIOMARKER_DIRECTION_POLICY_VERSION ||
    dto.generatedAt !== raw.generated_at ||
    dtoPeriod == null ||
    dtoScope?.kind !== "report_immutable" ||
    !Array.isArray(dtoScope.documentIds) ||
    !sameIdSet(scopeIds, dtoScope.documentIds) ||
    dtoPeriod.start !== period.start ||
    dtoPeriod.end !== period.end
  ) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Persisted biomarker dynamics DTO does not match its binding metadata",
    );
  }

  const integrityKeyId = raw.integrity_key_id as string;
  const integritySecret = dynamicsIntegritySecretFor(integrityKeyId);
  const integrityInput: DynamicsIntegrityInput = {
    schema_version: BIOMARKER_DYNAMICS_SCHEMA_VERSION,
    direction_policy_version: BIOMARKER_DIRECTION_POLICY_VERSION,
    biomarker_dynamics_period: period,
    report_scope_document_ids: scopeIds as string[],
    generated_at: raw.generated_at as string,
    integrity_key_id: integrityKeyId,
    dto,
  };
  if (
    raw.integrity_tag !== dynamicsIntegrityTag(integrityInput, integritySecret)
  ) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Persisted biomarker dynamics integrity check failed",
    );
  }

  const scopeSet = new Set(scopeIds);
  if (!isValidDynamicsDto(dto, scopeSet)) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Persisted biomarker dynamics DTO is malformed",
    );
  }
  if (!hasDeterministicDynamicsValues(dto, period, scopeIds)) {
    throw new InvalidPersistedBiomarkerDynamicsError(
      "Persisted biomarker dynamics derived values are inconsistent",
    );
  }

  return raw as unknown as PersistedBiomarkerDynamicsBinding;
}

export async function getEligibleDocumentIds(
  profileId: string,
): Promise<string[]> {
  const supabase = createAdminClient();

  const [
    { data: observations },
    { data: findings },
    { data: clinicalNotes },
    { data: prescriptions },
    { data: referrals },
  ] = await Promise.all([
    supabase
      .from("observations")
      .select("document_id")
      .eq("profile_id", profileId)
      .not("document_id", "is", null),
    supabase
      .from("document_extracted_findings")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted"),
    supabase
      .from("document_extracted_clinical_notes")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted")
      .eq("is_published", true),
    supabase
      .from("document_extracted_prescriptions")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted")
      .eq("is_published", true),
    supabase
      .from("document_extracted_referrals")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted")
      .eq("is_published", true),
  ]);

  const candidateIds = [
    ...new Set(
      [
        ...(observations ?? []).map((o) => o.document_id),
        ...(findings ?? []).map((f) => f.document_id),
        ...(clinicalNotes ?? []).map((c) => c.document_id),
        ...(prescriptions ?? []).map((p) => p.document_id),
        ...(referrals ?? []).map((r) => r.document_id),
      ].filter((id): id is string => typeof id === "string"),
    ),
  ];

  if (candidateIds.length === 0) return [];

  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select("id, status, processing_status, archived_at")
    .eq("profile_id", profileId)
    .is("archived_at", null)
    .in("id", candidateIds);

  if (docError) throw new Error(docError.message);

  return (documents ?? [])
    .filter(
      (doc) =>
        doc.status === "completed" ||
        doc.processing_status === "ready" ||
        doc.processing_status === "needs_review",
    )
    .map((d) => d.id);
}

export type ObservationRow = {
  name: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status?: string | null;
  verification_status?: string | null;
  decision_source?: "persisted" | "preview" | "none";
  decision_quality?: "available" | "unavailable" | "conflict";
  decision_not_persisted?: boolean;
  decision_quality_codes?: readonly string[];
  registry_binding_ready?: boolean;
  value_kind?: string | null;
  value_text?: string | null;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  documents?: { original_filename: string; observed_at: string | null } | null;
};

export type ReportContextItem = {
  biomarker: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  verification_status: string | null;
  decision_source: "persisted" | "preview" | "none";
  decision_quality: "available" | "unavailable" | "conflict";
  decision_not_persisted: boolean;
  decision_quality_codes: readonly string[];
  registry_binding_ready: boolean;
  value_kind: string | null;
  value_text: string | null;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  source: string;
};

export type MultiSourceReportContext = {
  biomarkers: ReportContextItem[];
  instrumental_findings: Array<{
    filename: string;
    modality: string | null;
    body_region: string | null;
    finding_text: string;
    impression: string | null;
    study_date: string | null;
  }>;
  consultation_notes: Array<{
    filename: string;
    provider_name: string | null;
    visit_date: string | null;
    chief_complaint: string | null;
    documented_problems: string[];
    recommendations: string[];
    follow_up_plan: string | null;
  }>;
  discharge_summaries: Array<{
    filename: string;
    provider_name: string | null;
    admission_date: string | null;
    discharge_date: string | null;
    hospital_course: string | null;
    discharge_diagnoses: string[];
    discharge_medications: string[];
    follow_up_instructions: string | null;
  }>;
  prescriptions: Array<{
    filename: string;
    prescriber_name: string | null;
    prescribed_at: string | null;
    medications: Array<{
      name: string;
      dose: string | null;
      frequency: string | null;
      duration: string | null;
      instructions: string | null;
    }>;
  }>;
  referrals: Array<{
    filename: string;
    referring_provider: string | null;
    referred_to_specialty: string | null;
    referred_to_provider: string | null;
    referral_date: string | null;
    reason_for_referral: string | null;
    clinical_summary: string | null;
    urgency: string | null;
  }>;
  document_summaries: Array<{
    filename: string;
    document_type: string;
    summary: string;
  }>;
};

export function isAbnormalObservation(
  o: Pick<
    ObservationRow,
    "value" | "ref_low" | "ref_high" | "registry_binding_ready"
  >,
): boolean {
  if (o.registry_binding_ready === false) {
    return false;
  }
  if (o.value == null || Number.isNaN(Number(o.value))) return false;
  const value = Number(o.value);
  if (o.ref_low != null && value < o.ref_low) return true;
  if (o.ref_high != null && value > o.ref_high) return true;
  return false;
}

export function filterAbnormalObservations<T extends ObservationRow>(
  observations: T[],
): T[] {
  return observations.filter(isAbnormalObservation);
}

export function buildReportContext(
  observations: ObservationRow[],
): ReportContextItem[] {
  return observations.map((o) => ({
    biomarker: o.name,
    analyte_key: o.analyte_key,
    measurement_definition_key: o.measurement_definition_key,
    resolution_status: o.resolution_status ?? null,
    verification_status: o.verification_status ?? null,
    decision_source: o.decision_source ?? "none",
    decision_quality: o.decision_quality ?? "unavailable",
    decision_not_persisted: o.decision_not_persisted === true,
    decision_quality_codes: o.decision_quality_codes ?? [],
    registry_binding_ready: o.registry_binding_ready === true,
    value_kind: o.value_kind ?? null,
    value_text: o.value_text ?? null,
    value: o.value,
    unit: o.unit,
    ref_low: o.ref_low,
    ref_high: o.ref_high,
    observed_at: o.observed_at,
    source: o.documents?.original_filename ?? "unknown",
  }));
}

export function buildMultiSourceReportContext(
  structured: Awaited<ReturnType<typeof buildDocumentStructuredContext>>,
  observations: ObservationRow[],
  abnormalOnly: boolean,
): MultiSourceReportContext {
  const scopedObservations = abnormalOnly
    ? filterAbnormalObservations(observations)
    : observations;

  return {
    biomarkers: buildReportContext(scopedObservations),
    instrumental_findings: structured.instrumental_findings.map((f) => ({
      filename: f.filename,
      modality: f.modality,
      body_region: f.body_region,
      finding_text: f.finding_text,
      impression: f.impression,
      study_date: f.study_date,
    })),
    consultation_notes: structured.consultation_notes.map((c) => ({
      filename: c.filename,
      provider_name: c.provider_name,
      visit_date: c.visit_date,
      chief_complaint: c.chief_complaint,
      documented_problems: c.documented_problems,
      recommendations: c.recommendations,
      follow_up_plan: c.follow_up_plan,
    })),
    discharge_summaries: structured.discharge_summaries.map((d) => ({
      filename: d.filename,
      provider_name: d.provider_name,
      admission_date: d.admission_date ?? null,
      discharge_date: d.discharge_date ?? null,
      hospital_course: d.hospital_course ?? null,
      discharge_diagnoses: d.discharge_diagnoses ?? [],
      discharge_medications: d.discharge_medications ?? [],
      follow_up_instructions: d.follow_up_instructions ?? null,
    })),
    prescriptions: structured.prescriptions.map((p) => ({
      filename: p.filename,
      prescriber_name: p.prescriber_name,
      prescribed_at: p.prescribed_at,
      medications: p.medications,
    })),
    referrals: structured.referrals.map((r) => ({
      filename: r.filename,
      referring_provider: r.referring_provider,
      referred_to_specialty: r.referred_to_specialty,
      referred_to_provider: r.referred_to_provider,
      referral_date: r.referral_date,
      reason_for_referral: r.reason_for_referral,
      clinical_summary: r.clinical_summary,
      urgency: r.urgency,
    })),
    document_summaries: structured.document_summaries.map((s) => ({
      filename: s.filename,
      document_type: s.document_type,
      summary: s.summary,
    })),
  };
}

export function hasReportContextContent(
  context: MultiSourceReportContext,
): boolean {
  return (
    context.biomarkers.length > 0 ||
    context.instrumental_findings.length > 0 ||
    context.consultation_notes.length > 0 ||
    context.discharge_summaries.length > 0 ||
    context.prescriptions.length > 0 ||
    context.referrals.length > 0 ||
    context.document_summaries.length > 0
  );
}

export function buildSummaryPreview(overview: string): string {
  const trimmed = overview.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 120).trimEnd()}…`;
}

export function withDisclaimer<T extends { disclaimer?: string }>(content: T) {
  return { ...sanitizeReportStrings(content), disclaimer: MEDICAL_DISCLAIMER };
}
