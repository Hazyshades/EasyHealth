import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentStructuredContext } from "@/lib/documents/structured-context";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { sanitizeReportStrings } from "@/lib/report-text";
import {
  isDateInInclusiveRange,
  type ReportDateRange,
} from "@/lib/report-contract";

export async function getEligibleDocumentIds(
  profileId: string,
): Promise<string[]> {
  const supabase = createAdminClient();

  const [
    { data: observations },
    { data: findings },
    { data: clinicalNotes },
    { data: prescriptions },
    { data: referrals },
    { data: summaryDocuments, error: summaryError },
  ] = await Promise.all([
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
      .eq("status", "accepted")
      .eq("is_published", true),
    supabase
      .from("document_extracted_prescriptions")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted")
      .eq("is_published", true),
    supabase
      .from("document_extracted_referrals")
      .select("document_id")
      .eq("profile_id", profileId)
      .eq("status", "accepted")
      .eq("is_published", true),
    supabase
      .from("documents")
      .select("id")
      .eq("profile_id", profileId)
      .eq("lifecycle_state", "active")
      .eq("upload_state", "complete")
      .is("archived_at", null)
      .not("document_summary", "is", null),
  ]);

  if (summaryError) throw new Error(summaryError.message);

  const candidateIds = [
    ...new Set(
      [
        ...(observations ?? []).map((o) => o.document_id),
        ...(findings ?? []).map((f) => f.document_id),
        ...(clinicalNotes ?? []).map((c) => c.document_id),
        ...(prescriptions ?? []).map((p) => p.document_id),
        ...(referrals ?? []).map((r) => r.document_id),
        ...(summaryDocuments ?? []).map((d) => d.id),
      ].filter((id): id is string => typeof id === "string"),
    ),
  ];

  if (candidateIds.length === 0) return [];

  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select("id, status, processing_status, archived_at")
    .eq("profile_id", profileId)
    .eq("lifecycle_state", "active")
    .eq("upload_state", "complete")
    .is("archived_at", null)
    .in("id", candidateIds);

  if (docError) throw new Error(docError.message);

  return (documents ?? [])
    .filter(
      (doc) =>
        doc.status === "completed" ||
        doc.processing_status === "ready" ||
        doc.processing_status === "needs_review",
    )
    .map((d) => d.id);
}

export type ObservationRow = {
  id: string;
  document_id: string;
  name: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status?: string | null;
  verification_status?: string | null;
  decision_source?: "persisted" | "preview" | "none";
  decision_quality?: "available" | "unavailable" | "conflict";
  decision_not_persisted?: boolean;
  decision_quality_codes?: readonly string[];
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
  source_row_id: string;
  document_id: string;
  biomarker: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  verification_status: string | null;
  decision_source: "persisted" | "preview" | "none";
  decision_quality: "available" | "unavailable" | "conflict";
  decision_not_persisted: boolean;
  decision_quality_codes: readonly string[];
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
    source_row_id: string;
    document_id: string;
    filename: string;
    modality: string | null;
    body_region: string | null;
    finding_text: string;
    impression: string | null;
    study_date: string | null;
  }>;
  consultation_notes: Array<{
    source_row_id: string;
    document_id: string;
    filename: string;
    provider_name: string | null;
    visit_date: string | null;
    chief_complaint: string | null;
    documented_problems: string[];
    recommendations: string[];
    follow_up_plan: string | null;
    summary: string | null;
  }>;
  discharge_summaries: Array<{
    source_row_id: string;
    document_id: string;
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
    source_row_id: string;
    document_id: string;
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
    summary: string | null;
  }>;
  referrals: Array<{
    source_row_id: string;
    document_id: string;
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
    source_row_id: string;
    document_id: string;
    filename: string;
    document_type: string;
    observed_at: string | null;
    summary: string;
  }>;
};

