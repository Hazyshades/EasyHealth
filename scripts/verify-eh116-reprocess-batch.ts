/**
 * EH-116 static + unit verifier.
 *
 * - Confirms the batch service does not introduce a second observation
 *   or normalization revision writer.
 * - Confirms no HTTP admin surface was added under src/app/api/admin.
 * - Runs pure-function tests for the deterministic diff classifier and
 *   the release-capture module.
 *
 * The runtime imports are done via `await import(...)` after we plant
 * dummy env values. This is the module-loading-boundary exception in
 * the no-dynamic-import rule: `src/lib/env.ts` throws synchronously if
 * required env vars are missing, and the verifier must run without a
 * live Supabase configuration. The runtime module identity is otherwise
 * statically known — see the top-level `import type` declarations below.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { NormalizationRevision } from "../src/lib/documents/normalization-revisions";
import type { ExtractedBiomarkerWriterRow } from "../src/lib/documents/observation-normalization-writer";
import type * as ReprocessingModule from "../src/lib/registry-reprocessing";
import type * as BiomarkersModule from "../src/lib/biomarkers";
import type { ReprocessDiffClassification } from "../src/lib/registry-reprocessing";

// ── 0. Dummy env for pure-function tests ────────────────────────────────────

process.env.SUPABASE_SERVICE_ROLE_KEY ??= "verify-eh116-dummy";
process.env.OPENAI_API_KEY ??= "verify-eh116-dummy";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://verify-eh116.example";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "verify-eh116-dummy";

const repoRoot = path.resolve(__dirname, "..");

// ── 1. Static: no second writer, no admin HTTP surface ──────────────────────

function walkFiles(root: string, out: string[]): void {
  for (const entry of readdirSync(root)) {
    if (entry.startsWith(".") || entry === "node_modules" || entry === ".next") continue;
    const full = path.join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
}

const files: string[] = [];
walkFiles(path.join(repoRoot, "src"), files);
walkFiles(path.join(repoRoot, "scripts"), files);

const WRITER_RPC = /\.rpc\(\s*["']write_observation_normalization_revision_v2["']/;
const PROMOTE_RPC = /\.rpc\(\s*["']promote_observation_normalization_revision_v2["']/;
const OBSERVATIONS_INSERT =
  /\.from\(\s*["']observations["']\s*\)\s*\.\s*(insert|update)/;
const REVISIONS_INSERT =
  /\.from\(\s*["']observation_normalization_revisions["']\s*\)\s*\.\s*(insert|update)/;

const isEh116File = (file: string): boolean =>
  file.includes(`registry-reprocessing`) ||
  file.endsWith(`scripts${path.sep}reprocess-batch.ts`) ||
  file.endsWith(`scripts${path.sep}verify-eh116-reprocess-batch.ts`);

for (const file of files) {
  if (!isEh116File(file)) continue;
  const contents = readFileSync(file, "utf8");
  assert(
    !WRITER_RPC.test(contents),
    `${file}: EH-116 code must not call write_observation_normalization_revision_v2 directly; go through writeExtractedBiomarkerNormalization`
  );
  assert(
    !PROMOTE_RPC.test(contents),
    `${file}: EH-116 code must not call promote_observation_normalization_revision_v2 directly`
  );
  assert(
    !OBSERVATIONS_INSERT.test(contents),
    `${file}: EH-116 code must not insert/update observations directly`
  );
  assert(
    !REVISIONS_INSERT.test(contents),
    `${file}: EH-116 code must not insert/update observation_normalization_revisions directly`
  );
}

// No new admin HTTP surface.
const adminDir = path.join(repoRoot, "src", "app", "api", "admin");
let adminExists = false;
try {
  adminExists = statSync(adminDir).isDirectory();
} catch {
  adminExists = false;
}
assert(
  !adminExists,
  "EH-116 must not introduce src/app/api/admin/*; the admin surface is CLI-only in v1"
);

// User-facing per-document reprocess endpoint remains untouched.
const userReprocessPath = path.join(
  repoRoot,
  "src",
  "app",
  "api",
  "documents",
  "[id]",
  "reprocess",
  "route.ts"
);
const userReprocess = readFileSync(userReprocessPath, "utf8");
assert(
  !userReprocess.includes("registry-reprocessing"),
  "EH-116 must not couple the user reprocess endpoint to the operator batch service"
);

async function main(): Promise<void> {
  // Module-loading-boundary exception: env must be set before the module
  // graph resolves createAdminClient (see file docstring).
  const reprocessing = (await import("../src/lib/registry-reprocessing")) as typeof ReprocessingModule;
  const biomarkers = (await import("../src/lib/biomarkers")) as typeof BiomarkersModule;

  const {
    APPLY_ELIGIBLE_CLASSIFICATIONS,
    captureDeployedRelease,
    computeReprocessBatchDiff,
    DEFAULT_RESOLVER_RESULT_FILTER,
  } = reprocessing;
  const {
    MEASUREMENT_CATALOG_MANIFEST_RELEASE,
    MEASUREMENT_CATALOG_MANIFEST_VERSION,
    MEASUREMENT_RESOLVER_VERSION,
  } = biomarkers;

  // ── 2. Release capture matches runtime constants ────────────────────────

  const release = captureDeployedRelease();
  assert.equal(release.catalogManifestVersion, MEASUREMENT_CATALOG_MANIFEST_VERSION);
  assert.equal(
    release.catalogManifestDigest,
    MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest
  );
  assert.equal(release.resolverVersion, MEASUREMENT_RESOLVER_VERSION);
  assert.match(release.catalogManifestDigest, /^[0-9a-f]{64}$/);

  // ── 3. Default filter carries all four outcomes ─────────────────────────

  assert.deepEqual([...DEFAULT_RESOLVER_RESULT_FILTER].sort(), [
    "ambiguous",
    "partial",
    "resolved",
    "unmapped",
  ]);

  // ── 4. Apply-eligible classifications match the spec ────────────────────

  const applyEligible = Object.keys(APPLY_ELIGIBLE_CLASSIFICATIONS).sort() as ReprocessDiffClassification[];
  assert.deepEqual(applyEligible, ["identity_changed", "improved_resolution", "manual_selection_lost"]);

  // ── 5. Diff classifier: deterministic and correct on synthetic fixtures ──

  const baseRow: ExtractedBiomarkerWriterRow & {
    id: string;
    profile_id: string;
    document_id: string;
    observation_kind: "lab" | "instrumental";
  } = {
    id: "00000000-0000-0000-0000-000000000118",
    profile_id: "00000000-0000-0000-0000-000000000116",
    document_id: "00000000-0000-0000-0000-000000000117",
    biomarker_key: "glucose_serum_fasting_mmol_l",
    biomarker_name: "Glucose",
    raw_name: "Glucose",
    value_numeric: 90,
    value_text: "90",
    value_kind: "numeric",
    ordinal: null,
    unit: "mg/dL",
    raw_unit: "mg/dL",
    reference_range: null,
    raw_reference_range: null,
    section_context: "General chemistry",
    confidence: 0.95,
    specimen: "serum",
    modifier: null,
    source_page: 1,
    // #106: the fixture claims a serum specimen, so the line it represents has
    // to print it. Otherwise the specimen is stripped before resolution and
    // this row can no longer exercise the partial -> resolved diff.
    source_text: "Glucose, serum 90 mg/dL",
    bounding_box: null,
    reported_alt_value: null,
    reported_alt_unit: null,
    raw_value_text: "90 mg/dL",
    method: null,
    processing_version: "eh116-fixture",
    observation_kind: "lab",
  };

  const partialActive: NormalizationRevision = {
    id: "00000000-0000-0000-0000-000000000201",
    extracted_biomarker_id: "00000000-0000-0000-0000-000000000118",
    observation_id: "00000000-0000-0000-0000-000000000301",
    measurement_definition_key: null,
    analyte_key: null,
    resolver_result: "partial",
    mapping_confidence: 0.5,
    mapping_confidence_band: "medium",
    verification_status: "pending",
    verification_decided_at: null,
    verification_actor_type: null,
    verification_actor_id: null,
    is_active: true,
    mapping_change_classification: null,
    resolver_evidence: {
      version: 2,
      compatibilityPolicyVersion: "1",
      selectedCandidateKey: null,
      runnerUpCandidateKey: null,
      outcome: "partial",
      confidence: 0.5,
      candidates: [],
    },
  };

  const partialToResolvedDiff = computeReprocessBatchDiff({
    extractedRow: baseRow,
    activeRevision: partialActive,
    includeManualDecisions: false,
  });
  assert.equal(
    partialToResolvedDiff.diffClassification,
    "improved_resolution",
    `partial → resolved should be improved_resolution, got ${partialToResolvedDiff.diffClassification}`
  );
  assert.match(partialToResolvedDiff.next.inputEvidenceHash, /^[0-9a-f]{64}$/);

  const secondRun = computeReprocessBatchDiff({
    extractedRow: baseRow,
    activeRevision: partialActive,
    includeManualDecisions: false,
  });
  assert.equal(secondRun.diffClassification, partialToResolvedDiff.diffClassification);
  assert.equal(
    secondRun.next.inputEvidenceHash,
    partialToResolvedDiff.next.inputEvidenceHash,
    "identical input must produce identical next.inputEvidenceHash"
  );

  const userVerifiedActive: NormalizationRevision = {
    ...partialActive,
    id: "00000000-0000-0000-0000-000000000202",
    resolver_result: "resolved",
    measurement_definition_key: "glucose_serum_fasting_mmol_l",
    analyte_key: "glucose",
    verification_status: "user_verified",
    mapping_confidence: 0.9,
    mapping_confidence_band: "high",
    is_active: true,
  };

  const protectedDiff = computeReprocessBatchDiff({
    extractedRow: baseRow,
    activeRevision: userVerifiedActive,
    includeManualDecisions: false,
  });
  assert.equal(
    protectedDiff.diffClassification,
    "skipped_manual_decision",
    `default protection should skip user_verified, got ${protectedDiff.diffClassification}`
  );
  assert(
    protectedDiff.diffReasonCode.startsWith("default_protection_"),
    `skipped_manual_decision reason must start with default_protection_, got ${protectedDiff.diffReasonCode}`
  );

  const manuallyCorrectedActive: NormalizationRevision = {
    ...userVerifiedActive,
    id: "00000000-0000-0000-0000-000000000203",
    measurement_definition_key: "some_other_definition",
    analyte_key: "other_analyte",
    verification_status: "manually_corrected",
  };

  const overrideDiff = computeReprocessBatchDiff({
    extractedRow: baseRow,
    activeRevision: manuallyCorrectedActive,
    includeManualDecisions: true,
  });
  assert.equal(
    overrideDiff.diffClassification,
    "manual_selection_lost",
    `override + manually_corrected with identity change should be manual_selection_lost, got ${overrideDiff.diffClassification}`
  );

  // Unchanged fixture: pick a raw label the resolver certainly cannot map,
  // so both prior and next are unmapped with the same null identity.
  const unmappedRow = {
    ...baseRow,
    biomarker_key: "eh116-verifier-unknown-key",
    biomarker_name: "EH116 verifier unknown analyte",
    raw_name: "EH116 verifier unknown analyte",
  };
  const unmappedActive: NormalizationRevision = {
    ...partialActive,
    id: "00000000-0000-0000-0000-000000000204",
    resolver_result: "unmapped",
    measurement_definition_key: null,
    analyte_key: null,
    verification_status: "auto_verified",
    mapping_confidence: 0,
    mapping_confidence_band: "low",
  };
  const unchangedDiff = computeReprocessBatchDiff({
    extractedRow: unmappedRow,
    activeRevision: unmappedActive,
    includeManualDecisions: false,
  });
  assert.equal(
    unchangedDiff.diffClassification,
    "unchanged",
    `identical unmapped outcome should be unchanged, got ${unchangedDiff.diffClassification}`
  );

  const instrumentalRow = { ...baseRow, observation_kind: "instrumental" as const };
  assert.throws(
    () =>
      computeReprocessBatchDiff({
        extractedRow: instrumentalRow,
        activeRevision: null,
        includeManualDecisions: false,
      }),
    /only lab observations/,
    "instrumental rows must be rejected"
  );

  process.stdout.write("EH-116 verifier passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
