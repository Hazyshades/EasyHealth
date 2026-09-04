import type {
  BodySystemId,
  MeasurementDefinition,
  PanelDefinition,
} from "../biomarkers";

export type KnowledgeCategory = Exclude<BodySystemId, "general">;

export type KnowledgeSource = Readonly<{
  title: string;
  publisher: string;
  href: string;
}>;

export type KnowledgeReview = Readonly<{
  status: "published" | "draft" | "retired";
  reviewedBy: string;
  reviewedAt: string;
}>;

export type KnowledgeArticleRecord = Readonly<{
  slug: string;
  measurementDefinitionKey: string;
  category: KnowledgeCategory;
  summary: string;
  whatItMeasures: string;
  interpretationFactors: readonly string[];
  relatedMeasurementDefinitionKeys: readonly string[];
  relatedPanelKeys: readonly string[];
  contentVersion: string;
  review: KnowledgeReview;
  sources: readonly KnowledgeSource[];
}>;

export type KnowledgeArticle = Readonly<{
  record: KnowledgeArticleRecord;
  definition: MeasurementDefinition;
  aliases: readonly string[];
  panels: readonly PanelDefinition[];
}>;

export type KnowledgeSearchMatchKind = "canonical" | "alias" | "panel";

export type KnowledgeSearchResult =
  | Readonly<{
      kind: "measurement";
      article: KnowledgeArticle;
      matchKind: "canonical" | "alias";
      matchedTerm: string;
      rank: number;
    }>
  | Readonly<{
      kind: "panel";
      panel: PanelDefinition;
      matchKind: "panel";
      matchedTerm: string;
      rank: number;
    }>;

export type KnowledgeIndexFilters = Readonly<{
  query?: string | null;
  category?: string | null;
  panel?: string | null;
}>;
