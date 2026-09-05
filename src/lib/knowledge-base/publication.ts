import {
  KNOWLEDGE_BASE_ARTICLE_STATES,
  KNOWLEDGE_BASE_ARTICLE_TYPES,
  KNOWLEDGE_BASE_REVIEW_WINDOW_DAYS,
  KNOWLEDGE_BASE_ROUTE,
  type KnowledgeBaseArticle,
  type KnowledgeBaseArticleState,
  type KnowledgeBasePublicationDecision,
  type KnowledgeBaseStaleReport,
  type KnowledgeBaseValidationResult,
  type PublicKnowledgeBaseArticle,
} from "./publication-types";

const DAY_MS = 24 * 60 * 60 * 1000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

type PolicyOptions = Readonly<{
  asOf?: Date;
  reviewWindowDays?: number;
}>;

function resolveAsOf(value: Date | undefined): Date {
  if (value === undefined) return new Date();
  if (!Number.isFinite(value.getTime()))
    throw new Error("Knowledge Base asOf must be a valid date");
  return value;
}

function resolveReviewWindowDays(value: number | undefined): number {
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function articleSlug(article: unknown): string {
  return trimmed(asRecord(article)?.slug) ?? "<missing-slug>";
}

function isArticleState(value: unknown): value is KnowledgeBaseArticleState {
  return (
    typeof value === "string" &&
    (KNOWLEDGE_BASE_ARTICLE_STATES as readonly string[]).includes(value)
  );
}

function isArticleType(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (KNOWLEDGE_BASE_ARTICLE_TYPES as readonly string[]).includes(value)
  );
}

export function isValidKnowledgeBaseSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

