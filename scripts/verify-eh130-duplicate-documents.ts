import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateMetadataSimilarity,
  DUPLICATE_METADATA_THRESHOLD,
  duplicateMatchLabel,
  isDuplicateDecision,
  normalizeDuplicateFilename,
} from "../src/lib/documents/duplicate-detection";

const matchingMetadata = {
  filename: "Lab Report 2026-01-14.PDF",
  fileSizeBytes: 42_000,
  mimeType: "application/pdf",
  documentType: "lab_result",
  observedAt: "2026-01-14",
  labName: "North Clinic",
};

const fullMatch = calculateMetadataSimilarity(matchingMetadata, {
  ...matchingMetadata,
  filename: "lab-report-2026-01-14.pdf",
});
assert.equal(fullMatch.score, 1);
assert.equal(fullMatch.qualifies, true);
assert.deepEqual(fullMatch.reasonCodes, [
  "filename",
  "file_size",
  "mime_type",
  "document_type",
  "observed_at",
  "lab_name",
]);

const thresholdMatch = calculateMetadataSimilarity(matchingMetadata, {
  ...matchingMetadata,
  mimeType: null,
  observedAt: null,
  labName: null,
});
assert.equal(thresholdMatch.score, DUPLICATE_METADATA_THRESHOLD);
assert.equal(thresholdMatch.qualifies, true);

const filenameOnly = calculateMetadataSimilarity(matchingMetadata, {
  ...matchingMetadata,
  fileSizeBytes: 7,
  mimeType: "image/png",
  documentType: "referral",
  observedAt: null,
  labName: null,
});
assert.equal(filenameOnly.score, 0.3);
assert.equal(filenameOnly.qualifies, false);

assert.equal(normalizeDuplicateFilename("Blood Report.PDF"), "blood report");
assert.equal(isDuplicateDecision("keep_both"), true);
assert.equal(isDuplicateDecision("archive_left"), true);
assert.equal(isDuplicateDecision("delete"), false);
assert.equal(duplicateMatchLabel("exact"), "Exact duplicate file");
assert.equal(duplicateMatchLabel("metadata"), "Possible duplicate");

const migration = readFileSync(
  "supabase/migrations/070_eh130_duplicate_document_detection.sql",
  "utf8",
);
assert.match(migration, /content_sha256/);
assert.match(migration, /document_duplicate_candidates/);
assert.match(migration, /documents_duplicate_detection_after_write/);
assert.match(migration, /eh130_resolve_duplicate_candidate/);
assert.match(migration, /archive_reason = coalesce\(archive_reason, 'duplicate_document'\)/);
assert.match(migration, /document_duplicate_audit_events_are_append_only|duplicate_audit_events_are_append_only/);
assert.match(migration, /document_duplicate_audit_candidate_action_unique/);
const completionSeam = readFileSync(
  "supabase/migrations/071_eh130_completion_hash_seam.sql",
  "utf8",
);
assert.match(completionSeam, /eh130_complete_document_processing_attempt_v1/);
assert.match(completionSeam, /eh130_finalize_instrumental_publication_v1/);
assert.match(completionSeam, /content_sha256/);
const privilegeMigration = readFileSync(
  "supabase/migrations/072_eh130_duplicate_privileges.sql",
  "utf8",
);
assert.match(privilegeMigration, /document_duplicate_candidates/);
assert.match(privilegeMigration, /to service_role/);

const auditDetachMigration = readFileSync(
  "supabase/migrations/073_eh130_audit_detach_guard.sql",
  "utf8",
);
assert.match(auditDetachMigration, /old\.candidate_id/);
assert.match(auditDetachMigration, /duplicate_audit_events_are_append_only/);

const uploadRoute = readFileSync("src/app/api/upload/route.ts", "utf8");
assert.match(uploadRoute, /createHash\("sha256"\)/);
assert.match(uploadRoute, /content_sha256: contentSha256/);

const workerPipeline = readFileSync("worker/src/pipeline.ts", "utf8");
assert.match(workerPipeline, /content_sha256: sourceSha256/);

const detailRoute = readFileSync("src/app/api/documents/[id]/route.ts", "utf8");
assert.match(detailRoute, /getDuplicateCandidatesForDocument/);
assert.match(detailRoute, /duplicate_candidates: duplicateCandidates/);

const resolutionRoute = readFileSync(
  "src/app/api/documents/duplicates/[candidateId]/resolve/route.ts",
  "utf8",
);
assert.match(resolutionRoute, /eh130_resolve_duplicate_candidate/);
assert.match(resolutionRoute, /isDuplicateDecision/);
assert.match(resolutionRoute, /status: 409/);

for (const path of [
  "src/app/api/documents/route.ts",
  "src/app/api/timeline/route.ts",
  "src/lib/health-profile-snapshot.ts",
  "src/lib/reports.ts",
  "src/lib/documents/structured-context.ts",
  "src/app/api/biomarkers/route.ts",
]) {
  assert.match(
    readFileSync(path, "utf8"),
    /archived_at/,
    `${path} must exclude archived sources`,
  );
}

const viewer = readFileSync("src/components/documents/duplicate-candidate-card.tsx", "utf8");
assert.match(viewer, /duplicateMatchLabel/);
assert.match(viewer, /Keep both/);
assert.match(viewer, /Confirm archive/);
assert.match(viewer, /not deleted/);
assert.match(viewer, /Duplicate document review/);

console.log("verify-eh130-duplicate-documents: all checks passed");
