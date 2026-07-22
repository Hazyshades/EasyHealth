import type { LanguageModel } from "ai";
import {
  runStructuredImageExtraction,
  runStructuredTextExtraction,
} from "@/lib/ai/extract-with-trace";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
import type { InstrumentalMeasureMaterializationInput } from "@/lib/documents/instrumental-measure-lineage";
import { parseLabNumber } from "@/lib/schemas/biomarkers";

export type InstrumentalFinding = {
  finding_text: string;
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
};

export type InstrumentalNumericMeasure = InstrumentalMeasureMaterializationInput;

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
      "key_hint": "optional model-generated snake_case hint; not a clinical or source identity",
      "name": "Human readable measure name",
      "raw_name": "exact label as printed in the report",
      "value": number,
      "raw_value_text": "exact printed numeric value",
      "unit": "string; empty only when the report is explicitly unitless",
      "raw_unit": "exact printed unit; empty when unitless",
      "source_page": number | null,
      "source_text": "short source quote containing the measure" | null,
      "source_locator": "stable local locator such as page:1/table:measurements/row:3",
      "occurrence_index": "zero-based occurrence number within source_locator",
      "bounding_box": object | null,
      "confidence": number | null
    }
  ]
}
Rules:
- Quote or paraphrase only what appears in the document. Do not invent findings.
- modality examples: US, CT, MRI, XRAY, ECG, EEG, ENDOSCOPY, OTHER
- impression is the report conclusion/impression as stated in the document.
- confidence is 0.0-1.0 per finding.
- numeric_measures: explicitly stated numeric values (e.g. ejection fraction %, chamber dimensions, FEV1).
- Every numeric measure must include raw/display values, source context or a stable source_locator, and an occurrence_index. Repeated left/right, regional, or serial values are separate entries even when their names match.
- key_hint is only a model hint. Never use it to merge or identify source measures.
- Do not diagnose or interpret clinically beyond the document text.`;

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pageNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function confidenceOrNull(value: unknown): number | null {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : null;
}

function boundingBoxOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function deterministicSourceLocator(name: string, sourcePage: number | null, sourceText: string | null) {
  const evidence = (sourceText ?? name)
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 240);
  return `page:${sourcePage ?? 0}|evidence:${evidence}`;
}

function parseNumericMeasures(value: unknown): InstrumentalNumericMeasure[] {
  if (!Array.isArray(value)) return [];
  const measures: InstrumentalNumericMeasure[] = [];
  const nextOccurrenceByLocator = new Map<string, number>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const numericValue = parseLabNumber(row.value);
    if (numericValue === null) continue;

    const name = textOrNull(row.name);
    if (!name) continue;
    const sourcePage = pageNumberOrNull(row.source_page);
    const sourceText = textOrNull(row.source_text);
    const sourceLocator =
      textOrNull(row.source_locator) ?? deterministicSourceLocator(name, sourcePage, sourceText);
    const suppliedOccurrence =
      typeof row.occurrence_index === "number" &&
      Number.isInteger(row.occurrence_index) &&
      row.occurrence_index >= 0
        ? row.occurrence_index
        : null;
    const occurrenceIndex = suppliedOccurrence ?? (nextOccurrenceByLocator.get(sourceLocator) ?? 0);
    nextOccurrenceByLocator.set(
      sourceLocator,
      Math.max(nextOccurrenceByLocator.get(sourceLocator) ?? 0, occurrenceIndex + 1)
    );

    measures.push({
      key_hint: textOrNull(row.key_hint) ?? textOrNull(row.key),
      name,
      raw_name: textOrNull(row.raw_name) ?? name,
      value: numericValue,
      raw_value_text: textOrNull(row.raw_value_text) ?? String(numericValue),
      unit: typeof row.unit === "string" ? row.unit.trim() : "",
      raw_unit:
        typeof row.raw_unit === "string"
          ? row.raw_unit.trim()
          : typeof row.unit === "string"
            ? row.unit.trim()
            : "",
      source_page: sourcePage,
      source_text: sourceText,
      source_locator: sourceLocator,
      occurrence_index: occurrenceIndex,
      bounding_box: boundingBoxOrNull(row.bounding_box),
      confidence: confidenceOrNull(row.confidence),
    });
  }

  return measures;
}

export function parseInstrumentalExtraction(raw: unknown): InstrumentalExtractionResult {
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
