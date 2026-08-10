/**
 * EH-121 observation change history.
 *
 * Covers the ledger read model (event-kind handling, the complete before/after
 * diff, actor attribution, version metadata, ordering and row indexing) and the
 * cross-layer seams that keep the ledger append-only and free of raw document
 * text.
 * Run with `pnpm test:eh121`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildObservationChangeEntries,
  buildObservationChangeEntry,
  indexObservationChangeEntries,
  isObservationChangeEventKind,
  type ObservationChangeEventRow,
} from "../src/lib/documents/observation-change-history";

const VIEWER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function event(
  overrides: Partial<ObservationChangeEventRow> = {},
): ObservationChangeEventRow {
  return {
    id: "event-1",
    event_kind: "mapping_corrected",
    origin: "capture",
    observation_id: "observation-1",
    extracted_biomarker_id: "extracted-1",
    source_revision_id: "revision-2",
    source_prior_revision_id: "revision-1",
    source_reprocess_row_id: null,
    actor_type: "user",
    actor_id: VIEWER,
    correction_reason: "Reported specimen is serum",
    prior_measurement_definition_key: "glucose_plasma_fasting",
    prior_analyte_key: "glucose",
    prior_resolver_result: "ambiguous",
    prior_verification_status: "pending",
    prior_mapping_confidence_band: "low",
    prior_input_evidence_hash: HASH_A,
    next_measurement_definition_key: "glucose_serum_fasting",
    next_analyte_key: "glucose",
    next_resolver_result: "resolved",
    next_verification_status: "manually_corrected",
    next_mapping_confidence_band: "high",
    next_input_evidence_hash: HASH_B,
    next_mapping_change_classification: "corrective",
    catalog_manifest_version: "2026.08.01",
    catalog_manifest_digest: "digest-1",
    resolver_version: "resolver-3",
    normalization_version: "norm-2",
    extraction_version: "extract-7",
    occurred_at: "2026-08-09T10:00:00.000Z",
    created_at: "2026-08-09T10:00:00.000Z",
    ...overrides,
  };
}

// ── Event-kind recognition ───────────────────────────────────────────────────

for (const kind of [
  "observation_accepted",
  "mapping_corrected",
  "correction_reverted",
  "verification_changed",
  "extraction_superseded",
  "reprocess_applied",
]) {
  assert.ok(
    isObservationChangeEventKind(kind),
    `${kind} is a recognized EH-121 event kind`,
  );
}
assert.equal(
  isObservationChangeEventKind("mapping_deleted"),
  false,
  "an unknown event kind is not recognized",
);
assert.equal(
  buildObservationChangeEntry(event({ event_kind: "mapping_deleted" })),
  null,
  "a row with an unknown event kind produces no entry rather than a broken one",
);

// ── The diff is complete regardless of kind ──────────────────────────────────

const corrected = buildObservationChangeEntry(event(), {
  viewerProfileId: VIEWER,
});
assert.ok(corrected, "a correction row projects to an entry");
assert.equal(corrected.kind, "mapping_corrected", "kind is carried through");
assert.equal(
  corrected.headline,
  "Measurement mapping corrected",
  "the headline names the change in plain words",
);
assert.deepEqual(
  corrected.fields.map((field) => field.field),
  ["measurement", "outcome", "verification", "confidence"],
  "a correction that also moved verification reports both axes in one entry",
);
assert.deepEqual(
  corrected.fields.find((field) => field.field === "measurement"),
  {
    field: "measurement",
    label: "Measurement",
    from: "glucose_plasma_fasting",
    to: "glucose_serum_fasting",
  },
  "the measurement diff names the previous and the new definition key",
);
assert.deepEqual(
  corrected.fields.find((field) => field.field === "verification"),
  {
    field: "verification",
    label: "Verification",
    from: "Not verified yet",
    to: "Corrected by you",
  },
  "verification uses the same wording as the review chips",
);
assert.equal(
  corrected.fields.some((field) => field.field === "analyte"),
  false,
  "an axis that did not move is omitted from the diff",
);
assert.equal(
  corrected.reason,
  "Reported specimen is serum",
  "the recorded reason is surfaced",
);
assert.deepEqual(
  corrected.versions,
  {
    catalogManifestVersion: "2026.08.01",
    catalogManifestDigest: "digest-1",
    resolverVersion: "resolver-3",
    normalizationVersion: "norm-2",
    extractionVersion: "extract-7",
  },
  "the processing contract in force is pinned on the entry",
);
assert.equal(
  corrected.priorEvidenceHash,
  HASH_A,
  "evidence is referenced by hash rather than reproduced",
);
assert.equal(
  corrected.nextEvidenceHash,
  HASH_B,
  "the resulting evidence hash is referenced too",
);

// ── First acceptance has null prior values ───────────────────────────────────

const accepted = buildObservationChangeEntry(
  event({
    id: "event-accept",
    event_kind: "observation_accepted",
    source_prior_revision_id: null,
    correction_reason: null,
    prior_measurement_definition_key: null,
    prior_analyte_key: null,
    prior_resolver_result: null,
    prior_verification_status: null,
    prior_mapping_confidence_band: null,
    prior_input_evidence_hash: null,
  }),
  { viewerProfileId: VIEWER },
);
assert.ok(accepted, "an acceptance row projects to an entry");
assert.equal(accepted.headline, "Result accepted", "acceptance is named plainly");
assert.deepEqual(
  accepted.fields.map((field) => [field.field, field.from]),
  [
    ["measurement", null],
    ["analyte", null],
    ["outcome", null],
    ["verification", null],
    ["confidence", null],
  ],
  "a first acceptance reports every axis with a null prior value",
);
assert.equal(accepted.reason, null, "an absent reason stays absent");

// ── Actor attribution ────────────────────────────────────────────────────────

assert.equal(corrected.actorLabel, "You", "the viewer's own change reads as You");
assert.equal(
  buildObservationChangeEntry(event({ actor_id: OTHER }), {
    viewerProfileId: VIEWER,
  })?.actorLabel,
  "Another reviewer",
  "a change by a different profile is not attributed to the viewer",
);
const automatic = buildObservationChangeEntry(
  event({ actor_type: "system", actor_id: null }),
  { viewerProfileId: VIEWER },
);
assert.equal(automatic?.actorType, "system", "a system change has no user actor");
assert.equal(automatic?.actorId, null, "a system change carries no profile id");
assert.equal(automatic?.actorLabel, "Automatic", "a system change reads as Automatic");
assert.equal(
  buildObservationChangeEntry(event({ actor_type: "user", actor_id: null }))
    ?.actorType,
  "system",
  "a user actor with no profile id degrades to system rather than claiming a person",
);

// ── Reconstructed rows are distinguishable ───────────────────────────────────

const reconstructed = buildObservationChangeEntry(event({ origin: "backfill" }));
assert.equal(reconstructed?.origin, "backfill", "the backfill origin survives");
assert.equal(
  reconstructed?.reconstructed,
  true,
  "a reconstructed entry is flagged so the UI can say so",
);
assert.equal(
  buildObservationChangeEntry(event())?.reconstructed,
  false,
  "a live capture is not flagged as reconstructed",
);

// ── Ordering and indexing ────────────────────────────────────────────────────

const ordered = buildObservationChangeEntries([
  event({ id: "old", occurred_at: "2026-08-01T00:00:00.000Z" }),
  event({
    id: "tie-early",
    occurred_at: "2026-08-09T10:00:00.000Z",
    created_at: "2026-08-09T10:00:00.000Z",
  }),
  event({
    id: "tie-late",
    occurred_at: "2026-08-09T10:00:00.000Z",
    created_at: "2026-08-09T11:00:00.000Z",
  }),
  event({ id: "unknown", event_kind: "not_a_kind" }),
]);
assert.deepEqual(
  ordered.map((entry) => entry.id),
  ["tie-late", "tie-early", "old"],
  "entries are newest first, ties broken by capture time, unknown kinds dropped",
);

const indexed = indexObservationChangeEntries(ordered);
assert.equal(
  indexed.get("observation-1")?.length,
  3,
  "entries are reachable by observation id",
);
assert.equal(
  indexed.get("extracted-1")?.length,
  3,
  "entries are reachable by extracted row id",
);
assert.equal(
  indexed.get("missing-row"),
  undefined,
  "a row with no history is absent from the index rather than holding an empty list",
);
assert.equal(
  indexObservationChangeEntries(
    buildObservationChangeEntries([
      event({ id: "no-observation", observation_id: null }),
    ]),
  ).get("extracted-1")?.length,
  1,
  "a pre-promotion event is still reachable by its extracted row",
);

// ── Migration seams ──────────────────────────────────────────────────────────

const migration = readFileSync(
  "supabase/migrations/047_eh121_observation_change_history.sql",
  "utf8",
);

assert.match(
  migration,
  /grant select, insert on public\.observation_change_events to service_role;/,
  "service_role holds only select and insert on the ledger",
);
assert.doesNotMatch(
  migration,
  /grant [^;]*update[^;]*on public\.observation_change_events/,
  "no role is granted update on the ledger",
);
assert.doesNotMatch(
  migration,
  /grant [^;]*delete[^;]*on public\.observation_change_events/,
  "no role is granted delete on the ledger",
);
assert.match(
  migration,
  /revoke all on public\.observation_change_events from public, anon, authenticated;/,
  "anon and authenticated hold nothing on the ledger",
);
assert.match(
  migration,
  /create trigger observation_change_events_append_only\s+before update or delete on public\.observation_change_events/,
  "the append-only guard covers both update and delete",
);
assert.match(
  migration,
  /raise exception using message = 'observation_change_events_append_only'/,
  "the guard raises a named append-only error",
);

for (const rawColumn of [
  "raw_name",
  "raw_value_text",
  "raw_reference_text",
  "raw_unit",
  "source_text",
  "bounding_box",
  "resolver_decision_trace",
  "resolver_evidence",
]) {
  const declaration = new RegExp(`^\\s{2}${rawColumn}\\s`, "m");
  assert.doesNotMatch(
    migration,
    declaration,
    `the ledger declares no ${rawColumn} column, so raw document text is not duplicated`,
  );
}

assert.match(
  migration,
  /check \(prior_input_evidence_hash is null or prior_input_evidence_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/,
  "the prior evidence hash shape is enforced, not merely conventional",
);
assert.match(
  migration,
  /check \(next_input_evidence_hash is null or next_input_evidence_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/,
  "the next evidence hash shape is enforced, not merely conventional",
);

for (const trigger of [
  /create trigger eh121_capture_revision_change\s+after insert or update on public\.observation_normalization_revisions/,
  /create trigger eh121_capture_extraction_supersession\s+after update of is_current on public\.document_extracted_biomarkers/,
  /create trigger eh121_capture_reprocess_apply\s+after update on public\.registry_reprocess_batch_rows/,
]) {
  assert.match(migration, trigger, "each append-only source has a capture trigger");
}
assert.match(
  migration,
  /when p_reversal_of_revision_id is not null then 'correction_reverted'/,
  "a reversal outranks every other classification",
);
assert.match(
  migration,
  /when p_prior_revision_id is null then 'observation_accepted'/,
  "a revision with no predecessor is an acceptance",
);
assert.match(
  migration,
  /else 'verification_changed'/,
  "an unchanged mapping falls through to a verification change",
);
assert.equal(
  (migration.match(/on conflict do nothing/g) ?? []).length >= 6,
  true,
  "every capture and backfill statement is idempotent",
);
assert.match(
  migration,
  /origin = 'backfill'|'backfill',/,
  "the backfill marks the rows it reconstructs",
);
assert.match(migration, /notify pgrst, 'reload schema';/, "PostgREST reloads its schema");

// ── Endpoint and UI seams ────────────────────────────────────────────────────

const route = readFileSync(
  "src/app/api/documents/[id]/observation-history/route.ts",
  "utf8",
);
assert.match(route, /getSessionProfileId\(\)/, "the endpoint requires a session");
assert.match(
  route,
  /assertDocumentOwner\(profileId, id\)/,
  "the endpoint answers not found for a document the caller does not own",
);
assert.match(
  route,
  /limit must be an integer between 1 and/,
  "an out-of-range limit is rejected rather than clamped",
);
assert.match(
  route,
  /viewerProfileId: profileId/,
  "actor attribution is resolved against the caller",
);

const reader = readFileSync("src/lib/documents/observation-change-events.ts", "utf8");
assert.match(
  reader,
  /\.eq\("profile_id", query\.profileId\)/,
  "the reader scopes every query to the owning profile",
);
assert.doesNotMatch(
  reader,
  /raw_value_text|source_text|resolver_decision_trace/,
  "the reader selects no column that could carry document text",
);

const viewer = readFileSync("src/components/documents/document-viewer.tsx", "utf8");
assert.equal(
  (viewer.match(/<ObservationChangeHistoryPanel/g) ?? []).length,
  2,
  "history is wired into both the extracted-review and the observations-fallback branch",
);
assert.match(
  viewer,
  /\}, \[documentId, extracted, observations\]\);/,
  "history refreshes with the review payload every mutation reloads",
);

const row = readFileSync(
  "src/components/documents/review/observation-review-row.tsx",
  "utf8",
);
assert.match(row, /history\?: ReactNode;/, "the review row exposes a history slot");

const panel = readFileSync(
  "src/components/documents/review/observation-change-history-panel.tsx",
  "utf8",
);
assert.match(
  panel,
  /No changes recorded for this result yet\./,
  "a row with no history states so instead of rendering an empty control",
);
assert.match(
  panel,
  /<details/,
  "history stays collapsed so the bounded review list stays scannable",
);

console.log("verify-eh121-observation-change-history: all checks passed");
