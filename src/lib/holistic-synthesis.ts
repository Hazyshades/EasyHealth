import { generateText, type LanguageModel } from "ai";
import { resolveModelForProfile } from "@/lib/ai-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import type { HolisticSynthesis } from "@/lib/health-systems";
import {
  buildDocumentStructuredContext,
  hashStructuredContext,
  hasStructuredContent,
  type DocumentStructuredContext,
} from "@/lib/documents/structured-context";

const SYNTHESIS_SYSTEM = `You are an educational health literacy assistant for EasyHealth.
Write a holistic synthesis across the patient's uploaded medical records (labs, imaging reports, consultations).
Rules:
- Educational language only. NO new diagnoses, prescriptions, or treatment plans.
- Quote or reference what documents state; cite filenames and dates when provided.
- Connect related findings across record types when supported by the data.
- 3-5 sentences maximum.
- Do not include a disclaimer (added by the server).`;

export async function generateHolisticSynthesisText(
  model: LanguageModel,
  context: DocumentStructuredContext
): Promise<string> {
  const { text } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      { role: "system", content: SYNTHESIS_SYSTEM },
      {
        role: "user",
        content: `Synthesize these records:\n${JSON.stringify(
          {
            biomarkers: context.biomarkers,
            instrumental_findings: context.instrumental_findings,
            consultation_notes: context.consultation_notes,
            document_summaries: context.document_summaries,
          },
          null,
          2
        )}`,
      },
    ],
  });

  return text.trim();
}

export async function getOrCreateHolisticSynthesis(
  profileId: string
): Promise<HolisticSynthesis | null> {
  const context = await buildDocumentStructuredContext(profileId);
  if (!hasStructuredContent(context)) return null;

  const inputHash = hashStructuredContext(context);
  const supabase = createAdminClient();

  const { data: cached } = await supabase
    .from("profile_health_synthesis")
    .select("synthesis_text, source_document_ids, generated_at, input_hash")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (cached && cached.input_hash === inputHash && cached.synthesis_text) {
    return {
      text: cached.synthesis_text,
      generated_at: cached.generated_at,
      source_document_ids: cached.source_document_ids ?? [],
      disclaimer: MEDICAL_DISCLAIMER,
    };
  }

  const model = await resolveModelForProfile(profileId);
  const synthesisText = await generateHolisticSynthesisText(model, context);
  const modelId = "gpt-4o-mini";
  const generatedAt = new Date().toISOString();

  await supabase.from("profile_health_synthesis").upsert({
    profile_id: profileId,
    synthesis_text: synthesisText,
    source_document_ids: context.source_document_ids,
    input_hash: inputHash,
    model: modelId,
    generated_at: generatedAt,
  });

  return {
    text: synthesisText,
    generated_at: generatedAt,
    source_document_ids: context.source_document_ids,
    disclaimer: MEDICAL_DISCLAIMER,
  };
}
