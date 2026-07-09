import { generateText, type LanguageModel } from "ai";
import { parseJsonFromModelText, sanitizeExtraction } from "@/lib/schemas/biomarkers";
import { resolveModelForProfile } from "@/lib/ai-provider";

const EXTRACTION_INSTRUCTIONS = `You extract laboratory biomarkers from medical lab reports.
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
      "ref_high": number | null
    }
  ]
}
Rules:
- Normalize biomarker keys to snake_case using common lab keys (e.g. hba1c, total_protein, wbc, sodium, potassium, crp, hs_crp, uacr, ferritin, ldl, free_t4).
- Prefer canonical names: sodium not na, bicarbonate not co2, lpa for Lp(a), transferrin_saturation for TSAT, vitamin_d for 25-OH D.
- Use ISO date YYYY-MM-DD for observed_at when visible.
- Include quantitative tests and qualitative/semi-quantitative results (Negative, Trace, 1+).
- For qualitative results use a string in value (e.g. "Negative"); for numbers use numeric value.
- For values like "< 0.20", use the numeric part as value (0.2).
- ref_low and ref_high must be numbers when a numeric reference range is shown.
- Do not diagnose or interpret clinically. Only extract values from the document.`;

function buildUserContent(buffer: Buffer, mimeType: string, filename: string) {
  const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

  return [
    {
      type: "text" as const,
      text: `Extract all biomarkers from this lab document: ${filename}`,
    },
    isPdf
      ? {
          type: "file" as const,
          data: buffer,
          mediaType: "application/pdf" as const,
        }
      : {
          type: "image" as const,
          image: buffer,
          mediaType: mimeType,
        },
  ];
}

export async function extractBiomarkersFromFile(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  options?: { profileId?: string; model?: LanguageModel }
) {
  const model =
    options?.model ??
    (options?.profileId ? await resolveModelForProfile(options.profileId) : undefined);

  if (!model) {
    throw new Error("Profile id or model is required for extraction");
  }

  const { text } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      { role: "system", content: EXTRACTION_INSTRUCTIONS },
      {
        role: "user",
        content: buildUserContent(buffer, mimeType, filename),
      },
    ],
  });

  const raw = parseJsonFromModelText(text);
  return sanitizeExtraction(raw);
}
