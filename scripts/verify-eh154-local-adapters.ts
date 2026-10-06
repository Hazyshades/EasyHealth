import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { MEDICAL_DISCLAIMER } from "../src/lib/schemas/biomarkers";
import type {
  createReportExportResponse as CreateReportExportResponse,
  getExportableReport as GetExportableReport,
  ReportExportError as ReportExportErrorType,
  ReportReadResolver,
} from "../src/lib/report-export";
let createReportExportResponse: typeof CreateReportExportResponse;
let getExportableReport: typeof GetExportableReport;
let ReportExportError: typeof ReportExportErrorType;
import type { DoctorVisitBrief } from "../src/lib/report-contract";
import { projectOwnerShares } from "../src/lib/share-management/projection";
import {
  consumeShareFailureRateLimits,
  ShareRateLimitStoreError,
} from "../src/lib/share-links/rate-limit";
import { hashSharePin, verifySharePin } from "../src/lib/share-links/pin";
import { applyPublicShareResponsePolicy } from "../src/lib/share-links/public-response-policy";
import { requireTrustedIngress } from "../src/lib/share-links/trusted-ingress";
import { getTrustedIngressContext } from "../src/lib/share-links/trusted-ingress-transport";
import {
  InvalidShareTokenError,
  digestShareToken,
  generateShareToken,
  parseShareToken,
} from "../src/lib/share-links/tokens";
import {
  configureShareTestEnvironment,
  ingressRuntime,
  signedIngressRequest,
  SHARE_TEST_TOKEN_KEYS,
} from "./fixtures/eh151-scoped-share-links";
const execFileAsync = promisify(execFile);

async function getCurrentCommit(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
    const commit = stdout.toString().trim();
    return /^[0-9a-f]{7,64}$/iu.test(commit) ? commit : null;
  } catch {
    return null;
  }
}
async function isWorkingTreeClean(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]);
    return stdout.toString().trim() === "";
  } catch {
    return false;
  }
}

const EVIDENCE_PATH = path.resolve(
  "openspec/changes/eh-154-share-link-privacy-release-gate/evidence/local-adapter-scenarios.json",
);
const PROFILE_A = "profile-a";
const PROFILE_B = "profile-b";
const REPORT_ID = "00000000-0000-4000-8000-000000154001";
const DOCUMENT_A = "00000000-0000-4000-8000-000000154002";
const DOCUMENT_B = "00000000-0000-4000-8000-000000154003";
const SOURCE_ID = "src_00000000000000000000000000000001";
const NOW = new Date("2026-10-04T10:00:00.000Z");

const REQUIRED_SCENARIOS = [
  "invalid-token",
  "expired-token",
  "revoked-token",
  "pin-failed",
  "pin-success",
  "pin-proof-missing",
  "pin-proof-wrong",
  "pin-proof-expired",
  "pin-proof-revoked",
  "pin-proof-cross-share",
  "cross-profile-report",
  "out-of-scope-document",
  "unapproved-export-format",
  "allowed-report",
  "denied-raw-document",
  "cache-index-referrer-policy",
  "event-redaction",
  "rate-limit-token-dimension",
  "rate-limit-requester-dimension",
  "rate-limit-store-unavailable",
  "trusted-ingress-direct-origin",
  "trusted-ingress-valid",
  "trusted-ingress-missing",
  "trusted-ingress-malformed",
  "trusted-ingress-expired",
  "trusted-ingress-spoofed-headers",
  "last-access-monotonic",
  "key-current",
  "key-previous",
  "key-unknown",
  "key-malformed",
  "key-rotation-retirement",
  "archive-source-snapshot",
  "tombstone-source-report",
  "replacement-revoke",
  "raw-download-policy",
  "cleanup-retention",
] as const;

