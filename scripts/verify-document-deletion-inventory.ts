import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type InventoryEntry = {
  name: string;
  owner: string;
  evidence: string;
  cleanupBoundary: string;
  payloadClass: "PHI" | "metadata" | "mixed";
};

type Finding = {
  code: string;
  severity: "blocker" | "high";
  owner: string;
  evidence: string;
  requiredBoundary: string;
};

const files: Record<string, string> = {
  "document-delete-route": readFileSync(
    resolve(process.cwd(), "src/app/api/documents/[id]/route.ts"),
    "utf8",
  ),
  "document-deletion-status-route": readFileSync(
    resolve(process.cwd(), "src/app/api/documents/[id]/deletion/route.ts"),
    "utf8",
  ),
  "document-access": readFileSync(
    resolve(process.cwd(), "src/lib/documents/access.ts"),
    "utf8",
  ),
  "document-list": readFileSync(
    resolve(process.cwd(), "src/lib/documents/list.ts"),
    "utf8",
  ),
  "document-structured-context": readFileSync(
    resolve(process.cwd(), "src/lib/documents/structured-context.ts"),
    "utf8",
  ),
  "reports-service": readFileSync(
    resolve(process.cwd(), "src/lib/reports.ts"),
    "utf8",
  ),
  "reports-route": readFileSync(
    resolve(process.cwd(), "src/app/api/reports/route.ts"),
    "utf8",
  ),
  "report-delete-route": readFileSync(
    resolve(process.cwd(), "src/app/api/reports/[id]/route.ts"),
    "utf8",
  ),
  "synthesis-service": readFileSync(
    resolve(process.cwd(), "src/lib/holistic-synthesis.ts"),
    "utf8",
  ),
  "health-profile": readFileSync(
    resolve(process.cwd(), "src/app/api/health-profile/route.ts"),
    "utf8",
  ),
  "health-profile-snapshot": readFileSync(
    resolve(process.cwd(), "src/lib/health-profile-snapshot.ts"),
    "utf8",
  ),
  "biomarkers-route": readFileSync(
    resolve(process.cwd(), "src/app/api/biomarkers/route.ts"),
    "utf8",
  ),
  "timeline-route": readFileSync(
    resolve(process.cwd(), "src/app/api/timeline/route.ts"),
    "utf8",
  ),
  "upload-route": readFileSync(
    resolve(process.cwd(), "src/app/api/upload/route.ts"),
    "utf8",
  ),
  "upload-broker": readFileSync(
    resolve(process.cwd(), "src/lib/documents/upload-broker.ts"),
    "utf8",
  ),
  "worker-index": readFileSync(
    resolve(process.cwd(), "worker/src/index.ts"),
    "utf8",
  ),
  "worker-pipeline": readFileSync(
    resolve(process.cwd(), "worker/src/pipeline.ts"),
    "utf8",
  ),
  "worker-deletion-cleanup": readFileSync(
    resolve(process.cwd(), "worker/src/deletion-cleanup.ts"),
    "utf8",
  ),
  "worker-storage-orphan-sweeper": readFileSync(
    resolve(process.cwd(), "worker/src/storage-orphan-sweeper.ts"),
    "utf8",
  ),
  "worker-completion": readFileSync(
    resolve(process.cwd(), "worker/src/document-completion.ts"),
    "utf8",
  ),
  paths: readFileSync(
    resolve(process.cwd(), "src/lib/documents/paths.ts"),
    "utf8",
  ),
  "storage-config": readFileSync(
    resolve(process.cwd(), "src/lib/supabase/storage.ts"),
    "utf8",
  ),

  "migration-001": readFileSync(
    resolve(process.cwd(), "supabase/migrations/001_easyhealth.sql"),
    "utf8",
  ),
  "migration-004": readFileSync(
    resolve(process.cwd(), "supabase/migrations/004_reports.sql"),
    "utf8",
  ),
  "migration-012": readFileSync(
    resolve(process.cwd(), "supabase/migrations/012_document_intelligence.sql"),
    "utf8",
  ),
  "migration-013": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/013_typed_document_pipelines.sql",
    ),
    "utf8",
  ),
  "migration-014": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/014_typed_document_pipelines2.sql",
    ),
    "utf8",
  ),
  "migration-015": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/015_nebius_production_providers.sql",
    ),
    "utf8",
  ),
  "migration-020": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/020_measurement_normalization_revisions.sql",
    ),
    "utf8",
  ),
  "migration-023": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/023_measurement_resolution_shadow_events.sql",
    ),
    "utf8",
  ),
  "migration-032": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/032_eh105_instrumental_observation_lineage.sql",
    ),
    "utf8",
  ),
  "migration-036": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/036_pr2_document_processing_attempts.sql",
    ),
    "utf8",
  ),
  "migration-037": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/037_pr2_instrumental_atomic_publication.sql",
    ),
    "utf8",
  ),
  "migration-041": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/041_eh116_registry_reprocess_batches.sql",
    ),
    "utf8",
  ),
  "migration-051": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/051_eh121_observation_change_history.sql",
    ),
    "utf8",
  ),
  "migration-053": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/053_eh122_batch_verification_operations.sql",
    ),
    "utf8",
  ),
  "migration-055": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/055_eh123_assessment_recalculation.sql",
    ),
    "utf8",
  ),
  "migration-060": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/060_eh120_verification_transitions.sql",
    ),
    "utf8",
  ),
  "migration-067": readFileSync(
    resolve(process.cwd(), "supabase/migrations/067_eh163_mistral_ocr.sql"),
    "utf8",
  ),
  "migration-069": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/069_eh126_normalized_medical_events.sql",
    ),
    "utf8",
  ),
  "migration-070": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/070_eh130_duplicate_document_detection.sql",
    ),
    "utf8",
  ),
  "migration-026": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/026_remove_legacy_measurement_rollout.sql",
    ),
    "utf8",
  ),
  "migration-079": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/079_eh104_durable_processing_leases.sql",
    ),
    "utf8",
  ),
  "migration-080": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/080_eh104_document_deletion_operations.sql",
    ),
    "utf8",
  ),
  "migration-081": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/081_eh104_lease_fenced_publication.sql",
    ),
    "utf8",
  ),
  "migration-082": readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/082_eh104_atomic_report_synthesis_writers.sql",
    ),
    "utf8",
  ),
};

