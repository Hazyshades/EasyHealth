import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { extractionSchema, normalizeBiomarkerKey } from "@/lib/schemas/biomarkers";

export async function extractBiomarkersFromFile(
  buffer: Buffer,
  mimeType: string,
  filename: string
) {
  const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: extractionSchema,
    messages: [
      {
        role: "system",
        content: `You extract laboratory biomarkers from medical lab reports.
Return structured JSON only. Normalize biomarker keys to snake_case (e.g. hba1c, tsh, ldl).
Use ISO date YYYY-MM-DD for observed_at when visible. If unknown, use null.
Do not diagnose or interpret clinically - only extract values from the document.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract all biomarkers from this lab document: ${filename}`,
          },
          isPdf
            ? {
                type: "file",
                data: buffer,
                mediaType: "application/pdf",
              }
            : {
                type: "image",
                image: buffer,
                mediaType: mimeType,
              },
        ],
      },
    ],
  });

  return {
    ...object,
    biomarkers: object.biomarkers.map((b) => ({
      ...b,
      key: normalizeBiomarkerKey(b.key, b.name),
    })),
  };
}
