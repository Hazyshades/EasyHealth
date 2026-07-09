import type { LanguageModel } from "ai";
import { generateStructuredJson } from "@/lib/ai/structured-llm";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
import { parseJsonFromModelText } from "@/lib/schemas/biomarkers";
import type { DocumentType } from "@/lib/health-systems";

export const CLASSIFIABLE_TYPES = [
  "lab_result",
  "instrumental_report",
  "consultation_note",
  "discharge_summary",
  "prescription",
  "referral",
] as const satisfies readonly DocumentType[];

export type ClassifiableDocumentType = (typeof CLASSIFIABLE_TYPES)[number];

export type TypeClassificationResult = {
  detected_type: ClassifiableDocumentType;
  confidence: number;
  reason: string;
};

export const MISMATCH_CONFIDENCE_THRESHOLD = 0.7;

const CLASSIFICATION_INSTRUCTIONS = `You classify medical documents into exactly one type.
Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "detected_type": "lab_result" | "instrumental_report" | "consultation_note" | "discharge_summary" | "prescription" | "referral",
  "confidence": number,
  "reason": "brief English explanation"
}
Rules:
- lab_result: laboratory test panels with numeric biomarkers (blood, urine, pathology labs).
- instrumental_report: imaging, ECG, EEG, spirometry, endoscopy, or other functional/diagnostic study reports.
- consultation_note: outpatient visit notes, H&P, clinic encounters, progress notes.
- discharge_summary: hospital discharge summaries with admission/discharge dates and hospital course.
- prescription: medication prescriptions or prescription lists.
- referral: referral letters to specialists.
- confidence is 0.0-1.0 for classification certainty.
- reason should be one short sentence citing visible document cues.`;

function parseClassification(raw: unknown): TypeClassificationResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const detectedRaw = typeof data.detected_type === "string" ? data.detected_type : "lab_result";
  const detected_type = CLASSIFIABLE_TYPES.includes(detectedRaw as ClassifiableDocumentType)
    ? (detectedRaw as ClassifiableDocumentType)
    : "lab_result";

  const confidence =
    typeof data.confidence === "number" && data.confidence >= 0 && data.confidence <= 1
      ? data.confidence
      : 0.5;

  const reason =
    typeof data.reason === "string" && data.reason.trim() ? data.reason.trim() : "Unable to determine";

  return { detected_type, confidence, reason };
}

async function classifyWithTrace(
  model: LanguageModel,
  userContent: string | Array<{ type: "text"; text: string } | { type: "image"; image: Buffer; mediaType: string }>,
  ctx: PipelineLlmContext
): Promise<TypeClassificationResult> {
  return generateStructuredJson({
    trace: {
      model,
      modelId: ctx.modelId,
      provider: ctx.provider,
      stage: ctx.stage,
      profileId: ctx.profileId,
      documentId: ctx.documentId,
      providerSwitch: ctx.providerSwitch ?? false,
      supabase: ctx.supabase,
      temperature: 0,
      messages: [
        { role: "system", content: CLASSIFICATION_INSTRUCTIONS },
        { role: "user", content: userContent },
      ],
    },
    parse: (raw) => parseClassification(parseJsonFromModelText(raw)),
  });
}

export async function classifyDocumentFromText(
  text: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<TypeClassificationResult> {
  const userContent = `Classify this medical document (${filename}):\n\n${text.slice(0, 60000)}`;
  if (ctx) {
    return classifyWithTrace(model, userContent, ctx);
  }

  const { generateText } = await import("ai");
  const { text: response } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      { role: "system", content: CLASSIFICATION_INSTRUCTIONS },
      { role: "user", content: userContent },
    ],
  });

  return parseClassification(parseJsonFromModelText(response));
}

export async function classifyDocumentFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<TypeClassificationResult> {
  const userContent = [
    { type: "text" as const, text: `Classify this medical document image: ${filename}` },
    { type: "image" as const, image: imageBuffer, mediaType: mimeType },
  ];

  if (ctx) {
    return classifyWithTrace(model, userContent, ctx);
  }

  const { generateText } = await import("ai");
  const { text: response } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      { role: "system", content: CLASSIFICATION_INSTRUCTIONS },
      { role: "user", content: userContent },
    ],
  });

  return parseClassification(parseJsonFromModelText(response));
}

export function computeTypeMismatch(
  selectedType: DocumentType,
  classification: TypeClassificationResult
): { warning: boolean; detectedType: ClassifiableDocumentType; reason: string } {
  const mismatch =
    classification.detected_type !== selectedType &&
    classification.confidence >= MISMATCH_CONFIDENCE_THRESHOLD;

  return {
    warning: mismatch,
    detectedType: classification.detected_type,
    reason: classification.reason,
  };
}
