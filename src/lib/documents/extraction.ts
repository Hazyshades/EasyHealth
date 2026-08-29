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
import {
  statedAxisValue,
  unstatedAxes,
  type AxisInference,
  type RowProvenance,
} from "./stated-axis-evidence";

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
  /** Verbatim printed label from the document; authoritative for alias matching. */
  raw_name: string;
  value: number | null;
  value_text: string | null;
  value_kind: ValueKind;
  ordinal: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  /** Verbatim reference range when the report supplied one. */
  raw_reference_range: string | null;
  source_page: number | null;
  source_text: string | null;
  /** Verbatim labelled heading or panel context when captured beside the row. */
  section_context: string | null;
  confidence: number | null;
  specimen: string;
  modifier: string;
  method: string | null;
  reported_alt_value: number | null;
  reported_alt_unit: string | null;
  collected_at: string | null;
  reported_at: string | null;
  /**
   * #106: clinical axes the model supplied without document evidence, kept for
   * observability only. Never read by the resolver, never part of identity.
   */
  inferred_axes: readonly AxisInference[] | null;
};

export type PipelineExtractionResult = {
  lab_name: string | null;
  observed_at: string | null;
  biomarkers: PipelineBiomarker[];
};

/**
 * Maps the extracted row's raw evidence into the persistence shape shared by
 * the worker and seam verifier. Resolver identity is intentionally absent.
 */
export function mapPipelineBiomarkerEvidence(
  biomarker: Pick<
    PipelineBiomarker,
    | "raw_name"
    | "value"
    | "value_text"
    | "value_kind"
    | "ordinal"
    | "unit"
    | "ref_low"
    | "ref_high"
    | "raw_reference_range"
    | "source_text"
    | "section_context"
    | "confidence"
    | "specimen"
    | "modifier"
    | "method"
    | "reported_alt_value"
    | "reported_alt_unit"
  >,
  provenance: { page: number | null; region: unknown },
) {
  return {
    raw_name: biomarker.raw_name,
    value_numeric: biomarker.value,
    value_text: biomarker.value_text,
    value_kind: biomarker.value_kind,
    ordinal: biomarker.ordinal,
    unit: biomarker.unit,
    raw_unit: biomarker.unit,
    raw_value_text: biomarker.value_text,
    reference_range:
      biomarker.raw_reference_range ?? formatReferenceRange(biomarker.ref_low, biomarker.ref_high),
    raw_reference_range: biomarker.raw_reference_range,
    source_page: provenance.page,
    bounding_box: provenance.region,
    source_text: biomarker.source_text,
    section_context: biomarker.section_context,
    confidence: biomarker.confidence,
    specimen: biomarker.specimen,
    modifier: biomarker.modifier,
    method: biomarker.method,
    reported_alt_value: biomarker.reported_alt_value,
    reported_alt_unit: biomarker.reported_alt_unit,
  };
}

