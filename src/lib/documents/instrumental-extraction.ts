import { generateText, type LanguageModel } from "ai";
import { parseJsonFromModelText } from "@/lib/schemas/biomarkers";

export type InstrumentalFinding = {
  finding_text: string;
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
};

export type InstrumentalExtractionResult = {
  facility_name: string | null;
  study_date: string | null;
  modality: string | null;
  body_region: string | null;
  impression: string | null;
  findings: InstrumentalFinding[];
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
  ]
}
Rules:
- Quote or paraphrase only what appears in the document. Do not invent findings.
- modality examples: US, CT, MRI, XRAY, ECG, EEG, ENDOSCOPY, OTHER
- impression is the report conclusion/impression as stated in the document.
- confidence is 0.0-1.0 per finding.
- Do not diagnose or interpret clinically beyond the document text.`;

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
  };
}

export async function extractInstrumentalFromText(
  text: string,
  model: LanguageModel,
  filename: string
): Promise<InstrumentalExtractionResult> {
  const { text: response } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      { role: "system", content: INSTRUMENTAL_INSTRUCTIONS },
      {
        role: "user",
        content: `Extract instrumental report data from this document text (${filename}):\n\n${text.slice(0, 120000)}`,
      },
    ],
  });

  return parseInstrumentalExtraction(parseJsonFromModelText(response));
}

export async function extractInstrumentalFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  model: LanguageModel,
  filename: string
): Promise<InstrumentalExtractionResult> {
  const { text: response } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      { role: "system", content: INSTRUMENTAL_INSTRUCTIONS },
      {
        role: "user",
        content: [
          { type: "text", text: `Extract instrumental report data from this image: ${filename}` },
          { type: "image", image: imageBuffer, mediaType: mimeType },
        ],
      },
    ],
  });

  return parseInstrumentalExtraction(parseJsonFromModelText(response));
}
