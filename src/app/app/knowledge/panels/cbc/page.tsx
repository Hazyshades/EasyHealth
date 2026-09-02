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
  selectPanelArticleResults,
  validatePanelArticle,
  type PanelArticleObservation,
} from "@/lib/knowledge-base";

const ARTICLE_PATH = "/app/knowledge/panels/cbc";
const CBC_PANEL = getPanelDefinition(CBC_PANEL_ARTICLE.panelKey);
const ARTICLE_VALIDATION = validatePanelArticle(CBC_PANEL_ARTICLE, CBC_PANEL);
const CBC_MEMBER_KEYS = CBC_PANEL_ARTICLE.subgroups.flatMap((subgroup) =>
  subgroup.members.map((member) => member.measurementDefinitionKey),
);

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDocument(value: unknown): PanelArticleObservation["documents"] {
  if (!isJsonRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.original_filename !== "string"
  )
    return null;
  return {
    id: value.id,
    original_filename: value.original_filename,
    lab_name: typeof value.lab_name === "string" ? value.lab_name : null,
  };
}

function parseObservation(value: unknown): PanelArticleObservation | null {
  if (!isJsonRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string")
    return null;
  if (
    value.measurement_definition_key !== null &&
    typeof value.measurement_definition_key !== "string"
  ) {
    return null;
  }
  if (
    value.value !== null &&
    typeof value.value !== "number" &&
    typeof value.value !== "string"
  ) {
    return null;
  }
  if (value.unit !== null && typeof value.unit !== "string") return null;
  if (value.observed_at !== null && typeof value.observed_at !== "string")
    return null;
  if (value.document_id !== null && typeof value.document_id !== "string")
    return null;
  if (
    value.value_text !== undefined &&
    value.value_text !== null &&
    typeof value.value_text !== "string"
  ) {
    return null;
  }
  if (
    value.source_page !== undefined &&
    value.source_page !== null &&
    typeof value.source_page !== "number"
  ) {
    return null;
  }
  if (
    value.ordinal !== undefined &&
    value.ordinal !== null &&
    typeof value.ordinal !== "number"
  ) {
    return null;
  }

  return {
    id: value.id,
    measurement_definition_key: value.measurement_definition_key,
    name: value.name,
    value: value.value,
    value_text: value.value_text === undefined ? null : value.value_text,
    unit: value.unit,
    observed_at: value.observed_at,
    ordinal: value.ordinal === undefined ? null : value.ordinal,
    document_id: value.document_id,
    source_page: value.source_page === undefined ? null : value.source_page,
    documents: parseDocument(value.documents),
  };
}

function parseObservations(payload: unknown): PanelArticleObservation[] {
  if (!isJsonRecord(payload) || !Array.isArray(payload.observations)) return [];
  return payload.observations.flatMap((value) => {
    const observation = parseObservation(value);
    return observation ? [observation] : [];
  });
}

function responseError(payload: unknown): string {
  if (
    isJsonRecord(payload) &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error;
  }
  return "We could not load the results saved in your record.";
}

function KnowledgeUnavailable() {
  return (
    <SurfaceCard
      padding="lg"
      className="border-red-200 bg-red-50/40"
      role="alert"
    >
      <h1 className="text-lg font-semibold text-[var(--eh-text-primary)]">
        CBC guide unavailable
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--eh-text-secondary)]">
        The panel article is not available in a valid Registry 2.0
        configuration.
      </p>
      <Button asChild variant="outline" className="mt-4 rounded-xl bg-white">
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
      if (!response.ok) throw new Error(responseError(payload));
      if (version !== requestVersion.current) return;
      setResultState({
        status: "ready",
        results: selectPanelArticleResults(
          parseObservations(payload),
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
        resultState={resultStateWithStableRetry}
      />
    </div>
  );
}
