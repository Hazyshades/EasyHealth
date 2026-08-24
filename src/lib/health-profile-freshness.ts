import { type NamedBodySystemId } from "@/lib/biomarkers";
import { NAMED_BODY_SYSTEMS } from "@/lib/biomarkers/registry-v2-runtime";

export type FreshnessStatus = "current" | "outdated" | "unknown_date";

export type HealthProfileFreshnessPolicy = Readonly<{
  version: string;
  /** Applies only to systems outside the Registry-v2 named set (general/supporting data). */
  defaultMaxAgeDays: number;
  maxAgeDaysBySystem: Readonly<Record<NamedBodySystemId, number>>;
}>;

/**
 * Technical product policy for current-state scoring. This is not a clinical
 * monitoring interval or a recommendation to order a test.
 */
export const HEALTH_PROFILE_FRESHNESS_POLICY: HealthProfileFreshnessPolicy = {
  version: "eh-144.v1",
  defaultMaxAgeDays: 365,
  maxAgeDaysBySystem: {
    cardiovascular: 365,
    metabolic: 365,
    thyroid: 365,
    liver: 365,
    kidney: 365,
    blood: 365,
    nutrients: 365,
    inflammation: 365,
  },
};

export const FRESHNESS_STATUS_LABELS: Readonly<Record<FreshnessStatus, string>> = {
  current: "Current under this assessment policy",
  outdated: "Outdated under this assessment policy",
  unknown_date: "Currentness could not be evaluated",
};

function calendarDayNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return null;

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(date.getTime() / 86_400_000);
}

export function isCompleteCalendarDate(value: unknown): value is string {
  return calendarDayNumber(value) != null;
}

export function getFreshnessMaxAgeDays(
  systemId: string,
  policy: HealthProfileFreshnessPolicy = HEALTH_PROFILE_FRESHNESS_POLICY,
): number {
  if (!(NAMED_BODY_SYSTEMS as readonly string[]).includes(systemId)) {
    return policy.defaultMaxAgeDays;
  }
  return policy.maxAgeDaysBySystem[systemId as NamedBodySystemId];
}

export function evaluateObservationFreshness(options: {
  measuredAt: string | null | undefined;
  asOf: string;
  maxAgeDays: number;
}): FreshnessStatus {
  const measuredDay = calendarDayNumber(options.measuredAt);
  const asOfDay = calendarDayNumber(options.asOf);
  if (
    measuredDay == null ||
    asOfDay == null ||
    !Number.isInteger(options.maxAgeDays) ||
    options.maxAgeDays < 0
  ) {
    return "unknown_date";
  }

  const ageInDays = asOfDay - measuredDay;
  if (ageInDays < 0) return "unknown_date";
  return ageInDays <= options.maxAgeDays ? "current" : "outdated";
}

export function evaluateSystemObservationFreshness(options: {
  systemId: string;
  measuredAt: string | null | undefined;
  asOf: string;
  policy?: HealthProfileFreshnessPolicy;
}): FreshnessStatus {
  const policy = options.policy ?? HEALTH_PROFILE_FRESHNESS_POLICY;
  return evaluateObservationFreshness({
    measuredAt: options.measuredAt,
    asOf: options.asOf,
    maxAgeDays: getFreshnessMaxAgeDays(options.systemId, policy),
  });
}
