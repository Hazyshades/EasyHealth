import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KnowledgeArticlePage } from "@/components/knowledge-base/knowledge-article-page";
import { SignedInMeasurementResultsStrip } from "@/components/knowledge-base/signed-in-measurement-adapter";
import {
  getKnowledgeArticle,
  listPublishedKnowledgeArticleRecords,
} from "@/lib/knowledge-base/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getKnowledgeArticle(slug);
  if (!article) return { title: "Measurement education | EasyHealth" };

  return {
    title: `${article.title} | EasyHealth`,
    description: article.summary,
  };
}

export default async function MeasurementArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getKnowledgeArticle(slug);
  if (!article) notFound();
  const measurementDefinitionKey = article.measurementDefinitionKeys[0];
  if (!measurementDefinitionKey) notFound();

  return (
    <KnowledgeArticlePage
      kind="measurement"
      adapter="signed-in"
      article={article}
      publishedArticles={listPublishedKnowledgeArticleRecords()}
      resultsStrip={
        <SignedInMeasurementResultsStrip
          measurementDefinitionKey={measurementDefinitionKey}
          returnTo={`/app/knowledge/measurements/${article.slug}`}
        />
      }
    />
  );
}
