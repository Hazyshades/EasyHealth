import { createHash } from "node:crypto";
import { getMeasurementDefinition } from "@/lib/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentType } from "@/lib/health-systems";

export type StructuredBiomarkerContext = {
  biomarker: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  verification_status: string | null;
  registry_binding_ready: boolean;
  value: number | null;
  value_kind: string;
  value_text: string | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  source: string;
};

export type StructuredFindingContext = {
  document_id: string;
  filename: string;
  document_type: DocumentType;
  modality: string | null;
  body_region: string | null;
  finding_text: string;
  impression: string | null;
  study_date: string | null;
  summary: string | null;
};

export type StructuredClinicalNoteContext = {
  document_id: string;
  filename: string;
  document_type: DocumentType;
  note_kind?: string | null;
  provider_name: string | null;
  visit_date: string | null;
  chief_complaint: string | null;
  history_summary: string | null;
  exam_findings: string | null;
  documented_problems: string[];
  recommendations: string[];
  follow_up_plan: string | null;
  admission_date?: string | null;
  discharge_date?: string | null;
  hospital_course?: string | null;
  discharge_diagnoses?: string[];
  discharge_medications?: string[];
  follow_up_instructions?: string | null;
  summary: string | null;
};

export type StructuredPrescriptionContext = {
  document_id: string;
  filename: string;
  document_type: DocumentType;
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
};

export type StructuredReferralContext = {
  document_id: string;
  filename: string;
  document_type: DocumentType;
  referring_provider: string | null;
  referred_to_specialty: string | null;
  referred_to_provider: string | null;
  referral_date: string | null;
  reason_for_referral: string | null;
  clinical_summary: string | null;
  urgency: string | null;
  summary: string | null;
};

export type DocumentStructuredContext = {
  biomarkers: StructuredBiomarkerContext[];
  instrumental_findings: StructuredFindingContext[];
  consultation_notes: StructuredClinicalNoteContext[];
  discharge_summaries: StructuredClinicalNoteContext[];
  prescriptions: StructuredPrescriptionContext[];
  referrals: StructuredReferralContext[];
  document_summaries: Array<{
    document_id: string;
    filename: string;
    document_type: string;
    summary: string;
  }>;
  source_document_ids: string[];
};

type LinkedRevision = {
  resolver_result: string | null;
  verification_status: string | null;
  measurement_definition_key: string | null;
  is_active: boolean;
};

function activeRevision(
  relation: LinkedRevision | LinkedRevision[] | null | undefined
): LinkedRevision | null {
  const revisions = Array.isArray(relation)
    ? relation
    : relation
      ? [relation]
      : [];
  return revisions.find((revision) => revision.is_active) ?? null;
}