type ScenarioId = (typeof REQUIRED_SCENARIOS)[number];
type ScenarioStatus = "pass" | "fail" | "blocked";
type ScenarioResult = {
  id: ScenarioId;
  status: ScenarioStatus;
  evidence: string;
  error?: string;
};
type ScenarioRun = {
  schemaVersion: 1;
  scope: "local-production-adapters";
  command: "pnpm test:eh154-adapters";
  executedAt: string;
  reviewedBuild: string | null;
  reviewedDeployment: string | null;
  scenarios: ScenarioResult[];
  limitations: Array<{ id: ScenarioId; reason: string }>;
};

function reportBrief(): DoctorVisitBrief {
  return {
    schema_version: "eh148.v1",
    report_kind: "doctor_visit_brief",
    generated_at: NOW.toISOString(),
    detail_level: "standard",
    requested_scope: { kind: "explicit", document_ids: [DOCUMENT_A] },
    source_document_ids: [DOCUMENT_A],
    sections: [
      {
        id: "document_summary",
        items: [{ type: "claim_ref", claim_id: "claim-summary" }],
      },
      {
        id: "latest_measurements",
        items: [],
        empty_state: "insufficient_evidence",
      },
      { id: "changes", items: [], empty_state: "insufficient_evidence" },
      { id: "clinician_questions", items: [], empty_state: "no_data" },
      { id: "limitations", items: [], empty_state: "no_data" },
      {
        id: "source_ledger",
        items: [{ type: "source_ref", source_id: SOURCE_ID }],
      },
    ],
    claims: [
      {
        id: "claim-summary",
        section: "document_summary",
        kind: "source_fact",
        origin: "generated",
        factual: true,
        citations: [{ source_id: SOURCE_ID, document_id: DOCUMENT_A }],
        status: "supported",
        template_id: "source_fact_snapshot",
        template_params: { source_id: SOURCE_ID, include_date: true },
        text: "Synthetic report summary.",
      },
    ],
    sources: [
      {
        source_id: SOURCE_ID,
        kind: "document_summary",
        document_id: DOCUMENT_A,
        snapshot: {
          kind: "document_summary",
          label: "Synthetic summary",
          observed_at: "2026-10-04",
          document_type: "lab_result",
          summary: "Synthetic report source.",
        },
      },
    ],
    limitations: [],
    disclaimer: MEDICAL_DISCLAIMER,
    validation: { status: "valid", version: "eh150.v1", issue_codes: [] },
    overview: "Synthetic report for local adapter verification.",
  };
}

function reportReadResolver(): ReportReadResolver {
  const brief = reportBrief();
  return async ({ profileId, reportId, mode }) => {
    assert.equal(mode, "export");
    if (profileId !== PROFILE_A) {
      return {
        status: "unavailable",
        reason: "not_found",
      };
    }
    return {
      status: "structured",
      can_share: true,
      can_export: true,
      report: {
        id: reportId,
        title: "Synthetic report",
        report_type: "general_practice",
        detail_level: "standard",
        abnormal_only: false,
        content: brief,
        summary_preview: brief.overview,
        created_at: brief.generated_at,
      },
    };
  };
}

function shareCapability(
  overrides: Partial<{
    ownerProfileId: string;
    reportScopeDocumentIds: readonly string[];
    rawDocumentIds: readonly string[];
    downloadPolicy: "none" | "report" | "documents";
    allowedExportFormats: readonly ("pdf" | "csv" | "json")[];
  }> = {},
) {
  return {
    reportId: REPORT_ID,
    ownerProfileId: overrides.ownerProfileId ?? PROFILE_A,
    reportScopeDocumentIds: overrides.reportScopeDocumentIds ?? [DOCUMENT_A],
    rawDocumentIds: overrides.rawDocumentIds ?? [],
    downloadPolicy: overrides.downloadPolicy ?? "report",
    allowedExportFormats: overrides.allowedExportFormats ?? ["json"],
  } as const;
}

function replaceHeader(request: Request, name: string, value: string): Request {
  const headers = new Headers(request.headers);
  headers.set(name, value);
  return new Request(request.url, { headers });
}

