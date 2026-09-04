import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getDeprecatedKnowledgeBaseRedirect,
  getKnowledgeBaseArticle,
  getPublicKnowledgeBaseArticle,
} from "@/lib/knowledge-base";
import { KnowledgeBaseArticlePage } from "@/components/knowledge-base/article-page";

type KnowledgeBaseArticleRouteProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: KnowledgeBaseArticleRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublicKnowledgeBaseArticle(slug);
  if (!article) return { robots: { index: false, follow: false } };

  return {
    title: `${article.title} | EasyHealth Knowledge Base`,
    description: article.summary,
  };
}

export default async function KnowledgeBaseArticleRoute({
  params,
}: KnowledgeBaseArticleRouteProps) {
  const { slug } = await params;
  const article = getKnowledgeBaseArticle(slug);
  if (!article) notFound();

  if (article.state === "deprecated") {
    permanentRedirect(getDeprecatedKnowledgeBaseRedirect(article));
  }

  const publicArticle = getPublicKnowledgeBaseArticle(slug);
  if (!publicArticle) notFound();

  return <KnowledgeBaseArticlePage article={publicArticle} />;
}
