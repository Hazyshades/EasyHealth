import { createAdminClient } from "@/lib/supabase/admin";
import { buildDocumentStructuredContext } from "@/lib/documents/structured-context";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { sanitizeReportStrings } from "@/lib/report-text";

export async function getEligibleDocumentIds(profileId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const [{ data: observations }, { data: findings }, { data: clinicalNotes }] = await Promise.all([
    supabase
      .from("observations")
      .select("document_id")
      .eq("profile_id", profileId)
      .not("document_id", "is", null),
    supabase
      .from("document_extracted_findings")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted"),
    supabase
      .from("document_extracted_clinical_notes")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted"),
  ]);

  const candidateIds = [
    ...new Set(
      [
        ...(observations ?? []).map((o) => o.document_id),
        ...(findings ?? []).map((f) => f.document_id),
        ...(clinicalNotes ?? []).map((c) => c.document_id),
      ].filter((id): id is string => typeof id === "string")
    ),
  ];

  if (candidateIds.length === 0) return [];

  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select("id, status, processing_status")
    .eq("profile_id", profileId)
    .in("id", candidateIds);

  if (docError) throw new Error(docError.message);

  return (documents ?? [])
    .filter(
      (doc) =>
        doc.status === "completed" ||
        doc.processing_status === "ready" ||
        doc.processing_status === "needs_review"
    )
    .map((d) => d.id);
}

export type ObservationRow = {
  name: string;
  biomarker_key: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  documents?: { original_filename: string; observed_at: string | null } | null;
};

export type ReportContextItem = {
  biomarker: string;
  key: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  source: string;
};

export type MultiSourceReportContext = {
  biomarkers: ReportContextItem[];
  instrumental_findings: Array<{
    filename: string;
    modality: string | null;
    body_region: string | null;
    finding_text: string;
    impression: string | null;
    study_date: string | null;
  }>;
  consultation_notes: Array<{
    filename: string;
    provider_name: string | null;
    visit_date: string | null;
    chief_complaint: string | null;
    documented_diagnoses: string[];
    recommendations: string[];
    follow_up_plan: string | null;
  }>;
  document_summaries: Array<{
    filename: string;
    document_type: string;
    summary: string;
  }>;
};

export function isAbnormalObservation(o: Pick<ObservationRow, "value" | "ref_low" | "ref_high">): boolean {
  if (o.ref_low != null && o.value < o.ref_low) return true;
  if (o.ref_high != null && o.value > o.ref_high) return true;
  return false;
}

export function filterAbnormalObservations<T extends ObservationRow>(observations: T[]): T[] {
  return observations.filter(isAbnormalObservation);
}

export function buildReportContext(observations: ObservationRow[]): ReportContextItem[] {
  return observations.map((o) => ({
    biomarker: o.name,
    key: o.biomarker_key,
    value: o.value,
    unit: o.unit,
    ref_low: o.ref_low,
    ref_high: o.ref_high,
    observed_at: o.observed_at,
    source: o.documents?.original_filename ?? "unknown",
  }));
}

export function buildMultiSourceReportContext(
  structured: Awaited<ReturnType<typeof buildDocumentStructuredContext>>,
  observations: ObservationRow[],
  abnormalOnly: boolean
): MultiSourceReportContext {
  const scopedObservations = abnormalOnly ? filterAbnormalObservations(observations) : observations;

  return {
    biomarkers: buildReportContext(scopedObservations),
    instrumental_findings: structured.instrumental_findings.map((f) => ({
      filename: f.filename,
      modality: f.modality,
      body_region: f.body_region,
      finding_text: f.finding_text,
      impression: f.impression,
      study_date: f.study_date,
    })),
    consultation_notes: structured.consultation_notes.map((c) => ({
      filename: c.filename,
      provider_name: c.provider_name,
      visit_date: c.visit_date,
      chief_complaint: c.chief_complaint,
      documented_diagnoses: c.documented_diagnoses,
      recommendations: c.recommendations,
      follow_up_plan: c.follow_up_plan,
    })),
    document_summaries: structured.document_summaries.map((s) => ({
      filename: s.filename,
      document_type: s.document_type,
      summary: s.summary,
    })),
  };
}

export function hasReportContextContent(context: MultiSourceReportContext): boolean {
  return (
    context.biomarkers.length > 0 ||
    context.instrumental_findings.length > 0 ||
    context.consultation_notes.length > 0 ||
    context.document_summaries.length > 0
  );
}

export function buildSummaryPreview(overview: string): string {
  const trimmed = overview.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 120).trimEnd()}…`;
}

export function withDisclaimer<T extends { disclaimer?: string }>(content: T) {
  return { ...sanitizeReportStrings(content), disclaimer: MEDICAL_DISCLAIMER };
}
