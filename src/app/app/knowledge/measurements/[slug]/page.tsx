import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeasurementArticle } from "@/components/knowledge-base/measurement-article";
import {
  buildMeasurementArticleViewModel,
  getPublishedMeasurementArticleBySlug,
} from "@/lib/knowledge-base";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function resolveArticle(slug: string) {
  const article = getPublishedMeasurementArticleBySlug(slug);
  if (!article) return null;
  return buildMeasurementArticleViewModel(article);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const model = await resolveArticle(slug);
  if (!model) return { title: "Measurement education | EasyHealth" };

  return {
    title: `${model.article.title} | EasyHealth`,
    description: model.article.summary,
  };
}

export default async function MeasurementArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const model = await resolveArticle(slug);
  if (!model) notFound();

  return <MeasurementArticle model={model} />;
}
