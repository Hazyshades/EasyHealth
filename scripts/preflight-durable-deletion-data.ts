import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type SourceRow = {
  document_ids?: string[] | null;
  actual_source_document_ids?: string[] | null;
  source_document_ids?: string[] | null;
  source_scope_known?: boolean;
};

type ReportRow = {
  id: string;
  actual_source_document_ids: string[] | null;
  source_scope_known: boolean;
};

type SynthesisRow = {
  profile_id: string;
  source_document_ids: string[] | null;
};

type DocumentRow = {
  id: string;
};

type AiInvocationRow = {
  id: string;
  document_id: string | null;
  error_code: string | null;
  request_id: string | null;
  input_bytes: number | null;
  pages_processed: number | null;
};

type ObservationChangeEventRow = {
  id: string;
  correction_reason: string | null;
};

type RegistryReprocessRow = {
  id: string;
  next_resolver_decision_trace: unknown;
};

type LifecycleOperationRow = {
  request_hash: string;
  result: unknown;
};

type AssessmentJobRow = {
  id: string;
  last_error_message: string | null;
};

type SourceClassification = {
  exactSourceRows: SourceRow[];
  sourceUnknownRows: SourceRow[];
  malformedSourceRows: SourceRow[];
  referencedDocumentIds: string[];
};

type Finding = {
  code: string;
  severity: "blocker" | "high";
  owner: string;
  evidence: string;
  requiredBoundary: string;
};

const PAGE_SIZE = 500;
const SAFE_AI_ERROR_CODES = new Set([
  "ocr_provider_unavailable",
  "ocr_timeout",
  "ocr_invalid_response",
  "ocr_input_rejected",
  "ocr_page_mismatch",
  "llm_timeout",
  "llm_rate_limited",
  "llm_auth_failed",
  "llm_invalid_response",
  "llm_input_rejected",
  "llm_provider_unavailable",
]);

async function readAllRows<T>(
  client: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;

    offset += PAGE_SIZE;
  }
}

function classifySourceRows(
  rows: SourceRow[],
  key: "document_ids" | "actual_source_document_ids" | "source_document_ids",
): SourceClassification {
  const exactSourceRows: SourceRow[] = [];
  const sourceUnknownRows: SourceRow[] = [];
  const malformedSourceRows: SourceRow[] = [];
  const referencedDocumentIds = new Set<string>();

  for (const row of rows) {
    if (row.source_scope_known === false) {
      sourceUnknownRows.push(row);
      continue;
    }
    const value = row[key];
    if (value === null || value === undefined || value.length === 0) {
      sourceUnknownRows.push(row);
      continue;
    }
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== "string")
    ) {
      malformedSourceRows.push(row);
      sourceUnknownRows.push(row);
      continue;
    }

    exactSourceRows.push(row);
    for (const documentId of value) referencedDocumentIds.add(documentId);
  }

  return {
    exactSourceRows,
    sourceUnknownRows,
    malformedSourceRows,
    referencedDocumentIds: [...referencedDocumentIds],
  };
}

