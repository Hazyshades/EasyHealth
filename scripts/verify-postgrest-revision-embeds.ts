import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Live PostgREST embedding proof for the PR 1 relationship cutover
// (OpenSpec change: fix-postgrest-normalization-revision-embeds).
//
// Runs the five actual consumer select strings against a real PostgREST
// endpoint on the dual-constraint transition schema, plus one old-hint read
// proving the compatibility alias resolves during rolling deployment.
//
// Requires a live Supabase stack (local `supabase start` or a target
// environment) with migrations through 035 applied.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || url.includes("ci-placeholder") || key.includes("ci-placeholder")) {
  console.error(
    "verify-postgrest-revision-embeds: requires live NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run `supabase start` locally or point at a target environment)."
  );
  process.exit(1);
}

// Test-only fault injection lets the integration contract exercise its
// `finally` cleanup path without weakening the normal success run.
const FORCE_FAILURE = process.env.POSTGREST_EMBEDS_FORCE_FAILURE === "1";


const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NEW_HINT = "observations_normalization_revision_same_source_fk";
const OLD_HINT = "observations_normalization_revision_fk";

// Exact runtime select strings (kept in sync by scripts/verify-postgrest-embed-hints.ts).
const CONSUMER_SELECTS: Record<string, string> = {
  "document-observations":
    `id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, source_extracted_biomarker_id, source_instrumental_measure_id, normalization_revision:observation_normalization_revisions!${NEW_HINT}(resolver_result, verification_status, measurement_definition_key, is_active, resolver_evidence)`,
  biomarkers:
    `id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, value_kind, value_text, ordinal, specimen, modifier, documents(id, original_filename), normalization_revision:observation_normalization_revisions!${NEW_HINT}(resolver_result, verification_status, measurement_definition_key, is_active, resolver_evidence)`,
  "health-profile":
    `measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, observation_kind, value_kind, value_text, ordinal, specimen, modifier, normalization_revision:observation_normalization_revisions!${NEW_HINT}(resolver_result, measurement_definition_key, is_active, resolver_evidence)`,
  reports:
    `name, analyte_key, measurement_definition_key, resolution_status, value, unit, ref_low, ref_high, observed_at, value_kind, value_text, observation_kind, documents(original_filename, observed_at), normalization_revision:observation_normalization_revisions!${NEW_HINT}(resolver_result, verification_status, measurement_definition_key, is_active, resolver_evidence)`,
  "structured-context":
    `id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, value_kind, value_text, document_id, documents(original_filename), normalization_revision:observation_normalization_revisions!${NEW_HINT}(resolver_result, verification_status, measurement_definition_key, is_active, resolver_evidence)`,
};

const OLD_HINT_SELECT = `id, normalization_revision:observation_normalization_revisions!${OLD_HINT}(resolver_result, is_active)`;

const profileId = randomUUID();
const documentId = randomUUID();
const biomarkerId = randomUUID();
const revisionId = randomUUID();
const observationId = randomUUID();

async function insertFixture(): Promise<void> {
  const steps: Array<[string, Record<string, unknown>]> = [
    ["profiles", { id: profileId, email: `postgrest-embeds-${profileId}@example.test` }],
    [
      "documents",
      {
        id: documentId,
        profile_id: profileId,
        storage_path: `postgrest-embeds/${documentId}.pdf`,
        original_filename: "postgrest-embeds.pdf",
        status: "completed",
      },
    ],
    [
      "document_extracted_biomarkers",
      {
        id: biomarkerId,
        document_id: documentId,
        profile_id: profileId,
        biomarker_name: "PostgREST embed fixture",
        status: "accepted",
        resolver_result: "resolved",
      },
    ],
    [
      "observation_normalization_revisions",
      {
        id: revisionId,
        extracted_biomarker_id: biomarkerId,
        input_evidence_hash: `postgrest-embeds-${revisionId}`,
        analyte_key: "postgrest_embed_fixture",
        measurement_definition_key: "glucose_serum",
        resolver_result: "resolved",
        mapping_confidence: 0.9,
        catalog_manifest_version: "postgrest-embeds",
        resolver_version: "postgrest-embeds",
        normalization_version: "postgrest-embeds",
        verification_status: "pending",
      },
    ],
    [
      "observations",
      {
        id: observationId,
        profile_id: profileId,
        document_id: documentId,
        source_extracted_biomarker_id: biomarkerId,
        normalization_revision_id: revisionId,
        name: "PostGREST embed observation",
        value: 1,
        unit: "mg/dL",
        observed_at: "2026-01-01",
        observation_kind: "lab",
        source_page: 1,
        source_text: "PostGREST embed observation 1 mg/dL",
      },
    ],
  ];

  for (const [table, row] of steps) {
    const { error } = await supabase.from(table).insert(row);
    assert.equal(error, null, `fixture insert into ${table} failed: ${error?.message}`);
  }
}

