import { generateText, type LanguageModel } from "ai";
import {
  modelIdForStage,
  resolveModelForProfileStage,
} from "@/lib/ai-provider";
import { traceGenerateText } from "@/lib/ai/structured-llm";
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
  context: DocumentStructuredContext,
  options?: {
    profileId: string;
    provider: import("@/lib/ai-provider").AiProviderId;
    modelId: string;
    supabase: ReturnType<typeof createAdminClient>;
  }
): Promise<string> {
  const userContent = `Synthesize these records:\n${JSON.stringify(
    {
      biomarkers: context.biomarkers,
      instrumental_findings: context.instrumental_findings,
      consultation_notes: context.consultation_notes,
      discharge_summaries: context.discharge_summaries,
      prescriptions: context.prescriptions,
      referrals: context.referrals,
      document_summaries: context.document_summaries,
    },
    null,
    2
  )}`;

  if (options) {
    return traceGenerateText({
      model,
      modelId: options.modelId,
      provider: options.provider,
      stage: "synthesis",
      profileId: options.profileId,
      documentId: null,
      temperature: 0.3,
      supabase: options.supabase,
      messages: [
        { role: "system", content: SYNTHESIS_SYSTEM },
        { role: "user", content: userContent },
      ],
    }).then((text) => text.trim());
  }

  const { text } = await generateText({
    model,
    maxRetries: 2,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYNTHESIS_SYSTEM },
      { role: "user", content: userContent },
    ],
  });

  return text.trim();
}

export async function forceRegenerateHolisticSynthesis(
  profileId: string
): Promise<HolisticSynthesis | null> {
  const context = await buildDocumentStructuredContext(profileId);
  if (!hasStructuredContent(context)) return null;

  const inputHash = hashStructuredContext(context);
  const supabase = createAdminClient();
  const profile = await (await import("@/lib/auth/profile")).getProfileById(profileId);
  const provider = profile.ai_provider;
  const model = await resolveModelForProfileStage(profileId, "synthesis");
  const modelId = modelIdForStage(provider, "synthesis");
  const synthesisText = await generateHolisticSynthesisText(model, context, {
    profileId,
    provider,
    modelId,
    supabase,
  });
  const generatedAt = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("profile_health_synthesis")
    .insert({
      profile_id: profileId,
      synthesis_text: synthesisText,
      source_document_ids: context.source_document_ids,
      input_hash: inputHash,
      model: modelId,
      generated_at: generatedAt,
    })
    .select("id")
    .maybeSingle();
  if (insertError) throw new Error(insertError.message);
  const synthesisId = inserted?.id ?? (
    await supabase
      .from("profile_health_synthesis")
      .select("id")
      .eq("profile_id", profileId)
      .eq("input_hash", inputHash)
      .single()
  ).data?.id;
  if (!synthesisId) throw new Error("synthesis_version_write_failed");
  const { error: stateError } = await supabase
    .from("profile_health_synthesis_state")
    .upsert({
      profile_id: profileId,
      current_synthesis_id: synthesisId,
      stale: false,
      invalidated_at: null,
      updated_at: generatedAt,
    });
  if (stateError) throw new Error(stateError.message);

  return {
    text: synthesisText,
    generated_at: generatedAt,
    source_document_ids: context.source_document_ids,
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

export async function getLatestHolisticSynthesis(
  profileId: string
): Promise<{ synthesis: HolisticSynthesis | null; stale: boolean }> {
  const supabase = createAdminClient();
  const { data: state, error: stateError } = await supabase
    .from("profile_health_synthesis_state")
    .select("stale, profile_health_synthesis(id, synthesis_text, source_document_ids, generated_at)")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (stateError) throw new Error(stateError.message);
  const version = Array.isArray(state?.profile_health_synthesis)
    ? state.profile_health_synthesis[0]
    : state?.profile_health_synthesis;
  if (!version?.synthesis_text) return { synthesis: null, stale: Boolean(state?.stale) };
  return {
    synthesis: {
      text: version.synthesis_text,
      generated_at: version.generated_at,
      source_document_ids: version.source_document_ids ?? [],
      disclaimer: MEDICAL_DISCLAIMER,
    },
    stale: Boolean(state?.stale),
  };
}
