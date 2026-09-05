import React, { type ReactNode } from "react";
import type { KnowledgeArticle } from "@/lib/knowledge-base/content";
import type { KnowledgeArticleRecord } from "@/lib/knowledge-base/content";
import { BiomarkerArticleTemplate } from "@/components/knowledge-base/biomarker-article";

export type PublicMeasurementArticlePageProps = Readonly<{
  kind: "measurement";
  adapter: "public";
  article: KnowledgeArticle;
  publishedArticles: readonly KnowledgeArticleRecord[];
}>;

export type SignedInMeasurementArticlePageProps = Readonly<{
  kind: "measurement";
  adapter: "signed-in";
  article: KnowledgeArticle;
  publishedArticles: readonly KnowledgeArticleRecord[];
  resultsStrip: ReactNode;
}>;

export type KnowledgeMeasurementArticlePageProps =
  | PublicMeasurementArticlePageProps
  | SignedInMeasurementArticlePageProps;

export function KnowledgeArticlePage(
  props: KnowledgeMeasurementArticlePageProps,
) {
  return (
    <BiomarkerArticleTemplate
      article={props.article}
      publishedArticles={props.publishedArticles}
      resultsStrip={
        props.adapter === "signed-in" ? props.resultsStrip : undefined
      }
    />
  );
}
