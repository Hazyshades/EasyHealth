import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentType } from "@/lib/health-systems";

export type StructuredBiomarkerContext = {
  biomarker: string;
  key: string;
  value: number;
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
  provider_name: string | null;
  visit_date: string | null;
  chief_complaint: string | null;
  history_summary: string | null;
  exam_findings: string | null;
  documented_diagnoses: string[];
  recommendations: string[];
  follow_up_plan: string | null;
  summary: string | null;
};

export type DocumentStructuredContext = {
  biomarkers: StructuredBiomarkerContext[];
  instrumental_findings: StructuredFindingContext[];
  consultation_notes: StructuredClinicalNoteContext[];
  document_summaries: Array<{
    document_id: string;
    filename: string;
    document_type: string;
    summary: string;
  }>;
  source_document_ids: string[];
};

function isProcessedDocument(processingStatus: string | null, status: string): boolean {
  if (processingStatus === "ready" || processingStatus === "needs_review") return true;
  return status === "completed";
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
  const document_summaries: DocumentStructuredContext["document_summaries"] = [];

  if (eligibleIds.length === 0) {
    return {
      biomarkers,
      instrumental_findings,
      consultation_notes,
      document_summaries,
      source_document_ids: [],
    };
  }

  const [{ data: observations }, { data: findings }, { data: clinicalNotes }] = await Promise.all([
    supabase
      .from("observations")
      .select("*, documents(original_filename)")
      .eq("profile_id", profileId)
      .in("document_id", eligibleIds)
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
  ]);

  for (const obs of observations ?? []) {
    biomarkers.push({
      biomarker: obs.name,
      key: obs.biomarker_key,
      value: Number(obs.value),
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
    consultation_notes.push({
      document_id: row.document_id,
      filename: doc.original_filename,
      document_type: doc.document_type as DocumentType,
      provider_name: row.provider_name,
      visit_date: row.visit_date,
      chief_complaint: row.chief_complaint,
      history_summary: row.history_summary,
      exam_findings: row.exam_findings,
      documented_diagnoses: Array.isArray(row.documented_diagnoses)
        ? (row.documented_diagnoses as string[])
        : [],
      recommendations: Array.isArray(row.recommendations)
        ? (row.recommendations as string[])
        : [],
      follow_up_plan: row.follow_up_plan,
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
      ...document_summaries.map((s) => s.document_id),
    ]),
  ];

  return {
    biomarkers,
    instrumental_findings,
    consultation_notes,
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
    context.document_summaries.length > 0
  );
}
