import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "supabase/migrations/089_eh156_assistant_semantic_retrieval.sql",
  "supabase/migrations/090_eh159_assistant_operations.sql",
  "supabase/migrations/091_eh160_closed_beta_access.sql",
  "supabase/migrations/093_eh161_assistant_deletion_integration.sql",
  "supabase/migrations/094_eh156_atomic_semantic_publish.sql",
  "supabase/tests/eh156_assistant_semantic_retrieval.sql",
  "supabase/tests/eh159_assistant_operations.sql",
  "supabase/tests/eh161_assistant_deletion.sql",
  "docs/06-ai/closed-beta-release-checklist.md",
  "src/app/api/assistant/route.ts",
  "src/app/api/assistant/feedback/route.ts",
];

for (const relativePath of requiredFiles) {
  assert.equal(
    existsSync(join(root, relativePath)),
    true,
    `missing ${relativePath}`,
  );
}

const deletionMigration = readFileSync(
  join(
    root,
    "supabase/migrations/093_eh161_assistant_deletion_integration.sql",
  ),
  "utf8",
);
assert.match(deletionMigration, /eh161_purge_assistant_document_artifacts/u);
assert.match(deletionMigration, /assistant_document_chunks/u);
assert.match(deletionMigration, /assistant_reindex_jobs/u);
const semanticPublishMigration = readFileSync(
  join(root, "supabase/migrations/094_eh156_atomic_semantic_publish.sql"),
  "utf8",
);
assert.match(semanticPublishMigration, /publish_assistant_reindex_chunks/u);
assert.match(semanticPublishMigration, /write_generation/u);
assert.match(semanticPublishMigration, /assistant_reindex_source_stale/u);

const releaseChecklist = readFileSync(
  join(root, "docs/06-ai/closed-beta-release-checklist.md"),
  "utf8",
);
assert.match(releaseChecklist, /Backup and restore/u);
assert.match(releaseChecklist, /Rollback/u);
assert.match(releaseChecklist, /PENDING/u);

const productionGate = process.argv.includes("--strict-production");
const pendingGates = [
  "production embedding provider",
  "concurrency quota evidence",
  "backup and restore rehearsal",
  "rollback rehearsal",
  "incident contacts and alerts",
];

console.log("EH-161 local release-readiness contract passed");
for (const gate of pendingGates)
  console.log(`PENDING production evidence: ${gate}`);
if (productionGate) {
  throw new Error("EH-161 production gates remain PENDING");
}
