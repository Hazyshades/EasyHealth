import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/documents/[id]/route.ts", "utf8");
const statusRoute = readFileSync(
  "src/app/api/documents/[id]/deletion/route.ts",
  "utf8",
);
const deletionMigration = readFileSync(
  "supabase/migrations/080_eh104_document_deletion_operations.sql",
  "utf8",
);

assert.match(
  route,
  /export async function DELETE/,
  "document route must expose DELETE",
);
assert.match(
  route,
  /getSessionProfileId/,
  "document DELETE must resolve the session profile",
);
assert.match(
  route,
  /request_document_deletion/,
  "document DELETE must request the durable tombstone",
);
assert.match(route, /status: 202/, "document DELETE must return 202 Accepted");
assert.doesNotMatch(
  route,
  /\.from\(["']documents["']\)\s*\.delete\(\)/,
  "document DELETE must not perform a synchronous table delete",
);
assert.match(
  statusRoute,
  /document_deletion_operations[\s\S]*receiptExpiresAt/,
  "deletion status must expose the retained operation receipt",
);
assert.match(
  deletionMigration,
  /create unique index if not exists document_deletion_operations_document_unique/,
  "deletion operations must be idempotent per document",
);
assert.match(
  deletionMigration,
  /finalize_document_deletion[\s\S]*delete from public\.documents/,
  "database finalizer must remove the root document after cleanup",
);

console.log("verify-eh104-document-delete: passed");
