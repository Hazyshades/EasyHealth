import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const migration = source("supabase/migrations/034_eh104_phase_b_enforcement.sql");
const writer = source("src/lib/documents/observation-normalization-writer.ts");
const acceptance = source("src/lib/documents/biomarker-acceptance.ts");
const acceptanceRoute = source("src/app/api/documents/[id]/biomarkers/accept/route.ts");
const correctionRoute = source("src/app/api/documents/[id]/biomarkers/route.ts");
const confirmationRoute = source(
  "src/app/api/documents/[id]/biomarkers/confirm-observations/route.ts"
);
const documentRoute = source("src/app/api/documents/[id]/route.ts");
const purgeHelper = source("src/lib/documents/laboratory-lineage-purge.ts");
const workerPipeline = source("worker/src/pipeline.ts");
const fixtures = source("supabase/tests/eh104_observation_resolution_verification.sql");
const preflightCli = source("scripts/eh104-preflight.ts");
const resetCli = source("scripts/eh104-phase-b-reset.ts");

assert.match(
  migration,
  /eh104_normalization_revision_verification_guard/,
  "Phase B migration must attach the revision verification guard"
);
assert.match(
  migration,
  /observations_normalization_revision_same_source_fk/,
  "Phase B migration must add the composite MATCH FULL FK"
);
assert.match(
  migration,
  /match full/i,
  "composite laboratory lineage FK must use MATCH FULL"
);
assert.match(
  migration,
  /deferrable initially deferred/i,
  "MATCH FULL must be DEFERRABLE INITIALLY DEFERRED for the atomic writer interim pair"
);
assert.match(
  migration,
  /purge_document_derived_laboratory_lineage/,
  "Phase B migration must create the laboratory purge RPC"
);
assert.match(
  migration,
  /drop function if exists public\.promote_observation_normalization_revision\(uuid, uuid, uuid\)/i,
  "Phase B migration must drop the legacy promotion RPC"
);
assert.match(
  migration,
  /document_extracted_biomarkers_resolver_result_check/,
  "Phase B migration must constrain extracted resolver_result"
);
assert.match(
  migration,
  /easyhealth\.purge_lineage/,
  "write-once and revision delete must honor purge context"
);

assert.match(
  writer,
  /isReviewedResolution/,
  "writer must compute reviewed maturity before persistence"
);
assert.match(
  writer,
  /p_reviewed_measurement_definition:\s*reviewedMeasurementDefinition/,
  "writer must pass reviewed maturity into the atomic RPC"
);
assert.match(
  writer,
  /\.rpc\(\s*["']write_observation_normalization_revision_v2["']/,
  "writer must use only the v2 atomic RPC"
);
assert.doesNotMatch(
  writer,
  /promote_observation_normalization_revision\s*\(/,
  "writer must not call the legacy promotion RPC"
);

assert.match(
  acceptance,
  /writeExtractedBiomarkerNormalization\(/,
  "acceptance module must use the atomic writer service"
);
assert.match(
  acceptanceRoute,
  /acceptExtractedBiomarkers\(/,
  "acceptance route must delegate to acceptExtractedBiomarkers"
);
assert.match(
  correctionRoute,
  /writeExtractedBiomarkerNormalization\(/,
  "correction route must use the atomic writer service"
);
assert.match(
  confirmationRoute,
  /writeExtractedBiomarkerNormalization\(/,
  "confirmation route must use the atomic writer service"
);

for (const [name, value] of [
  ["acceptance module", acceptance],
  ["acceptance route", acceptanceRoute],
  ["correction route", correctionRoute],
  ["confirmation route", confirmationRoute],
] as const) {
  assert.doesNotMatch(
    value,
    /promote_observation_normalization_revision(?:_v2)?\s*\(/,
    `${name} must not invoke promotion RPCs directly`
  );
}

assert.match(
  documentRoute,
  /purgeDocumentDerivedLaboratoryLineage/,
  "document DELETE must purge laboratory lineage before document removal"
);
assert.match(
  purgeHelper,
  /purge_document_derived_laboratory_lineage/,
  "purge helper must call the service-only RPC"
);

assert.match(
  workerPipeline,
  /update\(\{\s*is_current:\s*false/,
  "lab reprocess must supersede extracted rows rather than delete revision lineage"
);
assert.match(
  workerPipeline,
  /documentType !== "instrumental_report"/,
  "worker must keep instrumental snapshot replacement on the EH-105 path"
);

assert.match(
  fixtures,
  /legacy promotion RPC is dropped/,
  "pgTAP suite must assert legacy RPC absence"
);
assert.match(
  fixtures,
  /MATCH FULL rejects source-only laboratory half-link/,
  "pgTAP suite must cover half-link rejection"
);
assert.match(
  fixtures,
  /controlled purge succeeds/,
  "pgTAP suite must cover controlled purge"
);
assert.match(
  fixtures,
  /EH-106 atomic writer succeeds on a clean Phase B database/,
  "pgTAP suite must prove the atomic writer under Phase B"
);

assert.match(
  preflightCli,
  /process\.exitCode = 1/,
  "preflight CLI must fail closed on findings"
);
assert.match(
  preflightCli,
  /Persistent environments must abort/,
  "preflight CLI must document persistent abort policy"
);
assert.match(
  resetCli,
  /EH104_PHASE_B_DISPOSABLE/,
  "reset CLI must require disposable marker"
);
assert.match(
  resetCli,
  /EH104_PHASE_B_ALLOW_RESET/,
  "reset CLI must require explicit allow flag"
);
assert.match(
  resetCli,
  /p_confirm_disposable_reset:\s*true/,
  "reset CLI must pass explicit SQL confirmation only after env checks"
);

console.log("verify-eh104-phase-b-boundary: passed");
