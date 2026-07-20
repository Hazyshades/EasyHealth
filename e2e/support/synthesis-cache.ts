import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { E2ERunContext } from "./ownership";
import { assertSupabaseOk } from "./supabase";

type ContextDocument = {
  id: string;
  original_filename: string;
  document_type: string;
  observed_at: string | null;
  document_summary: string | null;
  processing_status: string | null;
  status: string;
  modality: string | null;
};

type StructuredContext = {
  biomarkers: Array<{
    biomarker: string;
    analyte_key: string | null;
    measurement_definition_key: string | null;
    resolution_status: string | null;
    value: number;
    unit: string;
    ref_low: number | null;
    ref_high: number | null;
    observed_at: string;
    source: string;
  }>;
  instrumental_findings: Array<{
    document_id: string;
    filename: string;
    document_type: string;
    modality: string | null;
    body_region: string | null;
    finding_text: string;
    impression: string | null;
    study_date: string | null;
    summary: string | null;
  }>;
  consultation_notes: unknown[];
  discharge_summaries: unknown[];
  prescriptions: unknown[];
  referrals: unknown[];
  document_summaries: Array<{
    document_id: string;
    filename: string;
    document_type: string;
    summary: string;
  }>;
  source_document_ids: string[];
};

/**
 * Mirrors the read-only structured-context shape consumed by Health Profile.
 * Keeping an exact cached hash prevents `getOrCreateHolisticSynthesis` from
 * selecting a model or making an external AI call during browser coverage.
 */
export async function refreshCachedSyntheses(client: SupabaseClient, context: E2ERunContext): Promise<void> {
  for (const principal of Object.values(context.principals)) {
    if (!principal) continue;
    const structured = await buildStructuredContext(client, principal.profileId);
    const inputHash = createHash("sha256").update(JSON.stringify(structured)).digest("hex");
    assertSupabaseOk(
      await client.from("profile_health_synthesis").upsert({
        profile_id: principal.profileId,
        synthesis_text: "E2E synthetic cached synthesis. No clinical interpretation.",
        source_document_ids: structured.source_document_ids,
        input_hash: inputHash,
        model: "e2e-fixture",
        generated_at: new Date().toISOString(),
      }),
      `cache synthetic Health Profile synthesis for ${principal.profileId}`,
    );
  }
}

async function buildStructuredContext(client: SupabaseClient, profileId: string): Promise<StructuredContext> {
  const { data: documents, error: documentError } = await client
    .from("documents")
    .select("id, original_filename, document_type, observed_at, lab_name, document_summary, processing_status, status, modality")
    .eq("profile_id", profileId);
  assertSupabaseOk({ error: documentError }, "read synthetic documents for Health Profile synthesis cache");

  const eligibleDocuments = ((documents ?? []) as ContextDocument[]).filter(
    (document) => document.processing_status === "ready" || document.processing_status === "needs_review" || document.status === "completed",
  );
  const eligibleIds = eligibleDocuments.map((document) => document.id);
  const empty: StructuredContext = {
    biomarkers: [],
    instrumental_findings: [],
    consultation_notes: [],
    discharge_summaries: [],
    prescriptions: [],
    referrals: [],
    document_summaries: [],
    source_document_ids: [],
  };
  if (eligibleIds.length === 0) return empty;

  const [{ data: observations, error: observationError }, { data: findings, error: findingError }] = await Promise.all([
    client
      .from("observations")
      .select("*, documents(original_filename)")
      .eq("profile_id", profileId)
      .in("document_id", eligibleIds)
      .order("observed_at", { ascending: true }),
    client
      .from("document_extracted_findings")
      .select("*")
      .eq("profile_id", profileId)
      .in("document_id", eligibleIds)
      .eq("status", "accepted"),
  ]);
  assertSupabaseOk({ error: observationError }, "read synthetic observations for Health Profile synthesis cache");
  assertSupabaseOk({ error: findingError }, "read synthetic findings for Health Profile synthesis cache");

  const typedObservations = (observations ?? []) as Array<Record<string, unknown>>;
  const typedFindings = (findings ?? []) as Array<Record<string, unknown>>;
  const documentById = new Map(eligibleDocuments.map((document) => [document.id, document]));
  const instrumentalFindings = typedFindings.flatMap((finding) => {
    const documentId = finding.document_id as string;
    const document = documentById.get(documentId);
    if (!document) return [];
    return [{
      document_id: documentId,
      filename: document.original_filename,
      document_type: document.document_type,
      modality: (finding.modality as string | null) ?? document.modality ?? null,
      body_region: (finding.body_region as string | null) ?? null,
      finding_text: finding.finding_text as string,
      impression: (finding.impression as string | null) ?? null,
      study_date: document.observed_at,
      summary: document.document_summary,
    }];
  });
  const documentSummaries = eligibleDocuments.flatMap((document) =>
    document.document_summary
      ? [{
          document_id: document.id,
          filename: document.original_filename,
          document_type: document.document_type,
          summary: document.document_summary,
        }]
      : [],
  );
  const biomarkers = typedObservations.map((observation) => {
    const nestedDocument = observation.documents as { original_filename?: string } | null;
    return {
      biomarker: observation.name as string,
      analyte_key: (observation.analyte_key as string | null) ?? null,
      measurement_definition_key: (observation.measurement_definition_key as string | null) ?? null,
      resolution_status: (observation.resolution_status as string | null) ?? null,
      value: Number(observation.value),
      unit: observation.unit as string,
      ref_low: observation.ref_low == null ? null : Number(observation.ref_low),
      ref_high: observation.ref_high == null ? null : Number(observation.ref_high),
      observed_at: observation.observed_at as string,
      source: nestedDocument?.original_filename ?? "unknown",
    };
  });

  return {
    ...empty,
    biomarkers,
    instrumental_findings: instrumentalFindings,
    document_summaries: documentSummaries,
    source_document_ids: [
      ...new Set([
        ...typedObservations
          .map((observation) => observation.document_id)
          .filter((id): id is string => typeof id === "string"),
        ...instrumentalFindings.map((finding) => finding.document_id),
        ...documentSummaries.map((summary) => summary.document_id),
      ]),
    ],
  };
}
