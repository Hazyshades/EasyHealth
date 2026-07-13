import type { LanguageModel } from "ai";
import {
  runStructuredImageExtraction,
  runStructuredTextExtraction,
} from "@/lib/ai/extract-with-trace";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";

export type ReferralExtractionResult = {
  referring_provider: string | null;
  referred_to_specialty: string | null;
  referred_to_provider: string | null;
  referral_date: string | null;
  reason_for_referral: string | null;
  clinical_summary: string | null;
  urgency: string | null;
};

const REFERRAL_INSTRUCTIONS = `You extract structured data from medical referral letters.
Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "referring_provider": string | null,
  "referred_to_specialty": string | null,
  "referred_to_provider": string | null,
  "referral_date": "YYYY-MM-DD" | null,
  "reason_for_referral": string | null,
  "clinical_summary": string | null,
  "urgency": string | null
}
Rules:
- Extract only what appears in the document. Do not diagnose or prescribe.
- urgency examples: routine, urgent, emergent — use document wording when present.
- Use ISO date YYYY-MM-DD for referral_date when visible.`;

function parseReferralExtraction(raw: unknown): ReferralExtractionResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const nullableString = (key: string) => {
    const v = data[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  return {
    referring_provider: nullableString("referring_provider"),
    referred_to_specialty: nullableString("referred_to_specialty"),
    referred_to_provider: nullableString("referred_to_provider"),
    referral_date: nullableString("referral_date"),
    reason_for_referral: nullableString("reason_for_referral"),
    clinical_summary: nullableString("clinical_summary"),
    urgency: nullableString("urgency"),
  };
}

export async function extractReferralFromText(
  text: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<ReferralExtractionResult> {
  return runStructuredTextExtraction({
    model,
    system: REFERRAL_INSTRUCTIONS,
    userText: `Extract referral data from this document (${filename}):\n\n${text.slice(0, 120000)}`,
    parse: parseReferralExtraction,
    ctx,
  });
}

export async function extractReferralFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<ReferralExtractionResult> {
  return runStructuredImageExtraction({
    model,
    system: REFERRAL_INSTRUCTIONS,
    imageBuffer,
    mimeType,
    promptText: `Extract referral data from this image: ${filename}`,
    parse: parseReferralExtraction,
    ctx,
  });
}