function isNonEmptyJson(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function countUnknownSourceReferences(
  rows: SourceRow[],
  key: "document_ids" | "actual_source_document_ids" | "source_document_ids",
  knownDocumentIds: Set<string>,
): number {
  let count = 0;

  for (const row of rows) {
    const value = row[key];
    if (
      !Array.isArray(value) ||
      value.some((documentId) => !knownDocumentIds.has(documentId))
    ) {
      count += 1;
    }
  }

  return count;
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    const finding: Finding = {
      code: "DDEL-DATA-001",
      severity: "blocker",
      owner: "database/release owner",
      evidence:
        "The read-only retained-data preflight could not initialize its service-role client on this workstation.",
      requiredBoundary:
        "Run this command with the target Supabase URL and service-role credentials, without mutating the target.",
    };
    console.log(
      JSON.stringify(
        {
          schema: "eh104.durable-deletion.retained-data.v1",
          status: "BLOCKED",
          findings: [finding],
          policy: {
            noMutation: true,
            phidataNeverPrinted: true,
            reportAction:
              "invalidate or purge the whole report row; never redact only content fields",
            sourceUnknownAction:
              "invalidate every report whose actual_source_document_ids is empty or source_scope_known is false before document purge",
          },
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [
      reportRows,
      synthesisRows,
      documentRows,
      aiRows,
      changeRows,
      registryRows,
      lifecycleRows,
      assessmentJobRows,
    ] = await Promise.all([
      readAllRows<ReportRow>(
        client,
        "reports",
        "id,actual_source_document_ids,source_scope_known",
      ),
      readAllRows<SynthesisRow>(
        client,
        "profile_health_synthesis",
        "profile_id,source_document_ids",
      ),
      readAllRows<DocumentRow>(client, "documents", "id"),
      readAllRows<AiInvocationRow>(
        client,
        "ai_invocations",
        "id,document_id,error_code,request_id,input_bytes,pages_processed",
      ),
      readAllRows<ObservationChangeEventRow>(
        client,
        "observation_change_events",
        "id,correction_reason",
      ),
      readAllRows<RegistryReprocessRow>(
        client,
        "registry_reprocess_batch_rows",
        "id,next_resolver_decision_trace",
      ),
      readAllRows<LifecycleOperationRow>(
        client,
        "eh120_lifecycle_transition_operations",
        "request_hash,result",
      ),
      readAllRows<AssessmentJobRow>(
        client,
        "assessment_recalculation_jobs",
        "id,last_error_message",
      ),
    ]);

    const knownDocumentIds = new Set(documentRows.map((row) => row.id));
    const reportSources = classifySourceRows(
      reportRows,
      "actual_source_document_ids",
    );
    const synthesisSources = classifySourceRows(
      synthesisRows,
      "source_document_ids",
    );
    const findings: Finding[] = [];
    let metadataPayloadRows = 0;

    const reportUnknownReferenceRows = countUnknownSourceReferences(
      reportSources.exactSourceRows,
      "actual_source_document_ids",
      knownDocumentIds,
    );
    const synthesisUnknownReferenceRows = countUnknownSourceReferences(
      synthesisSources.exactSourceRows,
      "source_document_ids",
      knownDocumentIds,
    );

    if (
      reportSources.sourceUnknownRows.length > 0 ||
      reportSources.malformedSourceRows.length > 0
    ) {
      findings.push({
        code: "DDEL-DATA-002",
        severity: "blocker",
        owner: "report invalidation owner",
        evidence:
          "Persisted reports include source-unknown or malformed document scope; report content and summary_preview are PHI-bearing columns.",
        requiredBoundary:
          "Invalidate and purge the whole source-unknown report row before deleting any referenced document; retain only an approved non-PHI receipt.",
      });
    }
    if (reportUnknownReferenceRows > 0) {
      findings.push({
        code: "DDEL-DATA-003",
        severity: "blocker",
        owner: "report invalidation owner",
        evidence:
          "At least one exact-source report references a document absent from the current documents relation.",
        requiredBoundary:
          "Resolve the retained-data discrepancy before deletion enablement; do not infer source ownership from report content.",
      });
    }
    if (
      synthesisUnknownReferenceRows > 0 ||
      synthesisSources.malformedSourceRows.length > 0
    ) {
      findings.push({
        code: "DDEL-DATA-004",
        severity: "blocker",
        owner: "synthesis invalidation owner",
        evidence:
          "Persisted profile synthesis rows include unknown, malformed, or stale source-document scope.",
        requiredBoundary:
          "Invalidate the synthesis state and purge the whole synthesis row before source-document deletion.",
      });
    }

    let unsafeAiErrorRows = 0;
    for (const row of aiRows) {
      if (row.error_code !== null && !SAFE_AI_ERROR_CODES.has(row.error_code)) {
        unsafeAiErrorRows += 1;
      }
    }
    if (unsafeAiErrorRows > 0) {
      findings.push({
        code: "DDEL-DATA-005",
        severity: "blocker",
        owner: "AI telemetry owner",
        evidence:
          "ai_invocations contains error_code values outside the privacy-safe allowlist; raw provider error text cannot be retained as receipt metadata.",
        requiredBoundary:
          "Map every error to an allowlisted code or purge the invocation row; never copy raw error text into a deletion operation.",
      });
    }

    for (const row of changeRows) {
      if (row.correction_reason !== null) metadataPayloadRows += 1;
    }
    for (const row of registryRows) {
      if (isNonEmptyJson(row.next_resolver_decision_trace))
        metadataPayloadRows += 1;
    }
    for (const row of lifecycleRows) {
      if (isNonEmptyJson(row.result)) metadataPayloadRows += 1;
    }
    for (const row of assessmentJobRows) {
      if (row.last_error_message !== null) metadataPayloadRows += 1;
    }
    if (metadataPayloadRows > 0) {
      findings.push({
        code: "DDEL-DATA-006",
        severity: "blocker",
        owner: "retained metadata owner",
        evidence:
          "A proposed non-PHI receipt/audit surface contains free text or non-empty JSON payload fields.",
        requiredBoundary:
          "Classify the field as PHI and purge it with the source, or replace it with an allowlisted code/hash/identifier before rollout.",
      });
    }

    const output = {
      schema: "eh104.durable-deletion.retained-data.v1",
      status: findings.length === 0 ? "READY_FOR_SCHEMA_PREFLIGHT" : "BLOCKED",
      noMutation: true,
      phidataNeverPrinted: true,
      reports: {
        totalRows: reportRows.length,
        exactSourceRows: reportSources.exactSourceRows.length,
        sourceUnknownRows: reportSources.sourceUnknownRows.length,
        malformedSourceRows: reportSources.malformedSourceRows.length,
        staleReferenceRows: reportUnknownReferenceRows,
        payloadColumns: ["content", "summary_preview"],
        payloadBearingRows: reportRows.length,
        invalidation: "whole-row",
      },
      synthesis: {
        totalRows: synthesisRows.length,
        exactSourceRows: synthesisSources.exactSourceRows.length,
        sourceUnknownRows: synthesisSources.sourceUnknownRows.length,
        malformedSourceRows: synthesisSources.malformedSourceRows.length,
        staleReferenceRows: synthesisUnknownReferenceRows,
        payloadColumns: ["synthesis_text"],
        payloadBearingRows: synthesisRows.length,
        invalidation: "state plus whole-row",
      },
      telemetry: {
        aiInvocationRows: aiRows.length,
        documentLinkedAiInvocationRows: aiRows.filter(
          (row) => row.document_id !== null,
        ).length,
        unsafeAiErrorRows,
        privacySafeErrorCodeAllowlist: [...SAFE_AI_ERROR_CODES],
      },
      retainedMetadata: {
        measurementShadowRows: 0,
        observationChangeRows: changeRows.length,
        registryReprocessRows: registryRows.length,
        lifecycleOperationRows: lifecycleRows.length,
        assessmentJobRows: assessmentJobRows.length,
        payloadBearingRows: metadataPayloadRows,
        policy:
          "fail closed; only identifiers, enums, hashes, and allowlisted codes may survive",
      },
      findings,
    };

    console.log(JSON.stringify(output, null, 2));
    if (findings.length > 0) process.exitCode = 1;
  } catch {
    const finding: Finding = {
      code: "DDEL-DATA-007",
      severity: "blocker",
      owner: "database/release owner",
      evidence:
        "The read-only retained-data preflight could not complete all required table reads against the target.",
      requiredBoundary:
        "Run the complete command against a fully migrated target and preserve the redacted JSON result before rollout.",
    };
    console.log(
      JSON.stringify(
        {
          schema: "eh104.durable-deletion.retained-data.v1",
          status: "BLOCKED",
          noMutation: true,
          phidataNeverPrinted: true,
          findings: [finding],
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main().catch(() => {
  process.exitCode = 1;
});
