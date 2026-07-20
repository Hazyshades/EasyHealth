import type { LanguageModel } from "ai";
import {
  runStructuredImageExtraction,
  runStructuredTextExtraction,
} from "@/lib/ai/extract-with-trace";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
import {
  inferModifier,
  inferSpecimen,
  normalizeBiomarkerKeyToken,
  parseLabValueCell,
  type ValueKind,
} from "@/lib/biomarkers";
import { parseLabNumber } from "@/lib/schemas/biomarkers";

export function formatReferenceRange(
  refLow: number | null,
  refHigh: number | null
): string | null {
  if (refLow == null && refHigh == null) return null;
  if (refLow != null && refHigh != null) return `${refLow} – ${refHigh}`;
  if (refLow != null) return `≥ ${refLow}`;
  return `≤ ${refHigh}`;
}

export type PipelineBiomarker = {
  key: string;
  name: string;
  value: number | null;
  value_text: string | null;
  value_kind: ValueKind;
  ordinal: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
  specimen: string;
  modifier: string;
  reported_alt_value: number | null;
  reported_alt_unit: string | null;
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
      "value": number | string,
      "unit": "string",
      "ref_low": number | null,
      "ref_high": number | null,
      "source_page": number | null,
      "source_text": string | null,
      "confidence": number,
      "specimen": "serum" | "plasma" | "urine" | "whole_blood" | null,
      "modifier": string | null,
      "reported_alt_value": number | null,
      "reported_alt_unit": string | null
    }
  ]
}
Rules:
- Normalize biomarker keys to snake_case using common lab keys (e.g. hba1c, sodium, potassium, bicarbonate, crp, hs_crp, uacr, ferritin, ldl, free_t4, transferrin_saturation, urine_ketones, psa).
- Prefer canonical names: sodium not na, lpa for Lp(a), vitamin_d for 25-OH D.
- Use ISO date YYYY-MM-DD for observed_at when visible.
- Include quantitative lab results AND qualitative/semi-quantitative results (Negative, Trace, 1+, Positive).
- For qualitative results, put the text in "value" as a string (e.g. "Negative", "2+").
- For quantitative results, put a number in "value".
- If dual units are printed (e.g. 90 mg/dL / 5.0 mmol/L), store primary in value/unit and alternate in reported_alt_value/reported_alt_unit.
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

    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Unknown test";
    const keySource = typeof row.key === "string" && row.key.trim() ? row.key : name;
    // This is an opaque extraction hint. Semantic identity is assigned later by
    // the Registry 2.0 resolver using label, unit, and context evidence.
    const key = normalizeBiomarkerKeyToken(keySource) || "unknown";

    const parsed = parseLabValueCell(row.value);
    if (!parsed) {
      // fall back: try numeric only
      const numeric = parseLabNumber(row.value);
      if (numeric === null) continue;
      const specimen = inferSpecimen(
        key,
        name,
        typeof row.specimen === "string" ? row.specimen : null
      );
      const modifier = inferModifier(
        key,
        name,
        typeof row.modifier === "string" ? row.modifier : null
      );
      biomarkers.push({
        key,
        name,
        value: numeric,
        value_text: String(numeric),
        value_kind: "numeric",
        ordinal: null,
        unit: typeof row.unit === "string" ? row.unit.trim() : "",
        ref_low: typeof row.ref_low === "number" ? row.ref_low : null,
        ref_high: typeof row.ref_high === "number" ? row.ref_high : null,
        source_page: typeof row.source_page === "number" ? row.source_page : null,
        source_text: typeof row.source_text === "string" ? row.source_text : null,
        confidence:
          typeof row.confidence === "number" && row.confidence >= 0 && row.confidence <= 1
            ? row.confidence
            : 0.85,
        specimen,
        modifier,
        reported_alt_value:
          typeof row.reported_alt_value === "number" ? row.reported_alt_value : null,
        reported_alt_unit:
          typeof row.reported_alt_unit === "string" ? row.reported_alt_unit : null,
      });
      continue;
    }

    const specimen = inferSpecimen(
      key,
      name,
      typeof row.specimen === "string" ? row.specimen : null
    );
    const modifier = inferModifier(
      key,
      name,
      typeof row.modifier === "string" ? row.modifier : null
    );

    biomarkers.push({
      key,
      name,
      value: parsed.value,
      value_text: parsed.value_text,
      value_kind: parsed.value_kind,
      ordinal: parsed.ordinal,
      unit: typeof row.unit === "string" ? row.unit.trim() : "",
      ref_low: typeof row.ref_low === "number" ? row.ref_low : null,
      ref_high: typeof row.ref_high === "number" ? row.ref_high : null,
      source_page: typeof row.source_page === "number" ? row.source_page : null,
      source_text: typeof row.source_text === "string" ? row.source_text : null,
      confidence:
        typeof row.confidence === "number" && row.confidence >= 0 && row.confidence <= 1
          ? row.confidence
          : 0.85,
      specimen,
      modifier,
      reported_alt_value:
        typeof row.reported_alt_value === "number" ? row.reported_alt_value : null,
      reported_alt_unit:
        typeof row.reported_alt_unit === "string" ? row.reported_alt_unit : null,
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
    promptText: `Extract biomarkers from this lab document image (${filename}).`,
    parse: parsePipelineExtraction,
    ctx,
  });
}