const tables: InventoryEntry[] = [
  {
    name: "documents",
    owner: "upload route + processing finalizers",
    evidence:
      "storage_path, original_storage_path, normalized_storage_path, thumbnail_storage_path, document_summary, processing_error, write_generation",
    cleanupBoundary: "tombstone RPC, storage inventory, final database purge",
    payloadClass: "PHI",
  },
  {
    name: "document_storage_write_intents + upload_tickets",
    owner: "application upload broker and worker artifact broker",
    evidence:
      "document/profile identifiers, server-authoritative bucket/object path, ticket hash, lease/generation, expiry state",
    cleanupBoundary:
      "intent completion/failure, expired orphan sweep, final document purge",
    payloadClass: "metadata",
  },
  {
    name: "document_deletion_operations",
    owner: "owner deletion route and cleanup worker",
    evidence:
      "document/profile identifiers, tombstone generation, status, retry code, manifest digest, receipt expiry",
    cleanupBoundary:
      "retained no-content receipt survives document purge until receipt expiry",
    payloadClass: "metadata",
  },
  {
    name: "document_pages",
    owner: "document worker",
    evidence:
      "preview_storage_path, ocr_text, ocr_json_storage_path, processing_attempt_id",
    cleanupBoundary: "attempt-aware final purge before document delete",
    payloadClass: "PHI",
  },
  {
    name: "document_processing_jobs + document_processing_attempts",
    owner: "worker claim/reclaim RPCs",
    evidence:
      "document/profile ownership, captured_write_generation, state, terminal_reason",
    cleanupBoundary: "cancel/quiesce, then purge child rows",
    payloadClass: "mixed",
  },
  {
    name: "document_extracted_biomarkers + observations",
    owner: "worker and normalization writers",
    evidence:
      "raw values/source_text, document_id, observation lineage, revision links",
    cleanupBoundary:
      "document-scoped lineage purge replaced by durable final purge",
    payloadClass: "PHI",
  },
  {
    name: "document_extracted_findings / finding_versions",
    owner: "instrumental publication finalizer",
    evidence: "finding_text, impression, source_text, snapshot_content_id",
    cleanupBoundary: "publication/content purge before document delete",
    payloadClass: "PHI",
  },
  {
    name: "document_extracted_clinical_notes",
    owner: "worker typed extraction",
    evidence:
      "chief complaint, history, diagnoses, recommendations, follow-up, processing_attempt_id",
    cleanupBoundary: "document-derived row purge",
    payloadClass: "PHI",
  },
  {
    name: "document_extracted_prescriptions + referrals",
    owner: "worker typed extraction",
    evidence: "medications, referral reason/summary, processing_attempt_id",
    cleanupBoundary: "document-derived row purge",
    payloadClass: "PHI",
  },
  {
    name: "instrumental publication/content/current pointer/measure lineage",
    owner: "PR2 prepare/finalize RPCs",
    evidence:
      "canonical_payload, summary_text, completion_payload, restrict FKs",
    cleanupBoundary: "explicit publication/content purge before root delete",
    payloadClass: "PHI",
  },
  {
    name: "observation_normalization_revisions + retired shadow rollout",
    owner: "normalization writers and registry reprocessing",
    evidence:
      "resolver_evidence/trace; measurement_resolution_shadow_events was removed by migration 026",
    cleanupBoundary: "revision purge; no active shadow relation remains",
    payloadClass: "mixed",
  },
  {
    name: "observation_change_events + assessment dependency rows",
    owner: "capture triggers and assessment worker",
    evidence:
      "document FK, hashes/enums, source_document_ids, assessment payload",
    cleanupBoundary:
      "document purge with explicit assessment invalidation policy",
    payloadClass: "mixed",
  },
  {
    name: "batch verification + EH-120 lifecycle + registry reprocess rows",
    owner: "document review and registry services",
    evidence:
      "document/extracted/revision FKs, expected snapshots, decision traces",
    cleanupBoundary:
      "operation/revision purge or approved non-PHI receipt policy",
    payloadClass: "mixed",
  },
  {
    name: "medical_events + medical_event_dates",
    owner: "document event trigger and worker date sync",
    evidence:
      "source_document_id cascade and document-linked observation projection",
    cleanupBoundary: "document-derived event/date purge",
    payloadClass: "metadata",
  },
  {
    name: "document_duplicate_candidates + duplicate audit events",
    owner: "duplicate detector and owner resolution route",
    evidence: "left/right document FKs plus weak audit document identifiers",
    cleanupBoundary:
      "cascade candidate rows and explicitly purge/detach audit metadata",
    payloadClass: "metadata",
  },
  {
    name: "ai_invocations",
    owner: "worker OCR/LLM tracing and report/synthesis tracing",
    evidence:
      "document_id nullable, error_code/error fields, profile-level report/synthesis rows",
    cleanupBoundary:
      "allowlisted non-PHI retention only after populated preflight; otherwise purge",
    payloadClass: "mixed",
  },
  {
    name: "reports + profile_health_synthesis + synthesis state",
    owner: "report route and holistic synthesis service",
    evidence:
      "content/summary_preview/synthesis_text and nullable/array source scopes",
    cleanupBoundary:
      "tombstone invalidation, whole-row purge, retained non-PHI receipt only",
    payloadClass: "PHI",
  },
];