function shareLinks() {
  return [
    {
      id: "share-active-a",
      profile_id: PROFILE_A,
      report_id: REPORT_ID,
      expires_at: "2026-10-05T00:00:00.000Z",
      revoked_at: null,
      download_policy: "report",
      allowed_export_formats: ["json"],
      created_at: "2026-10-01T00:00:00.000Z",
      last_accessed_at: null,
      reports: { title: "Synthetic report" },
    },
    {
      id: "share-expired-a",
      profile_id: PROFILE_A,
      report_id: REPORT_ID,
      expires_at: "2026-10-03T00:00:00.000Z",
      revoked_at: null,
      download_policy: "none",
      allowed_export_formats: [],
      created_at: "2026-09-01T00:00:00.000Z",
      last_accessed_at: null,
      reports: { title: "Synthetic expired report" },
    },
    {
      id: "share-revoked-a",
      profile_id: PROFILE_A,
      report_id: REPORT_ID,
      expires_at: "2026-10-05T00:00:00.000Z",
      revoked_at: "2026-10-03T12:00:00.000Z",
      download_policy: "none",
      allowed_export_formats: [],
      created_at: "2026-09-02T00:00:00.000Z",
      last_accessed_at: null,
      reports: { title: "Synthetic revoked report" },
    },
    {
      id: "share-active-b",
      profile_id: PROFILE_B,
      report_id: REPORT_ID,
      expires_at: "2026-10-05T00:00:00.000Z",
      revoked_at: null,
      download_policy: "report",
      allowed_export_formats: ["json"],
      created_at: "2026-10-01T00:00:00.000Z",
      last_accessed_at: null,
      reports: { title: "Profile B report" },
    },
  ];
}
function configureAdapterEnvironment(): void {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://placeholder.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "ci-placeholder";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "ci-placeholder";
  process.env.OPENAI_API_KEY ??= "ci-placeholder";
  configureShareTestEnvironment();
}

