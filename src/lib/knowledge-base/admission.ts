import {
  getMeasurementDefinition,
  getPanelDefinition,
} from "@/lib/biomarkers";
import type { KnowledgeBaseReviewStatus, KnowledgeBaseSource } from "./types";

export const KNOWLEDGE_BASE_REVIEW_WINDOW_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

export type KnowledgeBasePolicyOptions = Readonly<{
  asOf?: Date;
  reviewWindowDays?: number;
}>;

export type KnowledgeBasePublicationReason =
  | "draft"
  | "in_review"
  | "deprecated"
  | "invalid_state"
  | "missing_review_evidence"
  | "unknown_subject"
  | "stale";

export type KnowledgeBasePublicationDecision =
  | Readonly<{
      public: true;
      reason: "published";
      reviewedAt: string;
    }>
  | Readonly<{
      public: false;
      reason: KnowledgeBasePublicationReason;
    }>;

export type CatalogAdmissionArticle = Readonly<{
  type: "measurement" | "panel";
  reviewStatus: KnowledgeBaseReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  sources: readonly KnowledgeBaseSource[];
  measurementDefinitionKeys?: readonly string[];
  panelKey?: string;
}>;

export function resolveAdmissionAsOf(value: Date | undefined): Date {
  if (value === undefined) return new Date();
  if (!Number.isFinite(value.getTime())) {
    throw new Error("Knowledge Base asOf must be a valid date");
  }
  return value;
}

export function resolveAdmissionReviewWindowDays(
  value: number | undefined,
): number {
  const days = value ?? KNOWLEDGE_BASE_REVIEW_WINDOW_DAYS;
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(
      "Knowledge Base reviewWindowDays must be a non-negative integer",
    );
  }
  return days;
}

function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isValidKnowledgeBaseTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond =
    match[7] === undefined ? 0 : Number(match[7].padEnd(3, "0"));
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  if (
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return false;
  }

  const offsetMs =
    (match[8] === "-" ? -1 : 1) * (offsetHour * 60 + offsetMinute) * 60_000;
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
    offsetMs;
  if (!Number.isFinite(utcMs)) return false;

  const wall = new Date(utcMs + offsetMs);
  return (
    wall.getUTCFullYear() === year &&
    wall.getUTCMonth() + 1 === month &&
    wall.getUTCDate() === day &&
    wall.getUTCHours() === hour &&
    wall.getUTCMinutes() === minute &&
    wall.getUTCSeconds() === second &&
    wall.getUTCMilliseconds() === millisecond
  );
}

function isPastTimestamp(value: unknown, asOf: Date): value is string {
  return (
    isValidKnowledgeBaseTimestamp(value) && Date.parse(value) < asOf.getTime()
  );
}

function normalizedSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

function hasHttpsSources(sources: readonly KnowledgeBaseSource[]): boolean {
  if (!Array.isArray(sources) || sources.length === 0) return false;
  const urls = new Set<string>();
  for (const source of sources) {
    const title = trimmed(source.title);
    const url = normalizedSourceUrl(source.url);
    if (!title || !url || urls.has(url)) return false;
    urls.add(url);
  }
  return true;
}

function reviewedMeasurementSubject(
  keys: readonly string[] | undefined,
): boolean {
  if (!keys || keys.length === 0) return false;
  return keys.every((key) => {
    const definition = getMeasurementDefinition(key);
    return (
      !!definition &&
      definition.maturity === "reviewed" &&
      definition.sourceProvenance.kind === "registry_v2_review"
    );
  });
}

function hasReviewedSubject(article: CatalogAdmissionArticle): boolean {
  if (article.type === "measurement") {
    return reviewedMeasurementSubject(article.measurementDefinitionKeys);
  }
  return Boolean(article.panelKey && getPanelDefinition(article.panelKey));
}

export function catalogArticleAgeDays(reviewedAt: string, asOf: Date): number {
  return Math.floor((asOf.getTime() - Date.parse(reviewedAt)) / DAY_MS);
}

export function decideCatalogAdmission(
  article: CatalogAdmissionArticle,
  options: KnowledgeBasePolicyOptions = {},
): KnowledgeBasePublicationDecision {
  const asOf = resolveAdmissionAsOf(options.asOf);
  const reviewWindowDays = resolveAdmissionReviewWindowDays(
    options.reviewWindowDays,
  );

  if (article.reviewStatus === "draft") return { public: false, reason: "draft" };
  if (article.reviewStatus === "in_review") {
    return { public: false, reason: "in_review" };
  }
  if (article.reviewStatus === "deprecated") {
    return { public: false, reason: "deprecated" };
  }
  if (article.reviewStatus !== "published") {
    return { public: false, reason: "invalid_state" };
  }

  const reviewedBy = trimmed(article.reviewedBy);
  const reviewedAt = article.reviewedAt;
  if (
    !reviewedBy ||
    !isPastTimestamp(reviewedAt, asOf) ||
    !hasHttpsSources(article.sources)
  ) {
    return { public: false, reason: "missing_review_evidence" };
  }
  if (!hasReviewedSubject(article)) {
    return { public: false, reason: "unknown_subject" };
  }
  if (asOf.getTime() - Date.parse(reviewedAt) > reviewWindowDays * DAY_MS) {
    return { public: false, reason: "stale" };
  }

  return { public: true, reason: "published", reviewedAt };
}

export function isPublicCatalogArticle(
  article: CatalogAdmissionArticle,
  options: KnowledgeBasePolicyOptions = {},
): boolean {
  return decideCatalogAdmission(article, options).public;
}