const readers = [
  "src/app/api/documents/[id]/route.ts: owner detail, typed rows, pages, normalization, duplicates, heartbeat",
  "src/app/api/documents/[id]/file/route.ts + pages/[pageNumber]/route.ts + thumbnail/route.ts: signed download URL minting",
  "src/lib/documents/list.ts + src/app/api/documents/route.ts: list and thumbnail signed URLs",
  "src/app/api/documents/[id]/observations/route.ts + biomarkers/route.ts: document-scoped service-role reads",
  "src/app/api/biomarkers/route.ts: profile-wide observations and extracted-source projection",
  "src/app/api/timeline/route.ts: document events, findings, notes, prescriptions, referrals, observations",
  "src/lib/health-profile-snapshot.ts + src/app/api/health-profile/route.ts: assessment inputs and retained payload read",
  "src/lib/documents/structured-context.ts + src/lib/reports.ts: report/synthesis eligibility and context",
  "src/app/api/reports/route.ts + [id]/route.ts: persisted report list/detail/delete",
  "src/lib/holistic-synthesis.ts + src/app/api/health-profile/synthesis/route.ts: synthesis read/write",
  "src/lib/documents/duplicate-candidates.ts + duplicate resolution route: document pair metadata",
  "worker/src/index.ts + worker/src/pipeline.ts: queued jobs, attempts, source bytes, derived writes",
];

