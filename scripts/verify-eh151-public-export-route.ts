import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type {
  handlePublicShareExport,
  PublicExportRouteDependencies,
  PublicExportRouteContext,
} from "../src/app/api/share/[token]/export/route";
import type {
  AuthorizedShareRead,
  ShareLookup,
  SharePinRequiredError,
  ShareUnavailableError,
} from "../src/lib/share-links/authorization";
import type { PublicBoundaryContext } from "../src/lib/share-links/public-boundary";
import type {
  createReportExportResponse,
  isExportFormat,
  ReportExportFile,
} from "../src/lib/report-export";
import type { applyPublicShareExportResponsePolicy } from "../src/lib/share-links/public-export-actions";
import type {
  publicShareError,
  publicShareJson,
} from "../src/lib/share-links/route-responses";

type FixtureRuntime = {
  handlePublicShareExport: typeof handlePublicShareExport;
  SharePinRequiredError: typeof SharePinRequiredError;
  ShareUnavailableError: typeof ShareUnavailableError;
  createExportResponse: typeof createReportExportResponse;
  isExportFormat: typeof isExportFormat;
  applyPublicShareExportResponsePolicy: typeof applyPublicShareExportResponsePolicy;
  publicShareError: typeof publicShareError;
  publicShareJson: typeof publicShareJson;
};
let runtime!: FixtureRuntime;

const TOKEN = "fixture-share-token";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";

const LOOKUP: ShareLookup = {
  token: {
    tokenKeyVersion: "2026-1",
    tokenDigest: "a".repeat(64),
  },
  share: {
    share_id: "44444444-4444-4444-8444-444444444444",
    profile_id: PROFILE_ID,
    report_id: REPORT_ID,
    token_key_version: "2026-1",
    pin_hash: null,
    pin_salt: null,
    expires_at: "2027-01-01T00:00:00.000Z",
    revoked_at: null,
    download_policy: "documents",
    allowed_export_formats: ["pdf"],
    document_ids: [DOCUMENT_ID],
    last_accessed_at: null,
  },
};

const REPORT_READ = {
  status: "structured",
  report: {
    content: { source_document_ids: [DOCUMENT_ID] },
  },
} as unknown as AuthorizedShareRead["reportRead"];

const BOUNDARY: PublicBoundaryContext = {
  clientAddress: "198.51.100.10",
  clientClass: "browser",
  userAgent: "fixture-browser",
};

const CONTEXT: PublicExportRouteContext = {
  params: Promise.resolve({ token: TOKEN }),
};

const FILE: ReportExportFile = {
  bytes: new TextEncoder().encode("fixture export"),
  contentType: "application/pdf",
  filename: "fixture.pdf",
};

function requestFor(query: string): NextRequest {
  return new NextRequest(
    `https://easyhealth.test/api/share/${TOKEN}/export${query}`,
  );
}

function baseDependencies(events: string[]): PublicExportRouteDependencies {
  return {
    verifyPublicBoundary: () => BOUNDARY,
    loadShareByToken: async () => {
      events.push("lookup");
      return LOOKUP;
    },
    consumeFailureRateLimit: async () => null,
    consumeSelectedShareFailureRateLimit: async () => null,
    recordAndConsumeSelectedShareFailure: async () => {
      events.push("record-failure");
      return null;
    },
    authorizeShareRead: async () => {
      throw new Error("fixture authorize override missing");
    },
    isExportFormat: runtime.isExportFormat,
    renderReportExport: async () => {
      throw new Error("fixture renderer override missing");
    },
    createReportExportResponse: (file, context) => {
      events.push("response");
      return runtime.createExportResponse(file, context);
    },
    applyPublicShareExportResponsePolicy:
      runtime.applyPublicShareExportResponsePolicy,
    publicShareError: runtime.publicShareError,
    publicShareJson: runtime.publicShareJson,
  };
}

