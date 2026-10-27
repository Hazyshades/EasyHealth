import { createHash } from "node:crypto";
import {
  buildDocumentStructuredContext,
  type DocumentStructuredContext,
} from "@/lib/documents/structured-context";
import type {
  AssistantFilters,
  AssistantLimitationCode,
  AssistantSource,
} from "@/lib/assistant/contract";

export type StructuredRetrievalOptions = Readonly<{
  profileId: string;
  question: string;
  filters?: AssistantFilters;
  sourceLimit?: number;
}>;

export type StructuredRetrievalResult = Readonly<{
  sources: readonly AssistantSource[];
  limitationCodes: readonly AssistantLimitationCode[];
}>;

export type StructuredQueryIntent = Readonly<{
  terms: readonly string[];
  asksForMeasurements: boolean;
  asksForDocuments: boolean;
}>;

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "can",
  "did",
  "does",
  "for",
  "from",
  "have",
  "how",
  "in",
  "is",
  "my",
  "of",
  "on",
  "or",
  "please",
  "show",
  "tell",
  "that",
  "the",
  "their",
  "these",
  "this",
  "to",
  "what",
  "when",
  "which",
  "with",
  "was",
  "you",
]);


function dateInRange(
  value: string | null | undefined,
  filters: AssistantFilters | undefined,
): boolean {
  if (!value) return !filters?.start_date && !filters?.end_date;
  if (filters?.start_date && value < filters.start_date) return false;
  if (filters?.end_date && value > filters.end_date) return false;
  return true;
}

function documentMatches(
  source: AssistantSource,
  filters: AssistantFilters | undefined,
): boolean {
  if (filters?.document_ids?.length && source.document_id) {
    if (!filters.document_ids.includes(source.document_id)) return false;
  }
  if (
    filters?.document_types?.length &&
    source.document_type &&
    !filters.document_types.includes(
      source.document_type as (typeof filters.document_types)[number],
    )
  ) {
    return false;
  }
  if (!dateInRange(source.observed_at, filters)) return false;
  return true;
}

function measurementMatches(
  source: AssistantSource,
  filters: AssistantFilters | undefined,
): boolean {
  if (!filters?.measurement_keys?.length) return true;
  const haystack = `${source.label} ${source.excerpt}`.toLocaleLowerCase();
  return filters.measurement_keys.some((key) =>
    haystack.includes(key.toLocaleLowerCase()),
  );
}

function sourceId(kind: string, sourceRowId: string, documentId: string): string {
  const digest = createHash("sha256")
    .update(`${kind}:${sourceRowId}:${documentId}`)
    .digest("hex")
    .slice(0, 32);
  return `asrc_${digest}`;
}

function href(documentId: string): string {
  return `/app/documents/${encodeURIComponent(documentId)}`;
}

function makeSource(input: {
  profileId: string;
  sourceKind: "verified_structured";
  sourceRowId: string;
  documentId: string;
  documentType: string;
  filename: string;
  observedAt: string | null;
  label: string;
  excerpt: string;
}): AssistantSource {
  return {
    source_id: sourceId(input.sourceKind, input.sourceRowId, input.documentId),
    source_kind: input.sourceKind,
    source_row_id: input.sourceRowId,
    document_id: input.documentId,
    document_type: input.documentType,
    filename: input.filename || "Health document",
    page_number: null,
    observed_at: input.observedAt,
    label: input.label,
    excerpt: input.excerpt.slice(0, 1_200),
    href: href(input.documentId),
    profile_id: input.profileId,
  };
}

function valueText(value: number | null, valueTextValue: string | null, unit: string): string {
  if (valueTextValue) return `${valueTextValue} ${unit}`.trim();
  if (value == null) return "No reported value";
  return `${value} ${unit}`.trim();
}

