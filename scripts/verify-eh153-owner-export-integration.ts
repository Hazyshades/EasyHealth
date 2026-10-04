import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyReportExportFailure,
  type ReportExportFailureResponse,
} from "../src/lib/report-export/route-response";
import { ReportExportError } from "../src/lib/report-export";
import { attachmentFilename } from "../src/lib/report-export/download-filename";

const ROUTE_PATH = "src/app/api/reports/[id]/export/route.ts";
const PAGE_PATH = "src/app/app/reports/[id]/page.tsx";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

// ── Failure mapping ────────────────────────────────────────────────────────
const EXPECTED_STATUS: Record<string, number> = {
  UNAUTHORIZED: 403,
  REPORT_UNAVAILABLE: 410,
  VALIDATION_INVALID: 422,
  FORMAT_NOT_ALLOWED: 400,
  DYNAMICS_INVALID: 422,
  REPORT_TOO_LARGE: 413,
  PDF_RENDER_FAILED: 500,
  SERIALIZATION_FAILED: 500,
};

for (const [code, status] of Object.entries(EXPECTED_STATUS)) {
  const failure: ReportExportFailureResponse = classifyReportExportFailure(
    new ReportExportError(code as never, "internal detail that must not leak"),
  );
  assert.equal(failure.status, status, `${code} status`);
  assert.equal(failure.body.code, code, `${code} echoes its own code`);
  assert.doesNotMatch(
    failure.body.error,
    /internal detail/u,
    `${code} must not expose the internal message`,
  );
  assert.doesNotMatch(failure.body.error, /issue_code|storage_path/u);
}

assert.equal(
  classifyReportExportFailure(new Error("boom secret")).body.code,
  "SERIALIZATION_FAILED",
  "unknown failures stay generic",
);
assert.equal(
  classifyReportExportFailure("not even an error").status,
  500,
  "non-Error throwables stay generic",
);

// ── Download filename sink ──────────────────────────────────────────────────
assert.equal(
  attachmentFilename(
    "attachment; filename=\"report.pdf\"; filename*=UTF-8''%D0%94%D0%BE%D0%BA%D1%82%D0%BE%D1%80.pdf",
    "fallback.pdf",
  ),
  "Доктор.pdf",
  "prefers and decodes the RFC 5987 filename",
);
assert.equal(
  attachmentFilename('attachment; filename="plain.pdf"', "fallback.pdf"),
  "plain.pdf",
  "falls back to the plain filename",
);
assert.equal(attachmentFilename(null, "fallback.pdf"), "fallback.pdf");
assert.equal(attachmentFilename("", "fallback.pdf"), "fallback.pdf");
assert.equal(
  attachmentFilename(
    "attachment; filename*=UTF-8''%2Fetc%2Fpasswd",
    "fallback.pdf",
  ),
  "etc passwd",
  "an absolute path loses its separators instead of escaping the folder",
);
assert.equal(
  attachmentFilename('attachment; filename="../../secret.csv"', "fallback.csv"),
  ".. .. secret.csv",
  "traversal segments lose their separators",
);
for (const name of [
  attachmentFilename("attachment; filename*=UTF-8''%2Fetc%2Fpasswd", "f.pdf"),
  attachmentFilename('attachment; filename="../../secret.csv"', "f.csv"),
]) {
  assert.doesNotMatch(
    name,
    /[/\\\u0000-\u001f]/u,
    "no path or control characters survive",
  );
  assert.doesNotMatch(name, /\.\.[/\\]/u, "no traversal segment survives");
}
assert.equal(
  attachmentFilename("attachment; filename*=UTF-8''%E0%A4%A", "fallback.pdf"),
  "fallback.pdf",
  "malformed percent-encoding falls back instead of throwing",
);
assert.equal(
  attachmentFilename('attachment; filename="   "', "fallback.pdf"),
  "fallback.pdf",
  "whitespace-only names fall back",
);

// ── Route contract ──────────────────────────────────────────────────────────
const route = readSource(ROUTE_PATH);
const sessionIndex = route.indexOf("getSessionProfileId");
const formatIndex = route.indexOf("isExportFormat");
const renderIndex = route.indexOf("renderReportExport");
assert.ok(sessionIndex >= 0, "route resolves the session");
assert.ok(
  sessionIndex < formatIndex,
  "authentication is checked before the requested format so an anonymous caller cannot probe formats",
);
assert.ok(
  formatIndex < renderIndex,
  "the format is validated before any export work",
);
assert.match(route, /\{ kind: "owner" \}/u, "route uses owner access context");
assert.match(
  route,
  /createReportExportResponse\(file, \{ kind: "owner" \}\)/u,
  "route builds the owner response context",
);
assert.doesNotMatch(
  route,
  /applyPublicShareResponsePolicy/u,
  "the owner route must not apply the public share policy",
);
assert.doesNotMatch(
  route,
  /error\.message/u,
  "route never forwards raw errors",
);

// ── Page contract ───────────────────────────────────────────────────────────
const page = readSource(PAGE_PATH);
assert.match(
  page,
  /setCanExport\(data\.status === "structured" && data\.can_export\)/u,
  "export availability requires a structured, exportable report",
);
const gatedBranch = /\{canExport \? \(([\s\S]*?)\) : null\}/u.exec(page);
assert.ok(
  gatedBranch,
  "actions are rendered from a single canExport-gated branch",
);
assert.match(
  gatedBranch[1]!,
  /<ReportExportActions[\s\S]*?onExport=\{handleExport\}/u,
  "the gated branch renders the shared actions with the page handler",
);
assert.equal(
  page.match(/<ReportExportActions/gu)?.length,
  1,
  "the actions never render outside the gated branch",
);
assert.doesNotMatch(
  page,
  /readStatus === "legacy"[\s\S]{0,400}ReportExportActions/u,
  "legacy reports never surface export actions",
);
assert.match(
  page,
  /URL\.revokeObjectURL\(url\)/u,
  "the object URL is released after the download",
);
assert.doesNotMatch(
  page,
  /token|access_token|refresh_token/u,
  "the page never handles share token material",
);

console.log("verify-eh153-owner-export-integration: all checks passed");