const PIPELINE_EXTRACTION_INSTRUCTIONS = `You extract laboratory biomarkers from medical lab reports.
Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "lab_name": string | null,
  "observed_at": "YYYY | YYYY-MM | YYYY-MM-DD" | null,
  "biomarkers": [
    {
      "raw_name": "exact test label as printed in the document (do not translate)",
      "key": "optional English snake_case hint only",
      "name": "optional English display hint",
      "value": number | string,
      "unit": "string",
      "ref_low": number | null,
      "ref_high": number | null,
      "raw_reference_range": "verbatim reference range as printed" | null,
      "collected_at": "YYYY | YYYY-MM | YYYY-MM-DD" | null,
      "reported_at": "YYYY | YYYY-MM | YYYY-MM-DD" | null,
      "source_page": number | null,
      "source_text": string | null,
      "section_context": string | null,
      "confidence": number,
      "specimen": "serum" | "plasma" | "urine" | "whole_blood" | null,
      "modifier": string | null,
      "method": "automated" | "manual" | null,
      "reported_alt_value": number | null,
      "reported_alt_unit": string | null
    }
  ]
}
Rules:
- raw_name is REQUIRED for every row: copy the printed test name verbatim in the document language (Russian, Spanish, English, mixed). Do not translate raw_name.
- key is an optional English snake_case hint (e.g. hba1c, sodium, glucose). It is NOT authoritative identity.
- name is an optional English-oriented display hint; when unsure, omit or repeat raw_name.
- Prefer common lab keys when emitting key hints (e.g. hba1c, sodium, potassium, bicarbonate, crp, hs_crp, uacr, ferritin, ldl, free_t4, transferrin_saturation, urine_ketones, psa).
- Use YYYY, YYYY-MM, or YYYY-MM-DD for observed_at, collected_at, and reported_at when visible. Do not fill missing month/day values.
- If a table has dated columns or dated headers, emit one candidate per printed value per date. Copy that column or header date into collected_at. Do not collapse several dated cells of the same analyte into one candidate.
- When a column or value has no date, leave collected_at null. Do not copy observed_at onto the row and do not invent today's date.
- Include quantitative lab results AND qualitative/semi-quantitative results (Negative, Trace, 1+, Positive, Отрицательно, Negativo).
- For qualitative results, put the lab's verbatim text in "value" as a string (do not translate Отрицательно/Negativo into English).
- For quantitative results, put a number in "value".
- raw_reference_range is the verbatim printed reference range when visible; use null when absent. Keep ref_low/ref_high as parsed numeric bounds when present.
- For printed comparators or detection limits (< 0.20, > 10, <= 0.05, >= 10), copy that exact printed text into "value" as a string. Do not strip the comparator and do not invent a bare number.
- modifier is a clinical axis only (fasting, free, total, random, none). Never put <, >, <=, >=, less than, or greater than on modifier; those belong on value.
- If dual units are printed (e.g. 90 mg/dL / 5.0 mmol/L), store primary in value/unit and alternate in reported_alt_value/reported_alt_unit.
- Emit specimen only when the report explicitly states it on the row itself or in a labelled line (for example "Material: serum" or "Specimen: whole blood"); preserve that printed wording in source_text so the provenance gate can verify it. Do not infer it from the analyte label or from which specimen the test is usually measured in. When the report does not state it, use null.
- section_context is optional verbatim document text for a labelled section or panel heading directly associated with the row. Preserve it only when visibly captured; use null when absent. It is evidence for review and resolver policy, not permission to invent a specimen, method, unit, timing, value kind, or range.
- For CBC differentials, emit method only when the report explicitly states automated or manual; do not infer it from the analyte label.
- EXCLUDE vital signs (blood pressure, pulse, respirations, temperature, SpO2).
- EXCLUDE physical examination measurements and narrative clinical notes.
- If the document is clearly not a laboratory report, return an empty biomarkers array. Do not invent catalog entries.
- source_page is the 1-based page number where the value appears. When the input contains "=== PAGE N ===" markers, use N from the marker that precedes the value.
- source_text is a short verbatim snippet containing the printed label, the reported value, and the unit when one is present. Copy it exactly, including enough surrounding row text to make the match unique; it is grounded back to the page to highlight the source region.
- confidence is 0.0-1.0 for extraction certainty.
- Do not diagnose or interpret clinically.`;

type ExtractedAxes = {
  specimen: string;
  modifier: string;
  method: string | null;
  inferred_axes: readonly AxisInference[] | null;
};

/**
 * The model sometimes preserves a row's explicit specimen wording in
 * `source_text` but omits the structured field. Recover only that captured
 * lexical evidence; `statedAxisValue` remains the final provenance gate.
 */
function specimenFromCapturedProvenance(
  key: string,
  name: string,
  explicit: string | null,
  sourceText: string | null,
): string {
  const structured = inferSpecimen(key, name, explicit);
  if (structured !== "unspecified") return structured;
  // Section headings are preserved as captured evidence. #111 supplies a specimen
  // only through a reviewed panel policy after the stated-axis filter.
  return inferSpecimen(key, `${name} ${sourceText ?? ""}`);
}

/**
 * #106: keep only the clinical axes the document evidences.
 *
 * `inferSpecimen` and `inferModifier` are provenance-based on their own, but
 * both pass an explicit model value straight through — that branch is how an
 * invented specimen entered the pipeline. Everything the model supplied without
 * evidence is dropped to the storage default and recorded separately.
 */
function statedAxesFromRow(
  key: string,
  name: string,
  row: Record<string, unknown>,
  sourceText: string | null,
): ExtractedAxes {
  const provenance: RowProvenance = {
    label: name,
    sourceText,
    // Stated-axis filter must not treat a panel heading as a specimen word.
    // #111 applies reviewed panel policy after this filter, in the input builders.
    sectionContext: null,
  };
  const specimen = specimenFromCapturedProvenance(
    key,
    name,
    typeof row.specimen === "string" ? row.specimen : null,
    sourceText,
  );
  const modifier = inferModifier(
    key,
    name,
    typeof row.modifier === "string" ? row.modifier : null,
  );
  const method =
    typeof row.method === "string" &&
    ["automated", "manual"].includes(row.method.trim().toLowerCase())
      ? row.method.trim().toLowerCase()
      : null;
  const inferred = unstatedAxes({ specimen, modifier, method }, provenance);
  return {
    specimen: statedAxisValue("specimen", specimen, provenance) ?? "unspecified",
    modifier: statedAxisValue("modifier", modifier, provenance) ?? "none",
    method: statedAxisValue("method", method, provenance),
    inferred_axes: inferred.length > 0 ? inferred : null,
  };
}

