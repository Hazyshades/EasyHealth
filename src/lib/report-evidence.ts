import { createHash } from "node:crypto";
import type {
  ClinicalNoteSourceSnapshot,
  DocumentSummarySourceSnapshot,
  FindingSourceSnapshot,
  ObservationSourceSnapshot,
  PrescriptionSourceSnapshot,
  ReferralSourceSnapshot,
  ReportSource,
  ReportSourceKind,
  ReportSourceSnapshot,
} from "@/lib/report-contract";
import type { MultiSourceReportContext } from "@/lib/reports";

export type ReportEvidenceMapping = {
  report_id: string;
  source_id: string;
  source_kind: ReportSourceKind;
  source_row_id: string;
  document_id: string;
};

export type PendingReportEvidenceMapping = Omit<
  ReportEvidenceMapping,
  "report_id"
>;

export type ReportPromptSource = {
  source_id: string;
  kind: ReportSourceKind;
  document_id: string;
  snapshot: ReportSourceSnapshot;
};

export type ReportEvidenceProjection = {
  sources: ReportSource[];
  mappings: PendingReportEvidenceMapping[];
  prompt_sources: ReportPromptSource[];
  source_document_ids: string[];
};

export function createOpaqueSourceId(
  sourceKind: ReportSourceKind,
  sourceRowId: string,
  documentId: string,
): string {
  const identity = `${sourceKind}:${sourceRowId}:${documentId}`;
  return `src_${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
}

export function materializeReportEvidenceMappings(
  reportId: string,
  projection: ReportEvidenceProjection,
): ReportEvidenceMapping[] {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      reportId,
    )
  ) {
    throw new Error("REPORT_ID_INVALID");
  }
  return projection.mappings.map((mapping) => ({
    report_id: reportId,
    ...mapping,
  }));
}

export function buildReportEvidenceProjection(
  context: MultiSourceReportContext,
): ReportEvidenceProjection {
  const sourceByIdentity = new Map<string, ReportSource>();
  const mappingBySourceId = new Map<string, PendingReportEvidenceMapping>();

  const registerSource = (
    sourceKind: ReportSourceKind,
    sourceRowId: string,
    documentId: string,
    snapshot: ReportSourceSnapshot,
  ) => {
    const sourceId = createOpaqueSourceId(sourceKind, sourceRowId, documentId);
    const identity = `${sourceKind}:${sourceRowId}:${documentId}`;
    if (sourceByIdentity.has(identity)) return;

    sourceByIdentity.set(identity, {
      source_id: sourceId,
      kind: sourceKind,
      document_id: documentId,
      snapshot,
    });
    mappingBySourceId.set(sourceId, {
      source_id: sourceId,
      source_kind: sourceKind,
      source_row_id: sourceRowId,
      document_id: documentId,
    });
  };

  for (const item of context.biomarkers) {
    const snapshot: ObservationSourceSnapshot = {
      kind: "observation",
      label:
        item.measurement_definition_key ?? item.analyte_key ?? item.biomarker,
      observed_at: item.observed_at,
      value: item.value,
      value_text: item.value_text,
      unit: item.unit,
      ref_low: item.ref_low,
      ref_high: item.ref_high,
    };
    registerSource(
      "observation",
      item.source_row_id,
      item.document_id,
      snapshot,
    );
  }

  for (const item of context.instrumental_findings) {
    const snapshot: FindingSourceSnapshot = {
      kind: "finding",
      label: item.filename,
      observed_at: item.study_date,
      finding_text: item.finding_text,
      impression: item.impression,
    };
    registerSource("finding", item.source_row_id, item.document_id, snapshot);
  }

  for (const item of context.consultation_notes) {
    const snapshot: ClinicalNoteSourceSnapshot = {
      kind: "clinical_note",
      label: item.filename,
      observed_at: item.visit_date,
      provider_name: item.provider_name,
      summary: item.summary,
    };
    registerSource(
      "clinical_note",
      item.source_row_id,
      item.document_id,
      snapshot,
    );
  }

  for (const item of context.discharge_summaries) {
    const snapshot: ClinicalNoteSourceSnapshot = {
      kind: "clinical_note",
      label: item.filename,
      observed_at: item.discharge_date ?? item.admission_date,
      provider_name: item.provider_name,
      summary: item.hospital_course,
    };
    registerSource(
      "clinical_note",
      item.source_row_id,
      item.document_id,
      snapshot,
    );
  }

  for (const item of context.prescriptions) {
    const snapshot: PrescriptionSourceSnapshot = {
      kind: "prescription",
      label: item.filename,
      observed_at: item.prescribed_at,
      prescriber_name: item.prescriber_name,
      summary: item.summary,
    };
    registerSource(
      "prescription",
      item.source_row_id,
      item.document_id,
      snapshot,
    );
  }

  for (const item of context.referrals) {
    const snapshot: ReferralSourceSnapshot = {
      kind: "referral",
      label: item.filename,
      observed_at: item.referral_date,
      referring_provider: item.referring_provider,
      referred_to_specialty: item.referred_to_specialty,
      summary: item.clinical_summary,
    };
    registerSource("referral", item.source_row_id, item.document_id, snapshot);
  }

  for (const item of context.document_summaries) {
    const snapshot: DocumentSummarySourceSnapshot = {
      kind: "document_summary",
      label: item.filename,
      observed_at: item.observed_at,
      document_type: item.document_type,
      summary: item.summary,
    };
    registerSource(
      "document_summary",
      item.source_row_id,
      item.document_id,
      snapshot,
    );
  }

  const sources = [...sourceByIdentity.values()];
  const mappings = [...mappingBySourceId.values()];
  const sourceDocumentIds = [
    ...new Set(sources.map((source) => source.document_id)),
  ];

  return {
    sources,
    mappings,
    prompt_sources: sources.map(
      ({ source_id, kind, document_id, snapshot }) => ({
        source_id,
        kind,
        document_id,
        snapshot,
      }),
    ),
    source_document_ids: sourceDocumentIds,
  };
}
