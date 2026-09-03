import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BiomarkerArticleTemplate } from "@/components/knowledge-base/biomarker-article";
import {
  getKnowledgeArticle,
  listPublishedKnowledgeArticleRecords,
} from "@/lib/knowledge-base/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return listPublishedKnowledgeArticleRecords().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getKnowledgeArticle(slug);
  if (!article) return {};

  return {
    title: `${article.title} | EasyHealth Knowledge Base`,
    description: article.summary,
  };
}

export default async function BiomarkerKnowledgePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getKnowledgeArticle(slug);
  if (!article) notFound();

  return (
    <BiomarkerArticleTemplate
      article={article}
      publishedArticles={listPublishedKnowledgeArticleRecords()}
    />
  );
}
