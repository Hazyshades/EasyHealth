import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Static guard for the PR 1 PostgREST relationship cutover
// (OpenSpec change: fix-postgrest-normalization-revision-embeds).
//
// After code cutover, active runtime code must use only the composite
// same-source relationship hint. The temporary database alias and historical
// migrations are explicitly allowed to keep the old name.

const OLD_HINT = "observations_normalization_revision_fk";
const NEW_HINT = "observations_normalization_revision_same_source_fk";

const RUNTIME_ROOTS = ["src", "worker/src"];
const CONSUMERS = [
  "src/app/api/documents/[id]/observations/route.ts",
  "src/app/api/biomarkers/route.ts",
  "src/app/api/reports/route.ts",
  "src/lib/documents/structured-context.ts",
  "src/lib/health-profile-snapshot.ts",
];
const ALIAS_MIGRATION = "supabase/migrations/035_postgrest_normalization_revision_fk_alias.sql";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// The old name is not a substring of the new name, so occurrences of the old
// hint are exactly: total OLD matches minus matches that belong to NEW.
function countOldHint(text: string): number {
  const total = text.split(OLD_HINT).length - 1;
  const insideNew = text.split(NEW_HINT).length - 1;
  // NEW_HINT does not contain OLD_HINT ("_same_source_fk" vs "_fk" suffix),
  // so no subtraction is needed; keep the assertion to fail loudly if the
  // naming relationship ever changes.
  assert.ok(!NEW_HINT.includes(OLD_HINT), "hint naming invariant violated");
  void insideNew;
  return total;
}

const offenders: string[] = [];
for (const root of RUNTIME_ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    if (countOldHint(text) > 0) {
      offenders.push(file);
    }
  }
}
assert.deepEqual(
  offenders,
  [],
  `active runtime code must not use the removed PostgREST hint ${OLD_HINT}: ${offenders.join(", ")}`
);

for (const consumer of CONSUMERS) {
  const text = readFileSync(consumer, "utf8");
  assert.ok(
    text.includes(`!${NEW_HINT}(`),
    `${consumer} must embed observation_normalization_revisions via ${NEW_HINT}`
  );
}

const migration = readFileSync(ALIAS_MIGRATION, "utf8");
assert.match(
  migration,
  /add constraint observations_normalization_revision_fk/,
  "alias migration must add the old-name compatibility constraint"
);
assert.match(migration, /match full/, "alias must preserve MATCH FULL");
assert.match(
  migration,
  /deferrable initially deferred/,
  "alias must preserve deferrability"
);
assert.match(
  migration,
  /notify pgrst, 'reload schema'/,
  "alias migration must request a PostgREST schema-cache reload"
);
assert.doesNotMatch(
  migration,
  /drop constraint if exists observations_normalization_revision_fk/,
  "this change must not ship an executable alias-drop"
);

console.log("verify-postgrest-embed-hints: passed");
