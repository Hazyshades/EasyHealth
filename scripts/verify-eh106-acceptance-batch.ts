import assert from "node:assert/strict";
import { acceptExtractedBiomarkerRows } from "../src/lib/documents/biomarker-acceptance-batch";

async function main() {
  const writerCalls: string[] = [];
  const committedSiblingIds: string[] = [];

  const result = await acceptExtractedBiomarkerRows({
    ids: ["stale-row", "eligible-row", "eligible-row", "missing-row"],
    rows: [{ id: "stale-row" }, { id: "eligible-row" }],
    writeRow: async (row) => {
      writerCalls.push(row.id);
      if (row.id === "stale-row") {
        throw new Error("stale_revision_conflict");
      }
      committedSiblingIds.push(row.id);
    },
  });

  assert.deepEqual(
    writerCalls,
    ["stale-row", "eligible-row"],
    "duplicate ids must not invoke the writer twice and a failed row must not stop its sibling"
  );
  assert.deepEqual(
    committedSiblingIds,
    ["eligible-row"],
    "an eligible sibling remains committed after a different row fails"
  );
  assert.deepEqual(result, {
    acceptedIds: ["eligible-row"],
    failures: [
      { id: "stale-row", error: "stale_revision_conflict" },
      { id: "missing-row", error: "Extracted biomarker not found" },
    ],
  });

  console.log("verify-eh106-acceptance-batch: passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