const storagePaths = [
  "owner original: ${profileId}/${documentId}/original.{pdf,jpg,png}",
  "generation-scoped thumbnail: generations/{generation}/attempts/{attemptId}/thumb.webp",
  "generation-scoped page preview: generations/{generation}/attempts/{attemptId}/pages/page-{n}.webp",
  "generation-scoped OCR full text: generations/{generation}/attempts/{attemptId}/ocr/fulltext.txt",
  "generation-scoped OCR page JSON: generations/{generation}/attempts/{attemptId}/ocr/page-{n}.json",
  "generation-scoped extraction JSON: generations/{generation}/attempts/{attemptId}/extraction/biomarkers.json",
  "recursive document prefix: ${profileId}/${documentId} with paginated nested listing",
  "database intent paths: document_storage_write_intents.object_path",
  "orphan recovery: expired pending/exchanged intents are failed then exact-path swept",
];

const evidenceChecks: ReadonlyArray<{
  key: string;
  pattern: RegExp;
  label: string;
}> = [
  {
    key: "migration-012",
    pattern:
      /document_pages[\s\S]*preview_storage_path[\s\S]*ocr_json_storage_path/,
    label: "generation-0 page storage columns",
  },
  {
    key: "migration-036",
    pattern: /write_generation[\s\S]*document_processing_attempts/,
    label: "shared content epoch and attempt authority",
  },
  {
    key: "migration-037",
    pattern:
      /on delete restrict[\s\S]*document_instrumental_publications[\s\S]*document_instrumental_current_publication/,
    label: "publication restrict-FK purge boundary",
  },
  {
    key: "migration-055",
    pattern:
      /health_profile_assessment_versions[\s\S]*payload[\s\S]*source_document_ids/,
    label: "assessment payload/source retention",
  },
  {
    key: "migration-060",
    pattern:
      /eh120_lifecycle_transition_operations[\s\S]*expected_source_snapshot/,
    label: "lifecycle operation metadata",
  },
  {
    key: "migration-069",
    pattern: /medical_events[\s\S]*source_document_id/,
    label: "medical event document ownership",
  },
  {
    key: "migration-070",
    pattern:
      /document_duplicate_candidates[\s\S]*left_document_id[\s\S]*right_document_id/,
    label: "duplicate candidate document ownership",
  },
  {
    key: "paths",
    pattern: /attempts\/\$\{processingAttemptId\}/,
    label: "generation-scoped path namespace",
  },
  {
    key: "storage-config",
    pattern: /public:\s*false[\s\S]*allowedMimeTypes/,
    label: "private lab-documents bucket configuration",
  },
  {
    key: "document-delete-route",
    pattern: /request_document_deletion[\s\S]*operationId[\s\S]*status:\s*202/,
    label: "owner deletion request returns retained operation receipt",
  },
  {
    key: "document-deletion-status-route",
    pattern:
      /document_deletion_operations[\s\S]*retryable[\s\S]*receiptExpiresAt/,
    label: "owner deletion status exposes retryable receipt state",
  },
  {
    key: "upload-route",
    pattern:
      /create_document_upload_reservation[\s\S]*issueStorageUploadTicket[\s\S]*exchangeStorageUploadTicket[\s\S]*verifyAndCompleteStorageIntent/,
    label: "owner upload uses reservation, ticket exchange, and verification",
  },
  {
    key: "upload-broker",
    pattern:
      /issue_storage_upload_ticket[\s\S]*consume_storage_upload_ticket[\s\S]*complete_storage_write_intent/,
    label: "upload broker uses one-time ticket lifecycle RPCs",
  },
  {
    key: "worker-pipeline",
    pattern: /register_storage_write_intent[\s\S]*upload-complete/,
    label: "worker artifacts use fenced intent and upload broker",
  },
  {
    key: "reports-route",
    pattern: /getDocumentWriteGenerations[\s\S]*create_validated_report/,
    label: "report writes use source-generation validation RPC",
  },
  {
    key: "report-delete-route",
    pattern: /delete_owner_report/,
    label: "owner report deletion uses named service writer",
  },
  {
    key: "synthesis-service",
    pattern:
      /getDocumentWriteGenerations[\s\S]*persist_profile_health_synthesis/,
    label: "synthesis writes use source-generation validation RPC",
  },
  {
    key: "worker-index",
    pattern:
      /lease_token[\s\S]*captured_write_generation[\s\S]*processOneDeletionOperation/,
    label:
      "worker runtime carries fenced processing leases and deletion cleanup",
  },
  {
    key: "worker-deletion-cleanup",
    pattern:
      /\.list\(prefix, \{ limit: STORAGE_PAGE_SIZE, offset \}\)[\s\S]*stable_empty_count[\s\S]*finalize_document_deletion/,
    label: "deletion cleanup recursively paginates and requires stable empties",
  },
  {
    key: "migration-026",
    pattern:
      /drop table if exists public\.measurement_resolution_shadow_events/,
    label: "retired shadow telemetry relation is absent by design",
  },
  {
    key: "worker-storage-orphan-sweeper",
    pattern:
      /fail_storage_write_intent[\s\S]*document_storage_write_intents[\s\S]*removeObjectIfPresent/,
    label: "expired write intents are fenced before exact-path orphan cleanup",
  },
  {
    key: "migration-079",
    pattern:
      /document_storage_write_intents[\s\S]*document_storage_upload_tickets[\s\S]*eh104_storage_intent_path/,
    label: "database storage intent and server path authority",
  },
  {
    key: "migration-079",
    pattern:
      /eh104_document_lifecycle_guard[\s\S]*eh104\.tombstone[\s\S]*eh104\.upload_complete[\s\S]*eh104\.upload_failed/,
    label: "database lifecycle/upload state mutation guard",
  },
  {
    key: "migration-079",
    pattern:
      /eh104_assert_document_active_for_write[\s\S]*eh104_document_mutation_guard[\s\S]*document_processing_attempts/,
    label: "database direct document mutation guard",
  },
  {
    key: "migration-080",
    pattern:
      /request_document_deletion[\s\S]*document_deletion_operations[\s\S]*finalize_document_deletion/,
    label: "database tombstone receipt and finalizer",
  },
  {
    key: "migration-080",
    pattern:
      /document_deletion_operations_receipt_expiry_idx[\s\S]*prune_expired_document_deletion_receipts/,
    label: "retained deletion receipt expiry and pruning",
  },
  {
    key: "migration-081",
    pattern:
      /eh104_assert_processing_lease[\s\S]*complete_document_processing_attempt[\s\S]*finalize_instrumental_publication/,
    label: "lease-fenced publication transitions",
  },
  {
    key: "migration-082",
    pattern:
      /create_validated_report[\s\S]*delete_owner_report[\s\S]*persist_profile_health_synthesis[\s\S]*ai_invocations_error_code_check/,
    label: "atomic report/synthesis writer and AI error allowlist",
  },
];

