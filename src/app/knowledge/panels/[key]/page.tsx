import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import { PanelArticle } from "@/components/knowledge-base/panel-article";
import { KnowledgeArticlePage } from "@/components/knowledge-base/knowledge-panel-article-page";
import {
  getKnowledgePanel,
  listKnowledgePanels,
} from "@/lib/knowledge-base/navigation";
import { getPublicPanelEducationArticle } from "@/lib/knowledge-base";

type PanelPageProps = {
  params: Promise<{ key: string }>;
};

export function generateStaticParams() {
  return listKnowledgePanels().map((panel) => ({ key: panel.key }));
}

export async function generateMetadata({
  params,
}: PanelPageProps): Promise<Metadata> {
  const { key } = await params;
  const panel = getKnowledgePanel(key);
  if (!panel) return { title: "Panel guide | EasyHealth" };
  const article = getPublicPanelEducationArticle(key);
  if (article) {
    return {
      title: `${article.title} | EasyHealth Knowledge Base`,
      description: article.summary,
    };
  }
  return {
    title: `${panel.displayName} | EasyHealth Knowledge Base`,
    description: `General information about the ${panel.displayName.toLowerCase()} panel.`,
  };
}

export default async function PanelPage({ params }: PanelPageProps) {
  const { key } = await params;
  const panel = getKnowledgePanel(key);
  if (!panel) notFound();
  const article = getPublicPanelEducationArticle(key);
  if (!article) return <PanelArticle panel={panel} />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ContextBreadcrumbs
        items={[
          { href: "/knowledge", label: "Knowledge Base" },
          { label: article.title },
        ]}
      />
      <KnowledgeArticlePage
        kind="panel"
        adapter="public"
        article={article}
        panel={panel}
      />
    </div>
  );
}
