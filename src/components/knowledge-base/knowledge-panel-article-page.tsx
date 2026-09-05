import type { PanelArticle } from "@/lib/knowledge-base";
import type { PanelDefinition } from "@/lib/biomarkers";
import {
  PanelArticleTemplate,
  type PanelArticleResultState,
} from "@/components/knowledge/panel-article-template";

export type PublicPanelArticlePageProps = Readonly<{
  kind: "panel";
  adapter: "public";
  article: PanelArticle;
  panel: PanelDefinition;
}>;

export type SignedInPanelArticlePageProps = Readonly<{
  kind: "panel";
  adapter: "signed-in";
  article: PanelArticle;
  panel: PanelDefinition;
  resultState: PanelArticleResultState;
  resultLabel?: string;
}>;

export type KnowledgePanelArticlePageProps =
  | PublicPanelArticlePageProps
  | SignedInPanelArticlePageProps;

export function KnowledgeArticlePage(props: KnowledgePanelArticlePageProps) {
  return (
    <PanelArticleTemplate
      article={props.article}
      panel={props.panel}
      resultLabel={props.adapter === "signed-in" ? props.resultLabel : undefined}
      resultState={
        props.adapter === "signed-in" ? props.resultState : undefined
      }
    />
  );
}

export type { PanelArticleResultState };
