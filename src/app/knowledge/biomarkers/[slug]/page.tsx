import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeasurementArticle } from "@/components/knowledge-base/measurement-article";
import {
  getKnowledgeArticleBySlug,
  listPublishedKnowledgeArticles,
} from "@/lib/knowledge-base";

type MeasurementArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listPublishedKnowledgeArticles().map((article) => ({
    slug: article.record.slug,
  }));
}

export async function generateMetadata({
  params,
}: MeasurementArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getKnowledgeArticleBySlug(slug);
  if (!article) return { title: "Measurement guide | EasyHealth" };
  return {
    title: `${article.definition.displayName} | EasyHealth Knowledge Base`,
    description: article.record.summary,
  };
}

export default async function MeasurementArticlePage({
  params,
}: MeasurementArticlePageProps) {
  const { slug } = await params;
  const article = getKnowledgeArticleBySlug(slug);
  if (!article) notFound();
  return <MeasurementArticle article={article} />;
}