for (const check of evidenceChecks) {
  const source = files[check.key];
  assert.ok(source, `inventory source is missing: ${check.key}`);
  assert.match(
    source,
    check.pattern,
    `${check.label} is not represented by ${check.key}`,
  );
}

const findings: Finding[] = [
  {
    code: "DDEL-001",
    severity: "blocker",
    owner: "database/release owner",
    evidence:
      "The durable deletion contract is present in migrations 079-082, but no populated migrated target is available for live retention, storage, FK-order, and receipt verification.",
    requiredBoundary:
      "Apply migrations to a disposable populated target and run preflight:document-deletion-data before enabling owner deletion.",
  },
  {
    code: "DDEL-002",
    severity: "blocker",
    owner: "database/release owner",
    evidence:
      "This static inventory command does not inspect Docker, database, or storage; it produces no target-specific live retention, FK-order, storage, or receipt evidence.",
    requiredBoundary:
      "Run the EH-104 database contract and retained-data/storage preflight against the fully migrated target and preserve their redacted results.",
  },
  {
    code: "DDEL-003",
    severity: "high",
    owner: "worker/release owner",
    evidence:
      "The worker cleanup and orphan sweeper are implemented, but worker project verification remains dependent on the missing installed @mistralai/mistralai package in this checkout.",
    requiredBoundary:
      "Install the worker lockfile dependencies and run typecheck:worker before deployment.",
  },
];

const payloadBearingTables = tables.filter(
  (entry) => entry.payloadClass !== "metadata",
);
assert.equal(tables.length, 17);
assert.equal(readers.length, 12);
assert.equal(storagePaths.length, 9);
assert.ok(payloadBearingTables.length >= 10);
assert.ok(findings.every((finding) => finding.evidence.length > 0));

console.log(
  JSON.stringify(
    {
      schema: "eh104.durable-deletion.inventory.v1",
      source: "working-tree-static-review",
      tables,
      serviceRoleReaders: readers,
      storagePaths,
      findings,
      rollout: {
        status: "BLOCKED",
        reason:
          "Durable code is statically covered; live migrated-target preflight and worker dependency verification remain required before deletion enablement.",
      },
    },
    null,
    2,
  ),
);

if (findings.some((finding) => finding.severity === "blocker")) {
  process.exitCode = 1;
}
