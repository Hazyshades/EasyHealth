import type { LanguageModel } from "ai";
import {
  runStructuredImageExtraction,
  runStructuredTextExtraction,
} from "@/lib/ai/extract-with-trace";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
import {
  normalizeBiomarkerKey,
  parseLabNumber,
  type Biomarker,
} from "@/lib/schemas/biomarkers";

export type PipelineBiomarker = Biomarker & {
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
};

export type PipelineExtractionResult = {
  lab_name: string | null;
  observed_at: string | null;
  biomarkers: PipelineBiomarker[];
};

const PIPELINE_EXTRACTION_INSTRUCTIONS = `You extract laboratory biomarkers from medical lab reports.
Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "lab_name": string | null,
  "observed_at": "YYYY-MM-DD" | null,
  "biomarkers": [
    {
      "key": "snake_case",
      "name": "Human readable test name",
      "value": number,
      "unit": "string",
      "ref_low": number | null,
      "ref_high": number | null,
      "source_page": number | null,
      "source_text": string | null,
      "confidence": number
    }
  ]
}
Rules:
- Normalize biomarker keys to snake_case using common lab keys (e.g. hba1c, sodium, potassium, bicarbonate, crp, hs_crp, uacr, ferritin, ldl, free_t4, transferrin_saturation).
- Prefer canonical names: sodium not na, lpa for Lp(a), vitamin_d for 25-OH D.
- Use ISO date YYYY-MM-DD for observed_at when visible.
- Include only quantitative laboratory test results from lab panels.
- EXCLUDE vital signs (blood pressure, pulse, respirations, temperature, SpO2).
- EXCLUDE physical examination measurements and narrative clinical notes.
- If the document is clearly not a laboratory report, return an empty biomarkers array.
- source_page is 1-based page number where the value appears.
- source_text is a short verbatim snippet from the document containing the value.
- confidence is 0.0-1.0 for extraction certainty.
- Do not diagnose or interpret clinically.`;

function parsePipelineExtraction(raw: unknown): PipelineExtractionResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const list = Array.isArray(data.biomarkers) ? data.biomarkers : [];
  const biomarkers: PipelineBiomarker[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const value = parseLabNumber(row.value);
    if (value === null) continue;

    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Unknown test";
    const keySource = typeof row.key === "string" && row.key.trim() ? row.key : name;

    biomarkers.push({
      key: normalizeBiomarkerKey(keySource, name),
      name,
      value,
      unit: typeof row.unit === "string" ? row.unit.trim() : "",
      ref_low: typeof row.ref_low === "number" ? row.ref_low : null,
      ref_high: typeof row.ref_high === "number" ? row.ref_high : null,
      source_page: typeof row.source_page === "number" ? row.source_page : null,
      source_text: typeof row.source_text === "string" ? row.source_text : null,
      confidence:
        typeof row.confidence === "number" && row.confidence >= 0 && row.confidence <= 1
          ? row.confidence
          : 0.85,
    });
  }

  return {
    lab_name: typeof data.lab_name === "string" && data.lab_name.trim() ? data.lab_name.trim() : null,
    observed_at:
      typeof data.observed_at === "string" && data.observed_at.trim() ? data.observed_at.trim() : null,
    biomarkers,
  };
}

export async function extractPipelineBiomarkersFromText(
  text: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<PipelineExtractionResult> {
  return runStructuredTextExtraction({
    model,
    system: PIPELINE_EXTRACTION_INSTRUCTIONS,
    userText: `Extract biomarkers from this lab document text (${filename}):\n\n${text.slice(0, 120000)}`,
    parse: parsePipelineExtraction,
    ctx,
  });
}

export async function extractPipelineBiomarkersFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<PipelineExtractionResult> {
  return runStructuredImageExtraction({
    model,
    system: PIPELINE_EXTRACTION_INSTRUCTIONS,
    imageBuffer,
    mimeType,
    promptText: `Extract biomarkers from this lab document image: ${filename}`,
    parse: parsePipelineExtraction,
    ctx,
  });
}

export function formatReferenceRange(ref_low: number | null, ref_high: number | null): string | null {
  if (ref_low != null && ref_high != null) return `${ref_low}-${ref_high}`;
  if (ref_low != null) return `>= ${ref_low}`;
  if (ref_high != null) return `<= ${ref_high}`;
  return null;
}