export function projectStructuredAssistantSources(
  profileId: string,
  context: DocumentStructuredContext,
): AssistantSource[] {
  const sources: AssistantSource[] = [];
  for (const biomarker of context.biomarkers) {
    sources.push(
      makeSource({
        profileId,
        sourceKind: "verified_structured",
        sourceRowId: biomarker.source_row_id,
        documentId: biomarker.document_id,
        documentType: "lab_result",
        filename: biomarker.source,
        observedAt: biomarker.observed_at,
        label: `${biomarker.biomarker} result`,
        excerpt: `${biomarker.biomarker}: ${valueText(
          biomarker.value,
          biomarker.value_text,
          biomarker.unit,
        )}. Recorded ${biomarker.observed_at}.`,
      }),
    );
  }
  for (const finding of context.instrumental_findings) {
    sources.push(
      makeSource({
        profileId,
        sourceKind: "verified_structured",
        sourceRowId: finding.source_row_id,
        documentId: finding.document_id,
        documentType: finding.document_type,
        filename: finding.filename,
        observedAt: finding.study_date,
        label: finding.modality || "Instrumental finding",
        excerpt: [finding.finding_text, finding.impression, finding.summary]
          .filter(Boolean)
          .join(" "),
      }),
    );
  }
  for (const note of [...context.consultation_notes, ...context.discharge_summaries]) {
    sources.push(
      makeSource({
        profileId,
        sourceKind: "verified_structured",
        sourceRowId: note.source_row_id,
        documentId: note.document_id,
        documentType: note.document_type,
        filename: note.filename,
        observedAt: note.visit_date || note.document_observed_at,
        label: note.note_kind || "Clinical note",
        excerpt: [
          note.chief_complaint,
          note.history_summary,
          note.exam_findings,
          note.documented_problems.join(", "),
          note.recommendations.join(", "),
          note.hospital_course,
          note.discharge_diagnoses?.join(", "),
          note.summary,
        ]
          .filter(Boolean)
          .join(" "),
      }),
    );
  }
  for (const prescription of context.prescriptions) {
    const medicines = prescription.medications
      .map((medicine) =>
        [medicine.name, medicine.dose, medicine.frequency, medicine.duration]
          .filter(Boolean)
          .join(" "),
      )
      .join("; ");
    sources.push(
      makeSource({
        profileId,
        sourceKind: "verified_structured",
        sourceRowId: prescription.source_row_id,
        documentId: prescription.document_id,
        documentType: prescription.document_type,
        filename: prescription.filename,
        observedAt: prescription.prescribed_at || prescription.document_observed_at,
        label: "Prescription",
        excerpt: [medicines, prescription.summary].filter(Boolean).join(" "),
      }),
    );
  }
  for (const referral of context.referrals) {
    sources.push(
      makeSource({
        profileId,
        sourceKind: "verified_structured",
        sourceRowId: referral.source_row_id,
        documentId: referral.document_id,
        documentType: referral.document_type,
        filename: referral.filename,
        observedAt: referral.referral_date || referral.document_observed_at,
        label: "Referral",
        excerpt: [
          referral.referred_to_specialty,
          referral.referred_to_provider,
          referral.reason_for_referral,
          referral.clinical_summary,
          referral.urgency,
          referral.summary,
        ]
          .filter(Boolean)
          .join(" "),
      }),
    );
  }
  for (const summary of context.document_summaries) {
    sources.push(
      makeSource({
        profileId,
        sourceKind: "verified_structured",
        sourceRowId: summary.source_row_id,
        documentId: summary.document_id,
        documentType: summary.document_type,
        filename: summary.filename,
        observedAt: summary.observed_at,
        label: "Document summary",
        excerpt: summary.summary,
      }),
    );
  }
  return sources;
}

export function parseStructuredQueryIntent(question: string): StructuredQueryIntent {
  const terms = [...
    new Set(
      question
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}_-]+/gu, " ")
        .split(/\s+/u)
        .filter((term) => term.length >= 3 && !STOP_WORDS.has(term)),
    ),
  ].slice(0, 16);
  return {
    terms,
    asksForMeasurements: /\b(?:lab|result|value|unit|glucose|cholesterol|blood|marker|measurement)\b/iu.test(
      question,
    ),
    asksForDocuments: /\b(?:document|report|note|prescription|referral|imaging|scan)\b/iu.test(
      question,
    ),
  };
}

function sourceMatchesQuestion(source: AssistantSource, intent: StructuredQueryIntent): boolean {
  if (intent.terms.length === 0) return true;
  const haystack = `${source.label} ${source.excerpt}`.toLocaleLowerCase();
  return intent.terms.some((term) => haystack.includes(term));
}

export async function retrieveStructuredAssistantSources(
  options: StructuredRetrievalOptions,
): Promise<StructuredRetrievalResult> {
  const context = await buildDocumentStructuredContext(
    options.profileId,
    options.filters?.document_ids ?? null,
  );
  const intent = parseStructuredQueryIntent(options.question);
  const allSources = projectStructuredAssistantSources(options.profileId, context);
  const filteredSources = allSources
    .filter((source) => documentMatches(source, options.filters))
    .filter((source) => measurementMatches(source, options.filters))
    .filter((source) => sourceMatchesQuestion(source, intent))
    .sort((left, right) => {
      const leftDate = left.observed_at ?? "";
      const rightDate = right.observed_at ?? "";
      return rightDate.localeCompare(leftDate) || left.label.localeCompare(right.label);
    });
  const sourceLimit = Math.min(Math.max(options.sourceLimit ?? 24, 1), 48);
  return {
    sources: filteredSources.slice(0, sourceLimit),
    limitationCodes: [],
  };
}

export { sourceId as createAssistantSourceId };
