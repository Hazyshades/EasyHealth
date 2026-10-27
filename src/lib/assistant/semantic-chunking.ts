import { createHash } from "node:crypto";

export type AssistantDocumentPage = Readonly<{
  id: string;
  page_number: number;
  ocr_text: string | null;
  section_context?: string | null;
}>;

export type AssistantDocumentChunk = Readonly<{
  document_page_id: string;
  page_number: number;
  chunk_index: number;
  section_context: string | null;
  content: string;
  content_sha256: string;
}>;

export const ASSISTANT_CHUNK_MAX_CHARS = 1_200;
export const ASSISTANT_CHUNK_OVERLAP_CHARS = 160;

function normalizedText(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function splitLongParagraph(paragraph: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < paragraph.length) {
    const end = Math.min(start + ASSISTANT_CHUNK_MAX_CHARS, paragraph.length);
    chunks.push(paragraph.slice(start, end).trim());
    if (end >= paragraph.length) break;
    start = Math.max(end - ASSISTANT_CHUNK_OVERLAP_CHARS, start + 1);
  }
  return chunks.filter(Boolean);
}

function pageChunks(page: AssistantDocumentPage): AssistantDocumentChunk[] {
  const content = normalizedText(page.ocr_text ?? "");
  if (!content) return [];
  const paragraphs = content.split(/\n{2,}/u).flatMap(splitLongParagraph);
  const chunks: AssistantDocumentChunk[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= ASSISTANT_CHUNK_MAX_CHARS) {
      current = candidate;
      continue;
    }
    if (current) chunks.push({
      document_page_id: page.id,
      page_number: page.page_number,
      chunk_index: chunks.length,
      section_context: page.section_context ?? null,
      content: current,
      content_sha256: contentHash(current),
    });
    current = paragraph;
  }
  if (current) {
    chunks.push({
      document_page_id: page.id,
      page_number: page.page_number,
      chunk_index: chunks.length,
      section_context: page.section_context ?? null,
      content: current,
      content_sha256: contentHash(current),
    });
  }
  return chunks;
}

export function chunkAssistantDocumentPages(
  pages: readonly AssistantDocumentPage[],
): AssistantDocumentChunk[] {
  return [...pages]
    .sort((left, right) => left.page_number - right.page_number)
    .flatMap(pageChunks);
}

export function hashAssistantSourcePages(
  pages: readonly AssistantDocumentPage[],
): string {
  const payload = [...pages]
    .sort((left, right) => left.page_number - right.page_number)
    .map((page) => `${page.page_number}:${normalizedText(page.ocr_text ?? "")}`)
    .join("\n");
  return contentHash(payload);
}
