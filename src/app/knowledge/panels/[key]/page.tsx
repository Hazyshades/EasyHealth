import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PanelArticle } from "@/components/knowledge-base/panel-article";
import {
  getKnowledgePanel,
  listKnowledgePanels,
} from "@/lib/knowledge-base/navigation";

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
  return {
    title: `${panel.displayName} | EasyHealth Knowledge Base`,
    description: `General information about the ${panel.displayName.toLowerCase()} panel.`,
  };
}

export default async function PanelPage({ params }: PanelPageProps) {
  const { key } = await params;
  const panel = getKnowledgePanel(key);
  if (!panel) notFound();
  return <PanelArticle panel={panel} />;
}
