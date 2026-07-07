import { z } from "zod";
import { hasStructuredContent, type DocumentStructuredContext } from "@/lib/documents/structured-context";

const structuredBiomarkerSchema = z.object({
  biomarker: z.string().min(1),
  key: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  ref_low: z.number().nullable(),
  ref_high: z.number().nullable(),
  observed_at: z.string().min(1),
  source: z.string().default("agent"),
});

const structuredFindingSchema = z.object({
  document_id: z.string().default("agent"),
  filename: z.string().default("agent-submission"),
  document_type: z.string().default("instrumental"),
  modality: z.string().nullable().optional(),
  body_region: z.string().nullable().optional(),
  finding_text: z.string(),
  impression: z.string().nullable().optional(),
  study_date: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

const structuredClinicalNoteSchema = z.object({
  document_id: z.string().default("agent"),
  filename: z.string().default("agent-submission"),
  document_type: z.string().default("consultation"),
  note_kind: z.string().nullable().optional(),
  provider_name: z.string().nullable().optional(),
  visit_date: z.string().nullable().optional(),
  chief_complaint: z.string().nullable().optional(),
  history_summary: z.string().nullable().optional(),
  exam_findings: z.string().nullable().optional(),
  documented_problems: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  follow_up_plan: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export const agentStructuredDataSchema = z.object({
  biomarkers: z.array(structuredBiomarkerSchema).default([]),
  instrumental_findings: z.array(structuredFindingSchema).default([]),
  consultation_notes: z.array(structuredClinicalNoteSchema).default([]),
  discharge_summaries: z.array(structuredClinicalNoteSchema).default([]),
  prescriptions: z.array(z.unknown()).default([]),
  referrals: z.array(z.unknown()).default([]),
  document_summaries: z
    .array(
      z.object({
        document_id: z.string(),
        filename: z.string(),
        document_type: z.string(),
        summary: z.string(),
      })
    )
    .default([]),
  source_document_ids: z.array(z.string()).default([]),
});

export const agentInsightRequestSchema = z.object({
  tier: z.enum(["basic", "plus", "pro"]).optional(),
  options: z
    .object({
      depth: z.enum(["standard", "deep"]).optional(),
      include_citations: z.boolean().optional(),
      output_format: z.enum(["json", "text"]).optional(),
    })
    .optional(),
  data: agentStructuredDataSchema,
});

export type AgentInsightRequest = z.infer<typeof agentInsightRequestSchema>;
export type AgentStructuredData = z.infer<typeof agentStructuredDataSchema>;

export function parseAgentInsightRequest(
  raw: unknown
): { ok: true; data: AgentInsightRequest } | { ok: false; error: string } {
  const result = agentInsightRequestSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join("; ");
    return { ok: false, error: message || "Invalid request body" };
  }

  const context = mapAgentDataToContext(result.data.data);
  if (!hasStructuredContent(context)) {
    return { ok: false, error: "data must include at least one biomarker or document section" };
  }

  return { ok: true, data: result.data };
}

export function mapAgentDataToContext(data: AgentStructuredData): DocumentStructuredContext {
  return {
    biomarkers: data.biomarkers,
    instrumental_findings: data.instrumental_findings.map((f) => ({
      ...f,
      modality: f.modality ?? null,
      body_region: f.body_region ?? null,
      impression: f.impression ?? null,
      study_date: f.study_date ?? null,
      summary: f.summary ?? null,
      document_type: f.document_type as DocumentStructuredContext["instrumental_findings"][0]["document_type"],
    })),
    consultation_notes: data.consultation_notes.map((n) => ({
      ...n,
      note_kind: n.note_kind ?? null,
      provider_name: n.provider_name ?? null,
      visit_date: n.visit_date ?? null,
      chief_complaint: n.chief_complaint ?? null,
      history_summary: n.history_summary ?? null,
      exam_findings: n.exam_findings ?? null,
      follow_up_plan: n.follow_up_plan ?? null,
      summary: n.summary ?? null,
      document_type: n.document_type as DocumentStructuredContext["consultation_notes"][0]["document_type"],
    })),
    discharge_summaries: data.discharge_summaries.map((n) => ({
      ...n,
      note_kind: n.note_kind ?? "discharge",
      provider_name: n.provider_name ?? null,
      visit_date: n.visit_date ?? null,
      chief_complaint: n.chief_complaint ?? null,
      history_summary: n.history_summary ?? null,
      exam_findings: n.exam_findings ?? null,
      follow_up_plan: n.follow_up_plan ?? null,
      summary: n.summary ?? null,
      document_type: n.document_type as DocumentStructuredContext["discharge_summaries"][0]["document_type"],
    })),
    prescriptions: [],
    referrals: [],
    document_summaries: data.document_summaries,
    source_document_ids: data.source_document_ids.length
      ? data.source_document_ids
      : ["agent-submission"],
  };
}