export function isAbnormalObservation(
  o: Pick<
    ObservationRow,
    "value" | "ref_low" | "ref_high" | "registry_binding_ready"
  >,
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

export function filterAbnormalObservations<T extends ObservationRow>(
  observations: T[],
): T[] {
  return observations.filter(isAbnormalObservation);
}

export function buildReportContext(
  observations: ObservationRow[],
): ReportContextItem[] {
  return observations.map((o) => ({
    source_row_id: o.id,
    document_id: o.document_id,
    biomarker: o.name,
    analyte_key: o.analyte_key,
    measurement_definition_key: o.measurement_definition_key,
    resolution_status: o.resolution_status ?? null,
    verification_status: o.verification_status ?? null,
    decision_source: o.decision_source ?? "none",
    decision_quality: o.decision_quality ?? "unavailable",
    decision_not_persisted: o.decision_not_persisted === true,
    decision_quality_codes: o.decision_quality_codes ?? [],
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
  structured: DocumentStructuredContext,
  observations: ObservationRow[],
  abnormalOnly: boolean,
  dateRange: ReportDateRange | null = null,
): MultiSourceReportContext {
  const scopedObservations = (
    abnormalOnly ? filterAbnormalObservations(observations) : observations
  ).filter((observation) =>
    isDateInInclusiveRange(observation.observed_at, dateRange),
  );
  const scopedFindings = structured.instrumental_findings.filter((finding) =>
    isDateInInclusiveRange(finding.study_date, dateRange),
  );
  const scopedConsultationNotes = structured.consultation_notes.filter((note) =>
    isDateInInclusiveRange(note.document_observed_at, dateRange),
  );
  const scopedDischargeSummaries = structured.discharge_summaries.filter(
    (summary) =>
      isDateInInclusiveRange(summary.document_observed_at, dateRange),
  );
  const scopedPrescriptions = structured.prescriptions.filter((prescription) =>
    isDateInInclusiveRange(prescription.document_observed_at, dateRange),
  );
  const scopedReferrals = structured.referrals.filter((referral) =>
    isDateInInclusiveRange(referral.document_observed_at, dateRange),
  );
  const scopedDocumentSummaries = structured.document_summaries.filter(
    (summary) => isDateInInclusiveRange(summary.observed_at, dateRange),
  );

  return {
    biomarkers: buildReportContext(scopedObservations),
    instrumental_findings: scopedFindings.map((f) => ({
      source_row_id: f.source_row_id,
      document_id: f.document_id,
      filename: f.filename,
      modality: f.modality,
      body_region: f.body_region,
      finding_text: f.finding_text,
      impression: f.impression,
      study_date: f.study_date,
    })),
    consultation_notes: scopedConsultationNotes.map((c) => ({
      source_row_id: c.source_row_id,
      document_id: c.document_id,
      filename: c.filename,
      provider_name: c.provider_name,
      visit_date: c.visit_date,
      chief_complaint: c.chief_complaint,
      documented_problems: c.documented_problems,
      recommendations: c.recommendations,
      follow_up_plan: c.follow_up_plan,
      summary: c.summary,
    })),
    discharge_summaries: scopedDischargeSummaries.map((d) => ({
      source_row_id: d.source_row_id,
      document_id: d.document_id,
      filename: d.filename,
      provider_name: d.provider_name,
      admission_date: d.admission_date ?? null,
      discharge_date: d.discharge_date ?? null,
      hospital_course: d.hospital_course ?? null,
      discharge_diagnoses: d.discharge_diagnoses ?? [],
      discharge_medications: d.discharge_medications ?? [],
      follow_up_instructions: d.follow_up_instructions ?? null,
    })),
    prescriptions: scopedPrescriptions.map((p) => ({
      source_row_id: p.source_row_id,
      document_id: p.document_id,
      filename: p.filename,
      prescriber_name: p.prescriber_name,
      prescribed_at: p.prescribed_at,
      medications: p.medications,
      summary: p.summary,
    })),
    referrals: scopedReferrals.map((r) => ({
      source_row_id: r.source_row_id,
      document_id: r.document_id,
      filename: r.filename,
      referring_provider: r.referring_provider,
      referred_to_specialty: r.referred_to_specialty,
      referred_to_provider: r.referred_to_provider,
      referral_date: r.referral_date,
      reason_for_referral: r.reason_for_referral,
      clinical_summary: r.clinical_summary,
      urgency: r.urgency,
    })),
    document_summaries: scopedDocumentSummaries.map((s) => ({
      source_row_id: s.source_row_id,
      document_id: s.document_id,
      filename: s.filename,
      document_type: s.document_type,
      observed_at: s.observed_at,
      summary: s.summary,
    })),
  };
}

export function hasReportContextContent(
  context: MultiSourceReportContext,
): boolean {
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
