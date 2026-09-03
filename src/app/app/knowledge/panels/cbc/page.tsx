"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import {
  PanelArticleTemplate,
  type PanelArticleResultState,
} from "@/components/knowledge/panel-article-template";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { buildHealthNavigationPath } from "@/lib/health-navigation";
import { getPanelDefinition } from "@/lib/biomarkers";
import {
  CBC_PANEL_ARTICLE,
  parseMeasurementResultsResponse,
  selectPanelArticleResults,
  validatePanelArticle,
} from "@/lib/knowledge-base";

const ARTICLE_PATH = "/app/knowledge/panels/cbc";
const CBC_PANEL = getPanelDefinition(CBC_PANEL_ARTICLE.panelKey);
const ARTICLE_VALIDATION = validatePanelArticle(CBC_PANEL_ARTICLE, CBC_PANEL);
const CBC_MEMBER_KEYS = CBC_PANEL_ARTICLE.subgroups.flatMap((subgroup) =>
  subgroup.members.map((member) => member.measurementDefinitionKey),
);

const RESULTS_UNAVAILABLE_MESSAGE =
  "We could not load the results saved in your record.";

function KnowledgeUnavailable() {
  return (
    <SurfaceCard
      padding="lg"
      className="border-red-200 bg-red-50/40"
      role="alert"
    >
      <h1 className="text-balance text-lg font-semibold text-[var(--eh-text-primary)]">
        CBC guide unavailable
      </h1>
      <p className="mt-2 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
        The panel article is not available in a valid Registry 2.0
        configuration.
      </p>
      <Button asChild variant="outline" className="mt-4 bg-white">
        <Link href="/app/knowledge">Back to Knowledge</Link>
      </Button>
    </SurfaceCard>
  );
}

export default function CbcPanelPage() {
  const [resultState, setResultState] = useState<PanelArticleResultState>({
    status: "loading",
  });
  const requestVersion = useRef(0);

  const loadResults = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setResultState({ status: "loading" });
    try {
      const response = await fetch("/api/biomarkers", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(RESULTS_UNAVAILABLE_MESSAGE);
      if (version !== requestVersion.current) return;
      setResultState({
        status: "ready",
        results: selectPanelArticleResults(
          parseMeasurementResultsResponse(payload),
          CBC_MEMBER_KEYS,
        ),
        resultHref: (result) =>
          buildHealthNavigationPath("/app/biomarkers", {
            measurement: result.measurement_definition_key,
            observation: result.id,
            returnTo: ARTICLE_PATH,
          }),
      });
    } catch (error) {
      if (version !== requestVersion.current) return;
      setResultState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not load the results saved in your record.",
        onRetry: () => void loadResults(),
      });
    }
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const resultStateWithStableRetry = useMemo(() => {
    if (resultState.status !== "error") return resultState;
    return { ...resultState, onRetry: () => void loadResults() };
  }, [loadResults, resultState]);

  if (!CBC_PANEL || !ARTICLE_VALIDATION.valid) return <KnowledgeUnavailable />;

  return (
    <div className="pb-8">
      <ContextBreadcrumbs
        items={[
          { href: "/app", label: "Dashboard" },
          { href: "/app/knowledge", label: "Knowledge" },
          { label: CBC_PANEL_ARTICLE.title },
        ]}
      />
      <PanelArticleTemplate
        article={CBC_PANEL_ARTICLE}
        panel={CBC_PANEL}
        resultLabel="CBC"
        resultState={resultStateWithStableRetry}
      />
    </div>
  );
}
