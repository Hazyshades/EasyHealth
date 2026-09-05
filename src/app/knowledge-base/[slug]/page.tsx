import { permanentRedirect } from "next/navigation";
import {
  getDeprecatedKnowledgeBaseRedirect,
  getKnowledgeBaseArticle,
  resolveLegacyKnowledgeBasePath,
} from "@/lib/knowledge-base";

type KnowledgeBaseArticleRouteProps = {
  params: Promise<{ slug: string }>;
};

export default async function KnowledgeBaseSlugRedirect({
  params,
}: KnowledgeBaseArticleRouteProps) {
  const { slug } = await params;
  const article = getKnowledgeBaseArticle(slug);
  if (article?.state === "deprecated") {
    permanentRedirect(getDeprecatedKnowledgeBaseRedirect(article));
  }
  permanentRedirect(resolveLegacyKnowledgeBasePath(slug));
}