async function cleanupFixture(): Promise<void> {
  // Mirrors the owner DELETE route: controlled lineage purge, then document,
  // then profile. Every cleanup failure is retained and fails the contract
  // after all deletion attempts have run.
  const failures: string[] = [];
  const { error: purgeError } = await supabase.rpc(
    "purge_document_derived_laboratory_lineage",
    { p_document_id: documentId }
  );
  if (purgeError) failures.push(`lineage purge: ${purgeError.message}`);
  const { error: docError } = await supabase.from("documents").delete().eq("id", documentId);
  if (docError) failures.push(`document delete: ${docError.message}`);
  const { error: profileError } = await supabase.from("profiles").delete().eq("id", profileId);
  if (profileError) failures.push(`profile delete: ${profileError.message}`);
  if (failures.length > 0) {
    throw new Error(`fixture cleanup failed: ${failures.join("; ")}`);
  }

  const residueChecks: Array<[string, string]> = [
    ["profiles", profileId],
    ["documents", documentId],
    ["document_extracted_biomarkers", biomarkerId],
    ["observation_normalization_revisions", revisionId],
    ["observations", observationId],
  ];
  for (const [table, id] of residueChecks) {
    const { data, error } = await supabase.from(table).select("id").eq("id", id);
    assert.equal(error, null, `${table}: cleanup residue check failed: ${error?.message}`);
    assert.equal(data?.length, 0, `${table}: fixture residue remained after cleanup`);
  }
  console.log(`ok: fixture cleanup after ${FORCE_FAILURE ? "failure" : "success"} path`);
}


async function main(): Promise<void> {
  try {
    await insertFixture();
    if (FORCE_FAILURE) {
      throw new Error("forced failure after fixture insert for cleanup verification");
    }
    for (const [consumer, select] of Object.entries(CONSUMER_SELECTS)) {
      const { data, error } = await supabase
        .from("observations")
        .select(select)
        .eq("profile_id", profileId)
        .eq("observation_kind", "lab");
      assert.equal(error, null, `${consumer}: embedded read failed: ${error?.message}`);
      assert.equal(data?.length, 1, `${consumer}: expected exactly the fixture observation`);
      const row = data![0] as unknown as { normalization_revision: { resolver_result: string } | null };
      assert.ok(
        row.normalization_revision,
        `${consumer}: normalization_revision embed must resolve`
      );
      assert.equal(
        row.normalization_revision!.resolver_result,
        "resolved",
        `${consumer}: embedded revision projection changed`
      );
      console.log(`ok: ${consumer} embeds via ${NEW_HINT}`);
    }

    const { data: oldData, error: oldError } = await supabase
      .from("observations")
      .select(OLD_HINT_SELECT)
      .eq("id", observationId);
    assert.equal(
      oldError,
      null,
      `old-hint transition read failed (compatibility alias missing or schema cache stale): ${oldError?.message}`
    );
    assert.ok(
      (oldData?.[0] as unknown as { normalization_revision: unknown } | undefined)?.normalization_revision,
      "old-hint embed must resolve through the compatibility alias"
    );
    console.log(`ok: transition embed via ${OLD_HINT} (compatibility alias)`);
  } finally {
    await cleanupFixture();
  }
  console.log("verify-postgrest-revision-embeds: all five consumers plus alias transition passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
