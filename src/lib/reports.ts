import { createAdminClient } from "@/lib/supabase/admin";
import { buildDocumentStructuredContext } from "@/lib/documents/structured-context";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { sanitizeReportStrings } from "@/lib/report-text";

export async function getEligibleDocumentIds(profileId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const [{ data: observations }, { data: findings }, { data: clinicalNotes }, { data: prescriptions }, { data: referrals }] = await Promise.all([
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
    supabase
      .from("document_extracted_prescriptions")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted"),
    supabase
      .from("document_extracted_referrals")
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
        ...(prescriptions ?? []).map((p) => p.document_id),
        ...(referrals ?? []).map((r) => r.document_id),
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
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status?: string | null;
  verification_status?: string | null;
  registry_binding_ready?: boolean;
  value_kind?: string | null;
  value_text?: string | null;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  documents?: { original_filename: string; observed_at: string | null } | null;
};

export type ReportContextItem = {
  biomarker: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  verification_status: string | null;
  registry_binding_ready: boolean;
  value_kind: string | null;
  value_text: string | null;
  value: number | null;
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
    documented_problems: string[];
    recommendations: string[];
    follow_up_plan: string | null;
  }>;
  discharge_summaries: Array<{
    filename: string;
    provider_name: string | null;
    admission_date: string | null;
    discharge_date: string | null;
    hospital_course: string | null;
    discharge_diagnoses: string[];
    discharge_medications: string[];
    follow_up_instructions: string | null;
  }>;
  prescriptions: Array<{
    filename: string;
    prescriber_name: string | null;
    prescribed_at: string | null;
    medications: Array<{
      name: string;
      dose: string | null;
      frequency: string | null;
      duration: string | null;
      instructions: string | null;
    }>;
  }>;
  referrals: Array<{
    filename: string;
    referring_provider: string | null;
    referred_to_specialty: string | null;
    referred_to_provider: string | null;
    referral_date: string | null;
    reason_for_referral: string | null;
    clinical_summary: string | null;
    urgency: string | null;
  }>;
  document_summaries: Array<{
    filename: string;
    document_type: string;
    summary: string;
  }>;
};

export function isAbnormalObservation(
  o: Pick<ObservationRow, "value" | "ref_low" | "ref_high" | "registry_binding_ready">
): boolean {
  if (o.registry_binding_ready === false) {
    return false;
  }
  if (o.value == null || Number.isNaN(Number(o.value))) return false;
  const value = Number(o.value);
  if (o.ref_low != null && value < o.ref_low) return true;
  if (o.ref_high != null && value > o.ref_high) return true;
  return false;
}

export function filterAbnormalObservations<T extends ObservationRow>(observations: T[]): T[] {
  return observations.filter(isAbnormalObservation);
}

export function buildReportContext(observations: ObservationRow[]): ReportContextItem[] {
  return observations.map((o) => ({
    biomarker: o.name,
    analyte_key: o.analyte_key,
    measurement_definition_key: o.measurement_definition_key,
    resolution_status: o.resolution_status ?? null,
    verification_status: o.verification_status ?? null,
    registry_binding_ready: o.registry_binding_ready === true,
    value_kind: o.value_kind ?? null,
    value_text: o.value_text ?? null,
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
      documented_problems: c.documented_problems,
      recommendations: c.recommendations,
      follow_up_plan: c.follow_up_plan,
    })),
    discharge_summaries: structured.discharge_summaries.map((d) => ({
      filename: d.filename,
      provider_name: d.provider_name,
      admission_date: d.admission_date ?? null,
      discharge_date: d.discharge_date ?? null,
      hospital_course: d.hospital_course ?? null,
      discharge_diagnoses: d.discharge_diagnoses ?? [],
      discharge_medications: d.discharge_medications ?? [],
      follow_up_instructions: d.follow_up_instructions ?? null,
    })),
    prescriptions: structured.prescriptions.map((p) => ({
      filename: p.filename,
      prescriber_name: p.prescriber_name,
      prescribed_at: p.prescribed_at,
      medications: p.medications,
    })),
    referrals: structured.referrals.map((r) => ({
      filename: r.filename,
      referring_provider: r.referring_provider,
      referred_to_specialty: r.referred_to_specialty,
      referred_to_provider: r.referred_to_provider,
      referral_date: r.referral_date,
      reason_for_referral: r.reason_for_referral,
      clinical_summary: r.clinical_summary,
      urgency: r.urgency,
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
    context.discharge_summaries.length > 0 ||
    context.prescriptions.length > 0 ||
    context.referrals.length > 0 ||
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