async function main(): Promise<void> {
  process.env.SKIP_ENV_VALIDATION = "1";
  // These route modules validate server environment variables at import time;
  // lazy loading keeps this fixture independent of developer secrets.
  const route = await import("../src/app/api/share/[token]/export/route");
  const authorization = await import("../src/lib/share-links/authorization");
  const reportExport = await import("../src/lib/report-export");
  const publicExportActions = await import(
    "../src/lib/share-links/public-export-actions"
  );
  const routeResponses = await import("../src/lib/share-links/route-responses");
  runtime = {
    handlePublicShareExport: route.handlePublicShareExport,
    SharePinRequiredError: authorization.SharePinRequiredError,
    ShareUnavailableError: authorization.ShareUnavailableError,
    createExportResponse: reportExport.createReportExportResponse,
    isExportFormat: reportExport.isExportFormat,
    applyPublicShareExportResponsePolicy:
      publicExportActions.applyPublicShareExportResponsePolicy,
    publicShareError: routeResponses.publicShareError,
    publicShareJson: routeResponses.publicShareJson,
  };
  const { handlePublicShareExport } = runtime;
  const { SharePinRequiredError, ShareUnavailableError } = runtime;
  const ingressEvents: string[] = [];
  const rejectedAtIngress = await handlePublicShareExport(
    requestFor("?format=pdf"),
    CONTEXT,
    {
      ...baseDependencies(ingressEvents),
      verifyPublicBoundary: () =>
        runtime.publicShareJson({ error: "blocked" }, 503),
    },
  );
  assert.equal(rejectedAtIngress.status, 503);
  assert.deepEqual(ingressEvents, []);

  const pinEvents: string[] = [];
  let pinAuthorizeCalls = 0;
  const pinFailure = await handlePublicShareExport(
    requestFor("?format=pdf"),
    CONTEXT,
    {
      ...baseDependencies(pinEvents),
      authorizeShareRead: async () => {
        pinAuthorizeCalls += 1;
        throw new SharePinRequiredError(false);
      },
    },
  );
  assert.equal(pinFailure.status, 401);
  assert.deepEqual(await pinFailure.json(), { error: "PIN required" });
  assert.equal(pinAuthorizeCalls, 1);

  const deniedEvents: string[] = [];
  let deniedLimiterCalls = 0;
  const deniedFormat = await handlePublicShareExport(
    requestFor("?format=csv"),
    CONTEXT,
    {
      ...baseDependencies(deniedEvents),
      consumeSelectedShareFailureRateLimit: async () => {
        deniedLimiterCalls += 1;
        return null;
      },
      authorizeShareRead: async () => {
        throw new ShareUnavailableError();
      },
    },
  );
  assert.equal(deniedFormat.status, 404);
  assert.deepEqual(await deniedFormat.json(), { error: "Share unavailable" });
  assert.equal(deniedLimiterCalls, 1);
  assert.deepEqual(deniedEvents, ["lookup"]);

  const allowedEvents: string[] = [];
  const allowedResponse = await handlePublicShareExport(
    requestFor("?format=pdf"),
    CONTEXT,
    {
      ...baseDependencies(allowedEvents),
      authorizeShareRead: async (input) => {
        allowedEvents.push("authorize");
        assert.equal(input.deferSuccessfulAccess, true);
        return {
          lookup: LOOKUP,
          reportRead: REPORT_READ,
          complete: async () => {
            allowedEvents.push("complete");
          },
        };
      },
      renderReportExport: async (accessContext, format, input) => {
        allowedEvents.push("render");
        assert.equal(format, "pdf");
        assert.deepEqual(input, { reportId: REPORT_ID });
        assert.equal(accessContext.kind, "share");
        if (accessContext.kind === "share") {
          assert.deepEqual(accessContext.capability, {
            reportId: REPORT_ID,
            ownerProfileId: PROFILE_ID,
            reportScopeDocumentIds: [DOCUMENT_ID],
            rawDocumentIds: [DOCUMENT_ID],
            downloadPolicy: "documents",
            allowedExportFormats: ["pdf"],
          });
        }
        return FILE;
      },
    },
  );
  assert.equal(allowedResponse.status, 200);
  assert.equal(await allowedResponse.text(), "fixture export");
  assert.equal(
    allowedResponse.headers.get("Cache-Control"),
    "no-store, private",
  );
  assert.equal(
    allowedResponse.headers.get("X-Robots-Tag"),
    "noindex, nofollow",
  );
  assert.equal(allowedResponse.headers.get("Referrer-Policy"), "no-referrer");
  assert.deepEqual(allowedEvents, [
    "lookup",
    "authorize",
    "render",
    "response",
    "complete",
  ]);

  const rendererEvents: string[] = [];
  let rendererCompletionCalls = 0;
  const rendererFailure = await handlePublicShareExport(
    requestFor("?format=pdf"),
    CONTEXT,
    {
      ...baseDependencies(rendererEvents),
      authorizeShareRead: async () => ({
        lookup: LOOKUP,
        reportRead: REPORT_READ,
        complete: async () => {
          rendererCompletionCalls += 1;
        },
      }),
      renderReportExport: async () => {
        throw new Error("renderer failed");
      },
    },
  );
  assert.equal(rendererFailure.status, 503);
  assert.deepEqual(await rendererFailure.json(), {
    error: "Share service unavailable",
  });
  assert.equal(rendererCompletionCalls, 0);

  console.log("EH-151 public export route fixtures passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