async function main(): Promise<void> {
  configureAdapterEnvironment();
  // report-export validates application environment during module loading.
  ({ createReportExportResponse, getExportableReport, ReportExportError } =
    await import("../src/lib/report-export"));
  const worktreeClean = await isWorkingTreeClean();
  const reviewedBuild = worktreeClean ? await getCurrentCommit() : null;
  const writeEvidence = process.argv.includes("--write-evidence");
  if (writeEvidence && !worktreeClean) {
    throw new Error(
      "Cannot write adapter evidence from a dirty worktree; commit or discard all changes first.",
    );
  }
  const results = new Map<ScenarioId, ScenarioResult>();
  const failures: string[] = [];
  const resolver = reportReadResolver();

  const check = async (
    id: ScenarioId,
    evidence: string,
    action: () => void | Promise<void>,
  ): Promise<void> => {
    try {
      await action();
      results.set(id, { id, status: "pass", evidence });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${id}: ${message}`);
      results.set(id, { id, status: "fail", evidence, error: message });
    }
  };

  await check(
    "invalid-token",
    "parseShareToken rejects malformed token",
    () => {
      assert.equal(parseShareToken("v2026-1.short"), null);
    },
  );

  await check(
    "expired-token",
    "projectOwnerShares reports expired state",
    () => {
      const [expired] = projectOwnerShares(
        PROFILE_A,
        shareLinks(),
        [],
        NOW,
      ).filter((share) => share.id === "share-expired-a");
      assert.equal(expired?.status, "expired");
    },
  );

  await check(
    "revoked-token",
    "projectOwnerShares reports revoked state",
    () => {
      const [revoked] = projectOwnerShares(
        PROFILE_A,
        shareLinks(),
        [],
        NOW,
      ).filter((share) => share.id === "share-revoked-a");
      assert.equal(revoked?.status, "revoked");
    },
  );

  await check("pin-failed", "verifySharePin rejects a wrong PIN", async () => {
    const stored = await hashSharePin("2468");
    assert.equal(await verifySharePin("1357", stored.hash, stored.salt), false);
  });

  await check(
    "cross-profile-report",
    "getExportableReport resolves only the owner profile",
    async () => {
      await assert.rejects(
        () =>
          getExportableReport({ kind: "owner", profileId: PROFILE_B }, "json", {
            reportId: REPORT_ID,
            readReport: resolver,
          }),
        (error: unknown) =>
          error instanceof ReportExportError &&
          error.code === "REPORT_UNAVAILABLE",
      );
    },
  );

  await check(
    "out-of-scope-document",
    "getExportableReport rejects a mismatched report document scope",
    async () => {
      await assert.rejects(
        () =>
          getExportableReport(
            {
              kind: "share",
              capability: shareCapability({
                reportScopeDocumentIds: [DOCUMENT_B],
              }),
            },
            "json",
            { reportId: REPORT_ID, readReport: resolver },
          ),
        (error: unknown) =>
          error instanceof ReportExportError && error.code === "UNAUTHORIZED",
      );
    },
  );

  await check(
    "allowed-report",
    "getExportableReport returns the scoped report",
    async () => {
      const exportable = await getExportableReport(
        { kind: "share", capability: shareCapability() },
        "json",
        { reportId: REPORT_ID, readReport: resolver },
      );
      assert.equal(exportable.reportId, REPORT_ID);
      assert.deepEqual(exportable.reportScopeDocumentIds, [DOCUMENT_A]);
    },
  );

  await check(
    "denied-raw-document",
    "report-only capability rejects raw document IDs",
    async () => {
      await assert.rejects(
        () =>
          getExportableReport(
            {
              kind: "share",
              capability: shareCapability({ rawDocumentIds: [DOCUMENT_A] }),
            },
            "json",
            { reportId: REPORT_ID, readReport: resolver },
          ),
        (error: unknown) =>
          error instanceof ReportExportError && error.code === "UNAUTHORIZED",
      );
    },
  );

  await check(
    "cache-index-referrer-policy",
    "public response policy applies cache, index, referrer, and vary headers",
    () => {
      const publicResponse = applyPublicShareResponsePolicy(
        new Response("fixture"),
      );
      assert.equal(
        publicResponse.headers.get("Cache-Control"),
        "no-store, private",
      );
      assert.equal(
        publicResponse.headers.get("X-Robots-Tag"),
        "noindex, nofollow",
      );
      assert.equal(
        publicResponse.headers.get("Referrer-Policy"),
        "no-referrer",
      );
      assert.equal(publicResponse.headers.get("Vary"), "Cookie");
      const exportResponse = createReportExportResponse(
        {
          bytes: Uint8Array.from([0x7b, 0x7d]),
          contentType: "application/json; charset=utf-8",
          filename: "synthetic.json",
        },
        { kind: "share", applyPublicShareResponsePolicy },
      );
      assert.equal(
        exportResponse.headers.get("Cache-Control"),
        "no-store, private",
      );
      assert.equal(
        exportResponse.headers.get("X-Content-Type-Options"),
        "nosniff",
      );
    },
  );

  await check(
    "event-redaction",
    "owner projection contains only coarse event fields",
    () => {
      const projected = projectOwnerShares(
        PROFILE_A,
        shareLinks(),
        [
          {
            share_id: "share-active-a",
            occurred_at: NOW.toISOString(),
            result: "pin_invalid",
            resource_kind: "report",
            client_class: "browser",
            retention_expires_at: "2026-11-04T10:00:00.000Z",
          },
        ],
        NOW,
      );
      const serialized = JSON.stringify(projected);
      assert.match(serialized, /"result":"denied"/u);
      assert.doesNotMatch(
        serialized,
        /token|pin|storage_path|profile_id|198\.51\.100\.9|user-agent/iu,
      );
    },
  );

  const rateLimitCalls: Record<string, unknown>[] = [];
  const rateLimitStore = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      rateLimitCalls.push(args);
      return {
        data: { allowed: true, retry_after_seconds: 0, store_available: true },
        error: null,
      };
    },
  } as unknown as Parameters<typeof consumeShareFailureRateLimits>[0];

  await check(
    "rate-limit-token-dimension",
    "rate-limit adapter sends token and requester buckets",
    async () => {
      rateLimitCalls.length = 0;
      await consumeShareFailureRateLimits(rateLimitStore, {
        tokenKey: "a".repeat(64),
        requesterAddress: "198.51.100.9",
        userAgent: "Mozilla/5.0",
        now: NOW,
      });
      assert.deepEqual(
        rateLimitCalls.map((call) => call.p_limit),
        [30, 10],
      );
      assert.notEqual(
        rateLimitCalls[0]?.p_key_digest,
        rateLimitCalls[1]?.p_key_digest,
      );
    },
  );

  await check(
    "rate-limit-requester-dimension",
    "rate-limit adapter uses a coarse requester bucket",
    async () => {
      rateLimitCalls.length = 0;
      await consumeShareFailureRateLimits(rateLimitStore, {
        tokenKey: null,
        requesterAddress: "198.51.100.19",
        userAgent: "curl/8.0",
        now: NOW,
      });
      assert.equal(rateLimitCalls.length, 1);
      assert.equal(rateLimitCalls[0]?.p_limit, 30);
      assert.match(String(rateLimitCalls[0]?.p_key_digest), /^[0-9a-f]{64}$/u);
    },
  );

  await check(
    "rate-limit-store-unavailable",
    "rate-limit adapter fails closed on RPC errors",
    async () => {
      const unavailableStore = {
        rpc: async () => ({ data: null, error: new Error("offline") }),
      } as unknown as Parameters<typeof consumeShareFailureRateLimits>[0];
      await assert.rejects(
        () =>
          consumeShareFailureRateLimits(unavailableStore, {
            tokenKey: null,
            requesterAddress: "198.51.100.9",
            userAgent: null,
            now: NOW,
          }),
        ShareRateLimitStoreError,
      );
    },
  );

  await check(
    "trusted-ingress-direct-origin",
    "missing trusted ingress peer fails closed",
    () => {
      const request = signedIngressRequest("198.51.100.9", "10.2.3.4");
      const result = requireTrustedIngress(request);
      assert.equal(result.ok, false);
      assert.equal(result.status, 503);
    },
  );

  await check(
    "trusted-ingress-spoofed-headers",
    "forwarded headers cannot replace attested peer metadata",
    () => {
      const request = signedIngressRequest("198.51.100.9", "10.2.3.4");
      const spoofed = replaceHeader(request, "X-Forwarded-For", "198.51.100.9");
      const result = getTrustedIngressContext(
        spoofed,
        ingressRuntime("192.0.2.9"),
      );
      assert.equal("ok" in result, true);
      if ("ok" in result) assert.equal(result.reason, "untrusted_peer");
    },
  );

  await check(
    "key-current",
    "current token selector digests successfully",
    () => {
      const generated = generateShareToken();
      assert.equal(parseShareToken(generated.token)?.tokenKeyVersion, "2026-1");
      assert.equal(
        digestShareToken(generated.token).tokenDigest,
        generated.tokenDigest,
      );
    },
  );

  await check(
    "key-previous",
    "previous token selector remains readable during rotation",
    () => {
      const generated = generateShareToken();
      const previous = `v2025-1.${parseShareToken(generated.token)?.random}`;
      assert.equal(digestShareToken(previous).tokenKeyVersion, "2025-1");
    },
  );

  await check("key-unknown", "unknown token selector is rejected", () => {
    const generated = generateShareToken();
    assert.throws(
      () =>
        digestShareToken(
          `vunknown.${parseShareToken(generated.token)?.random}`,
        ),
      InvalidShareTokenError,
    );
  });

  await check("key-malformed", "malformed token selector is rejected", () => {
    assert.equal(parseShareToken("not-a-token"), null);
    assert.throws(
      () => digestShareToken("not-a-token"),
      InvalidShareTokenError,
    );
  });

  await check(
    "raw-download-policy",
    "documents policy carries only explicit raw document IDs",
    async () => {
      const exportable = await getExportableReport(
        {
          kind: "share",
          capability: shareCapability({
            downloadPolicy: "documents",
            rawDocumentIds: [DOCUMENT_A],
          }),
        },
        "json",
        { reportId: REPORT_ID, readReport: resolver },
      );
      assert.deepEqual(exportable.rawDocumentIds, [DOCUMENT_A]);
    },
  );

  const blocked = new Map<ScenarioId, string>([
    [
      "pin-success",
      "Requires protected-cookie issuance evidence from the reviewed PIN route.",
    ],
    [
      "pin-proof-missing",
      "Requires reviewed-route evidence that a missing proof is denied before bytes.",
    ],
    [
      "pin-proof-wrong",
      "Requires reviewed-route evidence that a wrong proof is denied before bytes.",
    ],
    [
      "pin-proof-expired",
      "Requires reviewed-route evidence that an expired proof is denied before bytes.",
    ],
    [
      "pin-proof-revoked",
      "Requires reviewed-route evidence that a revoked proof is denied before bytes.",
    ],
    [
      "pin-proof-cross-share",
      "Requires reviewed-route evidence that a proof cannot cross share boundaries.",
    ],
    [
      "unapproved-export-format",
      "Requires public-share export route evidence for a format omitted from the capability.",
    ],
    [
      "trusted-ingress-valid",
      "Requires reviewed deployment evidence for valid attested ingress metadata.",
    ],
    [
      "trusted-ingress-missing",
      "Requires reviewed deployment evidence for missing ingress metadata.",
    ],
    [
      "trusted-ingress-malformed",
      "Requires reviewed deployment evidence for malformed ingress metadata.",
    ],
    [
      "trusted-ingress-expired",
      "Requires reviewed deployment evidence for expired ingress metadata.",
    ],
    [
      "last-access-monotonic",
      "Requires concurrent production touch RPC evidence against a provisioned database.",
    ],
    [
      "key-rotation-retirement",
      "Requires key-manager retirement and bounded reissue/revoke evidence, not source inspection.",
    ],
    [
      "archive-source-snapshot",
      "Requires persisted archived-source rows and report-read route evidence.",
    ],
    [
      "tombstone-source-report",
      "Requires durable-deletion tombstone handoff and raw/report route evidence.",
    ],
    [
      "replacement-revoke",
      "Requires owner replacement/revoke RPC execution and visibility evidence.",
    ],
    [
      "cleanup-retention",
      "Requires worker schedule, advisory-lock, backlog, retry, and alert evidence.",
    ],
  ]);

  const scenarios = REQUIRED_SCENARIOS.map((id) => {
    const result = results.get(id);
    if (result) return result;
    const reason = blocked.get(id);
    if (!reason) {
      throw new Error(`Scenario ${id} has no result`);
    }
    return { id, status: "blocked" as const, evidence: reason };
  });

  const run: ScenarioRun = {
    schemaVersion: 1,
    scope: "local-production-adapters",
    command: "pnpm test:eh154-adapters",
    executedAt: process.env.EH154_EXECUTED_AT ?? new Date().toISOString(),
    reviewedBuild,
    reviewedDeployment: process.env.EH154_REVIEWED_DEPLOYMENT ?? null,
    scenarios,
    limitations: scenarios
      .filter(
        (scenario): scenario is ScenarioResult & { status: "blocked" } =>
          scenario.status === "blocked",
      )
      .map(({ id, evidence }) => ({ id, reason: evidence })),
  };

  console.log(JSON.stringify(run, null, 2));
  if (writeEvidence) {
    await mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
    await writeFile(EVIDENCE_PATH, `${JSON.stringify(run, null, 2)}\n`, "utf8");
    console.log(`wrote ${path.relative(process.cwd(), EVIDENCE_PATH)}`);
  }

  if (failures.length > 0) {
    throw new Error(
      `EH-154 local adapter verification failed: ${failures.join("; ")}`,
    );
  }

  const passCount = scenarios.filter(
    (scenario) => scenario.status === "pass",
  ).length;
  const blockedCount = scenarios.filter(
    (scenario) => scenario.status === "blocked",
  ).length;
  console.log(
    `verify-eh154-local-adapters: ${passCount} passed, ${blockedCount} blocked by external evidence`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
