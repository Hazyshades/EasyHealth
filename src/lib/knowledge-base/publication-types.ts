export const KNOWLEDGE_BASE_ARTICLE_STATES = [
  "draft",
  "review",
  "published",
  "deprecated",
] as const;

export type KnowledgeBaseArticleState =
  (typeof KNOWLEDGE_BASE_ARTICLE_STATES)[number];

export const KNOWLEDGE_BASE_ARTICLE_TYPES = [
  "biomarker",
  "panel",
  "guide",
] as const;

export type KnowledgeBaseArticleType =
  (typeof KNOWLEDGE_BASE_ARTICLE_TYPES)[number];

export const KNOWLEDGE_BASE_REVIEW_WINDOW_DAYS = 365;
export const KNOWLEDGE_BASE_ROUTE = "/knowledge-base";

export type KnowledgeBaseSource = Readonly<{
  title: string;
  url: string;
  publisher?: string | null;
}>;

export type KnowledgeBaseDeprecation = Readonly<{
  deprecatedAt: string;
  replacementSlug?: string | null;
  reason?: string | null;
}>;

/**
 * Version-controlled educational content. This contract deliberately has no
 * profile, observation, Registry, or assessment fields.
 */
export type KnowledgeBaseArticle = Readonly<{
  slug: string;
  type: KnowledgeBaseArticleType;
  locale: string;
  contentVersion: number;
  title: string;
  summary: string;
  body: string;
  state: KnowledgeBaseArticleState;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  sources: readonly KnowledgeBaseSource[];
  relatedMeasurementKeys?: readonly string[];
  deprecation?: KnowledgeBaseDeprecation | null;
}>;

export type KnowledgeBasePublicationReason =
  | "draft"
  | "review"
  | "deprecated"
  | "invalid_state"
  | "missing_review_evidence"
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

export type PublicKnowledgeBaseArticle = KnowledgeBaseArticle &
  Readonly<{
    state: "published";
    reviewedBy: string;
    reviewedAt: string;
  }>;

export type KnowledgeBaseStaleArticle = Readonly<{
  slug: string;
  contentVersion: number;
  reviewedBy: string;
  reviewedAt: string;
  ageDays: number;
}>;

export type KnowledgeBaseStaleReport = Readonly<{
  asOf: string;
  reviewWindowDays: number;
  publishedArticleCount: number;
  staleArticles: readonly KnowledgeBaseStaleArticle[];
}>;

export type KnowledgeBaseValidationResult = Readonly<{
  valid: boolean;
  errors: readonly string[];
  staleReport: KnowledgeBaseStaleReport;
}>;