function isProcessedDocument(processingStatus: string | null, status: string): boolean {
  if (processingStatus === "ready" || processingStatus === "needs_review") return true;
  return status === "completed";
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapClinicalNoteRow(
  row: Record<string, unknown>,
  doc: { id: string; original_filename: string; document_type: string; observed_at: string | null; document_summary: string | null }
): StructuredClinicalNoteContext {
  return {
    document_id: row.document_id as string,
    filename: doc.original_filename,
    document_type: doc.document_type as DocumentType,
    note_kind: typeof row.note_kind === "string" ? row.note_kind : null,
    provider_name: (row.provider_name as string | null) ?? null,
    visit_date: (row.visit_date as string | null) ?? null,
    chief_complaint: (row.chief_complaint as string | null) ?? null,
    history_summary: (row.history_summary as string | null) ?? null,
    exam_findings: (row.exam_findings as string | null) ?? null,
    documented_problems: parseStringList(
      row.documented_problems ?? row.documented_diagnoses
    ),
    recommendations: parseStringList(row.recommendations),
    follow_up_plan: (row.follow_up_plan as string | null) ?? null,
    admission_date: (row.admission_date as string | null) ?? null,
    discharge_date: (row.discharge_date as string | null) ?? null,
    hospital_course: (row.hospital_course as string | null) ?? null,
    discharge_diagnoses: parseStringList(row.discharge_diagnoses),
    discharge_medications: parseStringList(row.discharge_medications),
    follow_up_instructions: (row.follow_up_instructions as string | null) ?? null,
    summary: doc.document_summary,
  };
}

export async function buildDocumentStructuredContext(
  profileId: string,
  documentIds?: string[] | null
): Promise<DocumentStructuredContext> {
  const supabase = createAdminClient();

  let docQuery = supabase
    .from("documents")
    .select(
      "id, original_filename, document_type, observed_at, lab_name, document_summary, processing_status, status, modality"
    )
    .eq("profile_id", profileId);

  if (documentIds?.length) {
    docQuery = docQuery.in("id", documentIds);
  }

  const { data: documents, error: docError } = await docQuery;
  if (docError) throw new Error(docError.message);

  const eligibleDocs = (documents ?? []).filter((doc) =>
    isProcessedDocument(doc.processing_status, doc.status)
  );
  const eligibleIds = eligibleDocs.map((d) => d.id);

  const biomarkers: StructuredBiomarkerContext[] = [];
  const instrumental_findings: StructuredFindingContext[] = [];
  const consultation_notes: StructuredClinicalNoteContext[] = [];
  const discharge_summaries: StructuredClinicalNoteContext[] = [];
  const prescriptions: StructuredPrescriptionContext[] = [];
  const referrals: StructuredReferralContext[] = [];
  const document_summaries: DocumentStructuredContext["document_summaries"] = [];

  if (eligibleIds.length === 0) {
    return {
      biomarkers,
      instrumental_findings,
      consultation_notes,
      discharge_summaries,
      prescriptions,
      referrals,
      document_summaries,
      source_document_ids: [],
    };
  }

  const [
    { data: observations },
    { data: findings },
    { data: clinicalNotes },
    { data: prescriptionRows },
    { data: referralRows },
  ] = await Promise.all([
    supabase
      .from("observations")
      .select(
        "id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, value_kind, value_text, document_id, documents(original_filename), normalization_revision:observation_normalization_revisions!observations_normalization_revision_fk(resolver_result, verification_status, measurement_definition_key, is_active)"
      )
      .eq("profile_id", profileId)
      .in("document_id", eligibleIds)
      .eq("observation_kind", "lab")
      .order("observed_at", { ascending: true }),
    supabase
      .from("document_extracted_findings")
      .select("*")
      .eq("profile_id", profileId)
      .in("document_id", eligibleIds)
      .eq("status", "accepted"),
    supabase
      .from("document_extracted_clinical_notes")
      .select("*")
      .eq("profile_id", profileId)
      .in("document_id", eligibleIds)
      .eq("status", "accepted"),
    supabase
      .from("document_extracted_prescriptions")
      .select("*")
      .eq("profile_id", profileId)
      .in("document_id", eligibleIds)
      .eq("status", "accepted"),
    supabase
      .from("document_extracted_referrals")
      .select("*")
      .eq("profile_id", profileId)
      .in("document_id", eligibleIds)
      .eq("status", "accepted"),
  ]);

  for (const obs of observations ?? []) {
    const revision = activeRevision(
      obs.normalization_revision as LinkedRevision | LinkedRevision[] | null
    );
    const measurementDefinitionKey =
      revision?.measurement_definition_key ?? obs.measurement_definition_key ?? null;
    const resolutionStatus =
      revision?.resolver_result ?? obs.resolution_status ?? null;
    const definition = measurementDefinitionKey
      ? getMeasurementDefinition(measurementDefinitionKey)
      : undefined;
    const registryBindingReady =
      revision?.is_active === true &&
      resolutionStatus === "resolved" &&
      definition?.maturity === "reviewed";
    const numericValue = obs.value != null ? Number(obs.value) : null;
    biomarkers.push({
      biomarker: obs.name,
      analyte_key: obs.analyte_key ?? null,
      measurement_definition_key: measurementDefinitionKey,
      resolution_status: resolutionStatus,
      verification_status: revision?.verification_status ?? null,
      registry_binding_ready: registryBindingReady,
      value: numericValue != null && Number.isFinite(numericValue) ? numericValue : null,
      value_kind: obs.value_kind ?? "numeric",
      value_text: obs.value_text ?? (numericValue != null ? String(numericValue) : null),
      unit: obs.unit,
      ref_low: obs.ref_low != null ? Number(obs.ref_low) : null,
      ref_high: obs.ref_high != null ? Number(obs.ref_high) : null,
      observed_at: obs.observed_at,
      source:
        (obs.documents as { original_filename?: string } | null)?.original_filename ?? "unknown",
    });
  }

  const docById = new Map(eligibleDocs.map((d) => [d.id, d]));

  for (const row of findings ?? []) {
    const doc = docById.get(row.document_id);
    if (!doc) continue;
    instrumental_findings.push({
      document_id: row.document_id,
      filename: doc.original_filename,
      document_type: doc.document_type as DocumentType,
      modality: row.modality ?? doc.modality ?? null,
      body_region: row.body_region,
      finding_text: row.finding_text,
      impression: row.impression,
      study_date: doc.observed_at,
      summary: doc.document_summary,
    });
  }

  for (const row of clinicalNotes ?? []) {
    const doc = docById.get(row.document_id);
    if (!doc) continue;
    const mapped = mapClinicalNoteRow(row, doc);
    if (row.note_kind === "discharge") {
      discharge_summaries.push(mapped);
    } else {
      consultation_notes.push(mapped);
    }
  }

  for (const row of prescriptionRows ?? []) {
    const doc = docById.get(row.document_id);
    if (!doc) continue;
    const meds = Array.isArray(row.medications) ? row.medications : [];
    prescriptions.push({
      document_id: row.document_id,
      filename: doc.original_filename,
      document_type: doc.document_type as DocumentType,
      prescriber_name: row.prescriber_name,
      prescribed_at: row.prescribed_at,
      medications: meds as StructuredPrescriptionContext["medications"],
      summary: doc.document_summary,
    });
  }

  for (const row of referralRows ?? []) {
    const doc = docById.get(row.document_id);
    if (!doc) continue;
    referrals.push({
      document_id: row.document_id,
      filename: doc.original_filename,
      document_type: doc.document_type as DocumentType,
      referring_provider: row.referring_provider,
      referred_to_specialty: row.referred_to_specialty,
      referred_to_provider: row.referred_to_provider,
      referral_date: row.referral_date,
      reason_for_referral: row.reason_for_referral,
      clinical_summary: row.clinical_summary,
      urgency: row.urgency,
      summary: doc.document_summary,
    });
  }

  for (const doc of eligibleDocs) {
    if (doc.document_summary) {
      document_summaries.push({
        document_id: doc.id,
        filename: doc.original_filename,
        document_type: doc.document_type,
        summary: doc.document_summary,
      });
    }
  }

  const source_document_ids = [
    ...new Set([
      ...(observations ?? [])
        .map((o) => o.document_id)
        .filter((id): id is string => typeof id === "string"),
      ...instrumental_findings.map((f) => f.document_id),
      ...consultation_notes.map((c) => c.document_id),
      ...discharge_summaries.map((d) => d.document_id),
      ...prescriptions.map((p) => p.document_id),
      ...referrals.map((r) => r.document_id),
      ...document_summaries.map((s) => s.document_id),
    ]),
  ];

  return {
    biomarkers,
    instrumental_findings,
    consultation_notes,
    discharge_summaries,
    prescriptions,
    referrals,
    document_summaries,
    source_document_ids,
  };
}

export function hashStructuredContext(context: DocumentStructuredContext): string {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}

export function hasStructuredContent(context: DocumentStructuredContext): boolean {
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