export function isValidKnowledgeBaseLocale(value: unknown): value is string {
  return typeof value === "string" && LOCALE_PATTERN.test(value);
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

function validSourceList(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const urls = new Set<string>();
  for (const source of value) {
    const record = asRecord(source);
    const title = trimmed(record?.title);
    const url = normalizedSourceUrl(record?.url);
    if (!title || !url || urls.has(url)) return false;
    if (
      record?.publisher !== undefined &&
      record.publisher !== null &&
      !trimmed(record.publisher)
    ) {
      return false;
    }
    urls.add(url);
  }
  return true;
}
function hasValidArticleMetadata(article: KnowledgeBaseArticle): boolean {
  return (
    isValidKnowledgeBaseSlug(article.slug) &&
    isArticleType(article.type) &&
    isValidKnowledgeBaseLocale(article.locale) &&
    Number.isInteger(article.contentVersion) &&
    article.contentVersion > 0 &&
    trimmed(article.title) !== null &&
    trimmed(article.summary) !== null &&
    trimmed(article.body) !== null &&
    (article.relatedMeasurementKeys === undefined ||
      (Array.isArray(article.relatedMeasurementKeys) &&
        article.relatedMeasurementKeys.every((key) => trimmed(key) !== null)))
  );
}

function articleSources(article: KnowledgeBaseArticle): readonly unknown[] {
  return Array.isArray(article.sources) ? article.sources : [];
}

function hasPublicationEvidence(
  article: KnowledgeBaseArticle,
  asOf: Date,
): boolean {
  return (
    article.state === "published" &&
    trimmed(article.reviewedBy) !== null &&
    isPastTimestamp(article.reviewedAt, asOf) &&
    articleSources(article).length > 0 &&
    validSourceList(article.sources)
  );
}

function isStale(
  article: KnowledgeBaseArticle,
  asOf: Date,
  reviewWindowDays: number,
): boolean {
  if (!isPastTimestamp(article.reviewedAt, asOf)) return false;
  return (
    asOf.getTime() - Date.parse(article.reviewedAt) > reviewWindowDays * DAY_MS
  );
}

export function getKnowledgeBasePublicationDecision(
  article: KnowledgeBaseArticle,
  options: PolicyOptions = {},
): KnowledgeBasePublicationDecision {
  const asOf = resolveAsOf(options.asOf);
  const reviewWindowDays = resolveReviewWindowDays(options.reviewWindowDays);

  if (!isArticleState(article.state))
    return { public: false, reason: "invalid_state" };
  if (article.state === "draft") return { public: false, reason: "draft" };
  if (article.state === "review" || article.state === "in_review") {
    return { public: false, reason: "in_review" };
  }
  if (article.state === "deprecated")
    return { public: false, reason: "deprecated" };
  if (article.state !== "published")
    return { public: false, reason: "invalid_state" };
  if (!hasValidArticleMetadata(article)) {
    return { public: false, reason: "missing_review_evidence" };
  }
  const reviewedAt = article.reviewedAt;
  if (!isValidKnowledgeBaseTimestamp(reviewedAt)) {
    return { public: false, reason: "missing_review_evidence" };
  }
  if (!hasPublicationEvidence(article, asOf)) {
    return { public: false, reason: "missing_review_evidence" };
  }
  if (isStale(article, asOf, reviewWindowDays)) {
    return { public: false, reason: "stale" };
  }

  return { public: true, reason: "published", reviewedAt };
}

export function buildKnowledgeBaseStaleReport(
  articles: readonly KnowledgeBaseArticle[],
  options: PolicyOptions = {},
): KnowledgeBaseStaleReport {
  const asOf = resolveAsOf(options.asOf);
  const reviewWindowDays = resolveReviewWindowDays(options.reviewWindowDays);
  const staleArticles = articles
    .filter(
      (article) =>
        article.state === "published" &&
        isPastTimestamp(article.reviewedAt, asOf) &&
        isStale(article, asOf, reviewWindowDays),
    )
    .map((article) => ({
      slug: article.slug,
      contentVersion: article.contentVersion,
      reviewedBy: trimmed(article.reviewedBy) ?? "",
      reviewedAt: article.reviewedAt ?? "",
      ageDays: Math.floor(
        (asOf.getTime() - Date.parse(article.reviewedAt!)) / DAY_MS,
      ),
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));

  return {
    asOf: asOf.toISOString(),
    reviewWindowDays,
    publishedArticleCount: articles.filter(
      (article) => article.state === "published",
    ).length,
    staleArticles,
  };
}

export function validateKnowledgeBaseArticles(
  articles: readonly KnowledgeBaseArticle[],
  options: PolicyOptions = {},
): KnowledgeBaseValidationResult {
  const asOf = resolveAsOf(options.asOf);
  const reviewWindowDays = resolveReviewWindowDays(options.reviewWindowDays);
  const errors: string[] = [];
  const seenSlugs = new Set<string>();
  const records = articles.map((article) => ({
    article,
    record: asRecord(article),
  }));

  const error = (slug: string, message: string) => {
    errors.push(`${slug}: ${message}`);
  };

  for (const { article, record } of records) {
    const slug = articleSlug(article);
    if (!record) {
      error(slug, "article must be an object");
      continue;
    }

    if (!isValidKnowledgeBaseSlug(record.slug))
      error(slug, "slug must be lowercase kebab-case");
    if (seenSlugs.has(String(record.slug))) error(slug, "duplicate slug");
    seenSlugs.add(String(record.slug));

    if (!isArticleType(record.type))
      error(slug, "type must be measurement, biomarker, panel, or guide");
    if (!isValidKnowledgeBaseLocale(record.locale)) {
      error(
        slug,
        "locale must be a supported BCP-47-style locale such as en or en-US",
      );
    }
    if (
      typeof record.contentVersion !== "number" ||
      !Number.isInteger(record.contentVersion) ||
      record.contentVersion <= 0
    ) {
      error(slug, "contentVersion must be a positive integer");
    }
    for (const field of ["title", "summary", "body"] as const) {
      if (!trimmed(record[field])) error(slug, `${field} must not be blank`);
    }

    if (!Array.isArray(record.sources)) {
      error(slug, "sources must be an array");
    } else {
      const sources = record.sources;
      const sourceUrls = new Set<string>();
      for (const [index, source] of sources.entries()) {
        const sourceRecord = asRecord(source);
        const sourceTitle = trimmed(sourceRecord?.title);
        const sourceUrl = normalizedSourceUrl(sourceRecord?.url);
        if (!sourceTitle) error(slug, `source ${index + 1} must have a title`);
        if (!sourceUrl)
          error(slug, `source ${index + 1} must use a valid HTTPS URL`);
        else if (sourceUrls.has(sourceUrl))
          error(slug, `source ${index + 1} duplicates a URL`);
        else sourceUrls.add(sourceUrl);
        if (
          sourceRecord?.publisher !== undefined &&
          sourceRecord.publisher !== null &&
          !trimmed(sourceRecord.publisher)
        ) {
          error(slug, `source ${index + 1} publisher must not be blank`);
        }
      }
    }

    if (record.relatedMeasurementKeys !== undefined) {
      if (!Array.isArray(record.relatedMeasurementKeys)) {
        error(slug, "relatedMeasurementKeys must be an array when present");
      } else if (
        record.relatedMeasurementKeys.some((key) => trimmed(key) === null)
      ) {
        error(slug, "relatedMeasurementKeys must contain non-blank strings");
      }
    }

    if (
      isValidKnowledgeBaseTimestamp(record.reviewedAt) === false &&
      record.reviewedAt != null
    ) {
      error(slug, "reviewedAt must be an ISO-8601 timestamp");
    }
    if (record.reviewedBy != null && trimmed(record.reviewedBy) === null) {
      error(slug, "reviewedBy must not be blank when present");
    }

    if (record.state === "published") {
      if (trimmed(record.reviewedBy) === null)
        error(slug, "published content requires reviewedBy");
      if (!isValidKnowledgeBaseTimestamp(record.reviewedAt)) {
        error(slug, "published content requires reviewedAt");
      } else if (Date.parse(record.reviewedAt) >= asOf.getTime()) {
        error(slug, "reviewedAt must be in the past");
      }
      if (Array.isArray(record.sources) && record.sources.length === 0) {
        error(slug, "published content requires at least one source");
      }
    }

    if (record.state === "deprecated") {
      const deprecation = asRecord(record.deprecation);
      if (!deprecation) {
        error(slug, "deprecated content requires deprecation metadata");
      } else {
        if (!isPastTimestamp(deprecation.deprecatedAt, asOf)) {
          error(slug, "deprecatedAt must be a past ISO-8601 timestamp");
        }
        const replacement = deprecation.replacementSlug;
        if (replacement !== undefined && replacement !== null) {
          if (!isValidKnowledgeBaseSlug(replacement)) {
            error(slug, "replacementSlug must be lowercase kebab-case");
          } else if (replacement === record.slug) {
            error(slug, "replacementSlug must not equal the deprecated slug");
          }
        }
        if (
          deprecation.reason !== undefined &&
          deprecation.reason !== null &&
          !trimmed(deprecation.reason)
        ) {
          error(slug, "deprecation reason must not be blank when present");
        }
      }
    }

    if (!isArticleState(record.state))
      error(slug, "state must be draft, in_review, published, or deprecated");
  }

  const bySlug = new Map(
    records
      .filter(({ record }) => isValidKnowledgeBaseSlug(record?.slug))
      .map(({ article }) => [article.slug, article]),
  );
  for (const { article, record } of records) {
    if (record?.state !== "deprecated") continue;
    const replacement = asRecord(record.deprecation)?.replacementSlug;
    if (
      typeof replacement !== "string" ||
      !isValidKnowledgeBaseSlug(replacement)
    )
      continue;
    const target = bySlug.get(replacement);
    if (!target) {
      error(
        article.slug,
        `replacementSlug does not reference an article: ${replacement}`,
      );
    } else if (
      !getKnowledgeBasePublicationDecision(target, { asOf, reviewWindowDays })
        .public
    ) {
      error(
        article.slug,
        `replacementSlug is not a fresh published article: ${replacement}`,
      );
    }
  }

  const staleReport = buildKnowledgeBaseStaleReport(articles, {
    asOf,
    reviewWindowDays,
  });
  for (const stale of staleReport.staleArticles) {
    errors.push(
      `${stale.slug}: review is stale (${stale.ageDays} days old; maximum ${reviewWindowDays} days)`,
    );
  }

  return { valid: errors.length === 0, errors, staleReport };
}

export function isPublicKnowledgeBaseArticle(
  article: KnowledgeBaseArticle,
  options: PolicyOptions = {},
): article is PublicKnowledgeBaseArticle {
  return getKnowledgeBasePublicationDecision(article, options).public;
}

export function findPublicKnowledgeBaseArticle(
  articles: readonly KnowledgeBaseArticle[],
  slug: string,
  options: PolicyOptions = {},
): PublicKnowledgeBaseArticle | null {
  if (!validateKnowledgeBaseArticles(articles, options).valid) return null;
  const article = articles.find((candidate) => candidate.slug === slug);
  return article && isPublicKnowledgeBaseArticle(article, options)
    ? article
    : null;
}

export function resolveKnowledgeBaseDeprecatedRedirect(
  article: KnowledgeBaseArticle,
  articles: readonly KnowledgeBaseArticle[],
  options: PolicyOptions = {},
): string {
  if (article.state !== "deprecated") return KNOWLEDGE_BASE_ROUTE;
  const replacementSlug = article.deprecation?.replacementSlug;
  if (
    typeof replacementSlug !== "string" ||
    !isValidKnowledgeBaseSlug(replacementSlug)
  )
    return KNOWLEDGE_BASE_ROUTE;
  const replacement = articles.find(
    (candidate) => candidate.slug === replacementSlug,
  );
  if (!replacement || !isPublicKnowledgeBaseArticle(replacement, options)) {
    return KNOWLEDGE_BASE_ROUTE;
  }
  if (replacement.type === "panel") {
    return `/knowledge/panels/${encodeURIComponent(replacement.slug)}`;
  }
  return `/knowledge/biomarkers/${encodeURIComponent(replacement.slug)}`;
}

export type { PolicyOptions as KnowledgeBasePolicyOptions };