export function parsePipelineExtraction(raw: unknown): PipelineExtractionResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const list = Array.isArray(data.biomarkers) ? data.biomarkers : [];
  const biomarkers: PipelineBiomarker[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;

    const rawName =
      typeof row.raw_name === "string" && row.raw_name.trim()
        ? row.raw_name.trim()
        : typeof row.name === "string" && row.name.trim()
          ? row.name.trim()
          : "";
    if (!rawName) continue;

    const name =
      typeof row.name === "string" && row.name.trim() ? row.name.trim() : rawName;
    const keySource = typeof row.key === "string" && row.key.trim() ? row.key : rawName;
    // Opaque extraction hint only. Semantic identity uses raw_name via resolver.
    const key = normalizeBiomarkerKeyToken(keySource) || "unknown";

    const sourceText = typeof row.source_text === "string" ? row.source_text : null;
    const rawReferenceRange =
      typeof row.raw_reference_range === "string" && row.raw_reference_range.trim()
        ? row.raw_reference_range.trim()
        : typeof row.reference_range === "string" && row.reference_range.trim()
          ? row.reference_range.trim()
          : null;
    const sectionContext =
      typeof row.section_context === "string" && row.section_context.trim()
        ? row.section_context.trim()
        : null;
    const collectedAt =
      typeof row.collected_at === "string" && row.collected_at.trim()
        ? row.collected_at.trim()
        : null;
    const reportedAt =
      typeof row.reported_at === "string" && row.reported_at.trim()
        ? row.reported_at.trim()
        : null;
    const axes = statedAxesFromRow(key, rawName, row, sourceText);

    const parsed = parseLabValueCell(row.value);
    if (!parsed) {
      const numeric = parseLabNumber(row.value);
      if (numeric === null) continue;
      biomarkers.push({
        key,
        name,
        raw_name: rawName,
        value: numeric,
        value_text: String(numeric),
        value_kind: "numeric",
        ordinal: null,
        unit: typeof row.unit === "string" ? row.unit.trim() : "",
        ref_low: typeof row.ref_low === "number" ? row.ref_low : null,
        ref_high: typeof row.ref_high === "number" ? row.ref_high : null,
        raw_reference_range: rawReferenceRange,
        source_page: typeof row.source_page === "number" ? row.source_page : null,
        source_text: sourceText,
        section_context: sectionContext,
        confidence:
          typeof row.confidence === "number" && row.confidence >= 0 && row.confidence <= 1
            ? row.confidence
            : 0.85,
        specimen: axes.specimen,
        modifier: axes.modifier,
        method: axes.method,
        inferred_axes: axes.inferred_axes,
        reported_alt_value:
          typeof row.reported_alt_value === "number" ? row.reported_alt_value : null,
        reported_alt_unit:
          typeof row.reported_alt_unit === "string" ? row.reported_alt_unit : null,
        collected_at: collectedAt,
        reported_at: reportedAt,
      });
      continue;
    }

    biomarkers.push({
      key,
      name,
      raw_name: rawName,
      value: parsed.value,
      value_text: parsed.value_text,
      value_kind: parsed.value_kind,
      ordinal: parsed.ordinal,
      unit: typeof row.unit === "string" ? row.unit.trim() : "",
      ref_low: typeof row.ref_low === "number" ? row.ref_low : null,
      ref_high: typeof row.ref_high === "number" ? row.ref_high : null,
      raw_reference_range: rawReferenceRange,
      source_page: typeof row.source_page === "number" ? row.source_page : null,
      source_text: sourceText,
      section_context: sectionContext,
      confidence:
        typeof row.confidence === "number" && row.confidence >= 0 && row.confidence <= 1
          ? row.confidence
          : 0.85,
      specimen: axes.specimen,
      modifier: axes.modifier,
      method: axes.method,
      inferred_axes: axes.inferred_axes,
      reported_alt_value:
        typeof row.reported_alt_value === "number" ? row.reported_alt_value : null,
      reported_alt_unit:
        typeof row.reported_alt_unit === "string" ? row.reported_alt_unit : null,
      collected_at: collectedAt,
      reported_at: reportedAt,
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
