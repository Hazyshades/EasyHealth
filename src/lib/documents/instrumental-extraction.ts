import type { LanguageModel } from "ai";
import {
  runStructuredImageExtraction,
  runStructuredTextExtraction,
} from "@/lib/ai/extract-with-trace";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
import { normalizeBiomarkerKey, parseLabNumber } from "@/lib/schemas/biomarkers";

export type InstrumentalFinding = {
  finding_text: string;
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
};

export type InstrumentalNumericMeasure = {
  key: string;
  name: string;
  value: number;
  unit: string;
};

export type InstrumentalExtractionResult = {
  facility_name: string | null;
  study_date: string | null;
  modality: string | null;
  body_region: string | null;
  impression: string | null;
  findings: InstrumentalFinding[];
  numeric_measures: InstrumentalNumericMeasure[];
};

const INSTRUMENTAL_INSTRUCTIONS = `You extract structured data from instrumental medical reports (imaging, ECG, EEG, spirometry, endoscopy, etc.).
Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "facility_name": string | null,
  "study_date": "YYYY-MM-DD" | null,
  "modality": string | null,
  "body_region": string | null,
  "impression": string | null,
  "findings": [
    {
      "finding_text": "descriptive finding from the report",
      "source_page": number | null,
      "source_text": string | null,
      "confidence": number
    }
  ],
  "numeric_measures": [
    {
      "key": "snake_case",
      "name": "Human readable measure name",
      "value": number,
      "unit": "string"
    }
  ]
}
Rules:
- Quote or paraphrase only what appears in the document. Do not invent findings.
- modality examples: US, CT, MRI, XRAY, ECG, EEG, ENDOSCOPY, OTHER
- impression is the report conclusion/impression as stated in the document.
- confidence is 0.0-1.0 per finding.
- numeric_measures: explicitly stated numeric values (e.g. ejection fraction %, chamber dimensions, FEV1).
- Do not diagnose or interpret clinically beyond the document text.`;

function parseNumericMeasures(value: unknown): InstrumentalNumericMeasure[] {
  if (!Array.isArray(value)) return [];
  const measures: InstrumentalNumericMeasure[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const numericValue = parseLabNumber(row.value);
    if (numericValue === null) continue;

    const name =
      typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Unknown measure";
    const keySource = typeof row.key === "string" && row.key.trim() ? row.key : name;

    measures.push({
      key: normalizeBiomarkerKey(keySource, name),
      name,
      value: numericValue,
      unit: typeof row.unit === "string" ? row.unit.trim() : "",
    });
  }

  return measures;
}

function parseInstrumentalExtraction(raw: unknown): InstrumentalExtractionResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const list = Array.isArray(data.findings) ? data.findings : [];
  const findings: InstrumentalFinding[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const findingText =
      typeof row.finding_text === "string" && row.finding_text.trim()
        ? row.finding_text.trim()
        : null;
    if (!findingText) continue;

    findings.push({
      finding_text: findingText,
      source_page: typeof row.source_page === "number" ? row.source_page : null,
      source_text: typeof row.source_text === "string" ? row.source_text : null,
      confidence:
        typeof row.confidence === "number" && row.confidence >= 0 && row.confidence <= 1
          ? row.confidence
          : 0.85,
    });
  }

  return {
    facility_name:
      typeof data.facility_name === "string" && data.facility_name.trim()
        ? data.facility_name.trim()
        : null,
    study_date:
      typeof data.study_date === "string" && data.study_date.trim() ? data.study_date.trim() : null,
    modality: typeof data.modality === "string" && data.modality.trim() ? data.modality.trim() : null,
    body_region:
      typeof data.body_region === "string" && data.body_region.trim()
        ? data.body_region.trim()
        : null,
    impression:
      typeof data.impression === "string" && data.impression.trim() ? data.impression.trim() : null,
    findings,
    numeric_measures: parseNumericMeasures(data.numeric_measures),
  };
}

export async function extractInstrumentalFromText(
  text: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<InstrumentalExtractionResult> {
  return runStructuredTextExtraction({
    model,
    system: INSTRUMENTAL_INSTRUCTIONS,
    userText: `Extract instrumental report data from this document text (${filename}):\n\n${text.slice(0, 120000)}`,
    parse: parseInstrumentalExtraction,
    ctx,
  });
}

export async function extractInstrumentalFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<InstrumentalExtractionResult> {
  return runStructuredImageExtraction({
    model,
    system: INSTRUMENTAL_INSTRUCTIONS,
    imageBuffer,
    mimeType,
    promptText: `Extract instrumental report data from this image: ${filename}`,
    parse: parseInstrumentalExtraction,
    ctx,
  });
}
