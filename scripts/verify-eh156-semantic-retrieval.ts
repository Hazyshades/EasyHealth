import assert from "node:assert/strict";
import {
  ASSISTANT_CHUNK_MAX_CHARS,
  chunkAssistantDocumentPages,
  hashAssistantSourcePages,
} from "../src/lib/assistant/semantic-chunking";

const longText = `${"A clinically relevant sentence about a recorded consultation. ".repeat(32)}\n\nSecond section with a separate source paragraph.`;
const pages = [
  { id: "page-2", page_number: 2, ocr_text: "Page two text." },
  { id: "page-1", page_number: 1, ocr_text: longText },
  { id: "page-3", page_number: 3, ocr_text: "   " },
] as const;

const chunks = chunkAssistantDocumentPages(pages);
assert.ok(chunks.length >= 2);
assert.ok(chunks.every((chunk) => chunk.content.length <= ASSISTANT_CHUNK_MAX_CHARS));
assert.ok(chunks.every((chunk) => chunk.content.length > 0));
assert.deepEqual(
  chunks.map((chunk) => chunk.page_number),
  [...chunks.map((chunk) => chunk.page_number)].sort((left, right) => left - right),
);
assert.equal(chunks.some((chunk) => chunk.page_number === 3), false);
assert.equal(new Set(chunks.map((chunk) => chunk.content_sha256)).size, chunks.length);

const hashOne = hashAssistantSourcePages(pages);
const hashTwo = hashAssistantSourcePages([...pages].reverse());
assert.equal(hashOne, hashTwo);
assert.notEqual(hashOne, hashAssistantSourcePages([{ ...pages[0], ocr_text: "changed" }]));

console.log("EH-156 semantic retrieval verification passed");
