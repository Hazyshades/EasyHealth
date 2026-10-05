import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

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

const CHANGE_ROOT = path.resolve(
  "openspec/changes/eh-154-share-link-privacy-release-gate",
);
const EVIDENCE_ROOT = path.join(CHANGE_ROOT, "evidence");
const GATE_RECORD_PATH = path.join(EVIDENCE_ROOT, "release-gate.json");

const REQUIRED_EVIDENCE_FILES = [
  "threat-model.md",
  "release-controls.md",
  "privacy-signoff.md",
  "incident-runbook.md",
  "release-record.md",
  "local-adapter-scenarios.json",
  "release-gate.json",
] as const;
const SECRET_REFERENCE_PATTERN =
  /^(?:(?:secret|vault|aws-secretsmanager|gcp-secretmanager|azure-keyvault|keyvault):\/\/[A-Za-z0-9._/-]+(?:[#@]version[=:]?[A-Za-z0-9._-]+)?)$/iu;
const SECRET_FINGERPRINT_PATTERN = /^(?:sha256[:/-])?[A-Fa-f0-9]{64}$/u;
const SECRET_PLACEHOLDER_PATTERN =
  /^(?:_pending_|pending|reference|fingerprint|version|redacted|none|null|omitted|never|ci-placeholder|<[^>]+>)$/iu;
const REVIEWED_EVIDENCE_REFERENCE_PATTERN =
  /^(?:[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9._/-]+(?:#[A-Za-z0-9._-]+)?|[a-z][a-z0-9+.-]*:[A-Za-z0-9._/-]+(?:#[A-Za-z0-9._-]+)?)$/iu;
const SHARE_TOKEN_PATTERN =
  /(?:^|[^A-Za-z0-9._~-])v[A-Za-z0-9._~-]{1,32}\.[A-Za-z0-9_-]{43,}(?![A-Za-z0-9_-])/u;
const PUBLIC_SHARE_URL_PATTERN =
  /https?:\/\/[^\s/]+\/(?:api\/)?share\/v[A-Za-z0-9._~-]{1,32}\.[A-Za-z0-9_-]{43,}(?![A-Za-z0-9_-])/iu;
const NAMED_SECRET_ASSIGNMENT_PATTERN =
  /["'`]?(?:SHARE_RATE_LIMIT_PEPPER|SHARE_PIN_PROOF_PEPPER|SHARE_TRUSTED_PROXY_ATTESTATION_KEY)["'`]?\s*[:=]\s*["'`]?([^\s"'|,;]+)/giu;

const PRODUCTION_SURFACES = [
  {
    id: "EH-151 public boundary",
    paths: [
      "src/lib/share-links/public-response-policy.ts",
      "src/lib/share-links/trusted-ingress.ts",
      "src/lib/share-links/trusted-ingress-transport.ts",
      "src/lib/share-links/rate-limit.ts",
      "src/app/share/[token]/page.tsx",
      "src/app/api/share/[token]/route.ts",
      "src/app/api/share/[token]/pin/route.ts",
    ],
  },
  {
    id: "EH-152 management boundary",
    paths: [
      "src/app/api/share-management",
      "src/app/app/settings/shared-reports",
    ],
  },
  {
    id: "EH-153 export boundary",
    paths: [
      "src/lib/report-export",
      "src/components/report-export-actions.tsx",
      "src/app/api/reports/[id]/export/route.ts",
    ],
  },
  {
    id: "EH-154 public-share export boundary",
    paths: ["src/app/api/share/[token]/export/route.ts"],
  },
] as const;

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

type GateStatus = "blocked" | "ready-with-risk" | "ready";
type FindingSeverity = "low" | "medium" | "high" | "critical";
type FindingStatus = "open" | "resolved";
type ScenarioStatus = "pass" | "fail" | "blocked" | "not-run";

type GateRecord = {
  schemaVersion: number;
  gateStatus: GateStatus;
  reviewedBuild: string | null;
  reviewedDeployment: string | null;
  evidenceOwner: string | null;
  privacySignOff: boolean;
  requiredSecretReferences: Array<{
    name: string;
    reference?: string | null;
    fingerprint?: string | null;
  }>;
  findings: Array<{
    id: string;
    severity: FindingSeverity;
    status: FindingStatus;
    summary: string;
    owner: string;
  }>;
  scenarios: Array<{ id: string; status: ScenarioStatus; evidence?: string }>;
  commands: Array<{ command: string; status: ScenarioStatus }>;
  residualRisks: Array<{
    id: string;
    severity: "low" | "medium";
    owner: string;
    expiresOn: string;
    summary: string;
  }>;
};

type Finding = {
  severity: FindingSeverity;
  message: string;
};
const GateRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    gateStatus: z.enum(["blocked", "ready-with-risk", "ready"]),
    reviewedBuild: z.string().nullable(),
    reviewedDeployment: z.string().nullable(),
    evidenceOwner: z.string().nullable(),
    privacySignOff: z.boolean(),
    requiredSecretReferences: z.array(
      z
        .object({
          name: z.string(),
          reference: z.string().nullable().optional(),
          fingerprint: z.string().nullable().optional(),
        })
        .strict(),
    ),
    findings: z.array(
      z
        .object({
          id: z.string(),
          severity: z.enum(["low", "medium", "high", "critical"]),
          status: z.enum(["open", "resolved"]),
          summary: z.string(),
          owner: z.string(),
        })
        .strict(),
    ),
    scenarios: z.array(
      z
        .object({
          id: z.string(),
          status: z.enum(["pass", "fail", "blocked", "not-run"]),
          evidence: z.string().optional(),
        })
        .strict(),
    ),
    commands: z.array(
      z
        .object({
          command: z.string(),
          status: z.enum(["pass", "fail", "blocked", "not-run"]),
        })
        .strict(),
    ),
    residualRisks: z.array(
      z
        .object({
          id: z.string(),
          severity: z.enum(["low", "medium"]),
          owner: z.string(),
          expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
          summary: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

const LocalAdapterRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    scope: z.literal("local-production-adapters"),
    command: z.literal("pnpm test:eh154-adapters"),
    executedAt: z.string().datetime({ offset: true }),
    reviewedBuild: z.string().nullable(),
    reviewedDeployment: z.string().nullable(),
    scenarios: z.array(
      z
        .object({
          id: z.string().min(1),
          status: z.enum(["pass", "fail", "blocked"]),
          evidence: z.string().min(1),
        })
        .strict(),
    ),
    limitations: z.array(
      z
        .object({
          id: z.string().min(1),
          reason: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

type LocalAdapterRun = z.infer<typeof LocalAdapterRunSchema>;

function validateLocalAdapterRun(run: LocalAdapterRun): Finding[] {
  const findings: Finding[] = [];
  if (run.schemaVersion !== 1 || run.scope !== "local-production-adapters") {
    findings.push({
      severity: "high",
      message: "Local adapter evidence has an unsupported schema or scope.",
    });
  }
  const scenarioIds = new Set(run.scenarios.map((scenario) => scenario.id));
  for (const scenarioId of REQUIRED_SCENARIOS) {
    if (!scenarioIds.has(scenarioId)) {
      findings.push({
        severity: "high",
        message: `Local adapter evidence is missing scenario: ${scenarioId}`,
      });
    }
  }
  const seenScenarioIds = new Set<string>();
  for (const scenario of run.scenarios) {
    if (seenScenarioIds.has(scenario.id)) {
      findings.push({
        severity: "high",
        message: `Local adapter evidence duplicates scenario: ${scenario.id}`,
      });
    }
    seenScenarioIds.add(scenario.id);
    if (
      !REQUIRED_SCENARIOS.includes(
        scenario.id as (typeof REQUIRED_SCENARIOS)[number],
      )
    ) {
      findings.push({
        severity: "medium",
        message: `Local adapter evidence has unknown scenario: ${scenario.id}`,
      });
    }
    if (scenario.status === "fail") {
      findings.push({
        severity: "high",
        message: `Local adapter scenario failed: ${scenario.id}`,
      });
    }
    if (!scenario.evidence) {
      findings.push({
        severity: "high",
        message: `Local adapter scenario lacks evidence text: ${scenario.id}`,
      });
    }
  }
  return findings;
}

type LocalAdapterEvidence = {
  run: LocalAdapterRun | null;
  findings: Finding[];
};

async function collectLocalAdapterEvidence(): Promise<LocalAdapterEvidence> {
  try {
    const raw = await readFile(
      path.join(EVIDENCE_ROOT, "local-adapter-scenarios.json"),
      "utf8",
    );
    const parsed = LocalAdapterRunSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) =>
        issue.path.length > 0 ? issue.path.join(".") : "<root>",
      );
      return {
        run: null,
        findings: [
          {
            severity: "critical",
            message: `Local adapter evidence has an invalid schema at ${paths.join(", ")}`,
          },
        ],
      };
    }
    return {
      run: parsed.data,
      findings: validateLocalAdapterRun(parsed.data),
    };
  } catch (error) {
    return {
      run: null,
      findings: [
        {
          severity: "high",
          message: `Local adapter evidence is unreadable: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(path.resolve(relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readGateRecord(): Promise<GateRecord> {
  const raw = await readFile(GATE_RECORD_PATH, "utf8");
  const parsed = GateRecordSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) =>
      issue.path.length > 0 ? issue.path.join(".") : "<root>",
    );
    throw new Error(
      `CRITICAL: Invalid EH-154 release-gate.json schema at ${paths.join(", ")}`,
    );
  }
  return parsed.data;
}
function validateReadyPrivacyEvidence(
  record: GateRecord,
  privacySignoffText: string,
): Finding[] {
  if (record.gateStatus === "blocked") return [];

  const findings: Finding[] = [];
  const lines = privacySignoffText.split(/\r?\n/u);
  const sectionLines = (heading: string): string[] => {
    const headingIndex = lines.findIndex((line) => line.trim() === heading);
    if (headingIndex < 0) return [];
    const nextHeadingIndex = lines.findIndex(
      (line, index) => index > headingIndex && /^##\s/u.test(line),
    );
    return lines.slice(
      headingIndex,
      nextHeadingIndex >= 0 ? nextHeadingIndex : lines.length,
    );
  };
  const requiredPackageLines = sectionLines("## Required release package");
  const signoffLines = sectionLines("## Sign-off decision");
  const readField = (label: string): string | null => {
    const marker = `**${label}:**`;
    const matchingLines = lines.filter((candidate) =>
      candidate.includes(marker),
    );
    if (matchingLines.length !== 1) return null;
    return matchingLines[0]
      .slice(matchingLines[0].indexOf(marker) + marker.length)
      .trim();
  };
  const metadata: Array<[string, string | null]> = [
    ["Gate status", record.gateStatus],
    ["Reviewed build / commit", record.reviewedBuild],
    [
      "Reviewed deployment configuration reference or digest",
      record.reviewedDeployment,
    ],
    ["Evidence package owner", record.evidenceOwner],
    ["Privacy approver", null],
    ["Decision date", null],
  ];
  for (const [label, expected] of metadata) {
    const value = readField(label);
    const normalizedValue = value?.replace(/^`|`$/gu, "").trim();
    if (
      !normalizedValue ||
      /(?:_pending_|`?PENDING`?)/iu.test(normalizedValue)
    ) {
      findings.push({
        severity: "high",
        message: `Privacy sign-off metadata is missing or pending: ${label}`,
      });
    } else if (expected && normalizedValue !== expected) {
      findings.push({
        severity: "high",
        message: `Privacy sign-off metadata does not match the gate record: ${label}`,
      });
    }
  }
  const requiredSecretNames = [
    "SHARE_RATE_LIMIT_PEPPER",
    "SHARE_PIN_PROOF_PEPPER",
    "SHARE_TRUSTED_PROXY_ATTESTATION_KEY",
  ] as const;
  const seenSecretNames = new Set<string>();
  for (const entry of record.requiredSecretReferences) {
    if (
      !requiredSecretNames.includes(
        entry.name as (typeof requiredSecretNames)[number],
      )
    ) {
      findings.push({
        severity: "high",
        message: `Unknown secret reference entry: ${entry.name}`,
      });
      continue;
    }
    if (seenSecretNames.has(entry.name)) {
      findings.push({
        severity: "high",
        message: `Duplicate secret reference entry: ${entry.name}`,
      });
    }
    seenSecretNames.add(entry.name);
    const reference = [entry.reference, entry.fingerprint].find((value) => {
      const normalized = value?.trim() ?? "";
      return (
        normalized.length > 0 &&
        !SECRET_PLACEHOLDER_PATTERN.test(normalized) &&
        (SECRET_REFERENCE_PATTERN.test(normalized) ||
          SECRET_FINGERPRINT_PATTERN.test(normalized))
      );
    });
    if (!reference) {
      findings.push({
        severity: "high",
        message: `Secret reference or fingerprint is missing or malformed: ${entry.name}`,
      });
    } else {
      const matchingRows = requiredPackageLines.filter((line) => {
        const cells = line.split("|").map((cell) => cell.trim());
        return cells[1]?.replace(/`/gu, "") === entry.name;
      });
      const signoffReference =
        matchingRows.length === 1
          ? matchingRows[0].split("|")[2]?.replace(/`/gu, "").trim()
          : null;
      if (signoffReference !== reference) {
        findings.push({
          severity: "high",
          message: `Privacy sign-off reference does not match the gate record: ${entry.name}`,
        });
      }
    }
  }
  for (const name of requiredSecretNames) {
    if (!seenSecretNames.has(name)) {
      findings.push({
        severity: "high",
        message: `Required secret reference is missing: ${name}`,
      });
    }
  }
  for (const marker of [
    "## Required release package",
    "Final share scope matrix",
    "Access-event field list and retention decision",
    "Token storage proof",
    "PIN/proof storage proof",
    "Secret-manager references",
    "SHARE_TRUSTED_PROXY_CIDRS",
    "SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS",
    "SHARE_RATE_LIMIT_WINDOW_SECONDS",
    "SHARE_RATE_LIMIT_TOKEN_FAILURES",
    "SHARE_RATE_LIMIT_REQUESTER_FAILURES",
    "SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS",
    "SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS",
    "SHARE_PIN_PROOF_TTL_SECONDS",
    "SHARE_ACCESS_EVENT_RETENTION_DAYS",
    "Trusted-ingress artifact",
    "Shared Postgres rate-limit storage",
    "Access-event, rate-limit-bucket, and expired-proof cleanup schedules",
    "Durable document tombstone/report invalidation/final-purge handoff",
    "Focused route, header, event, rate-limit, key-rotation, and raw-download evidence",
    "Incident runbook is reviewed",
    "## Deployment prerequisites",
    "## Sign-off decision",
  ]) {
    if (!privacySignoffText.includes(marker)) {
      findings.push({
        severity: "high",
        message: `Privacy sign-off record is missing required evidence section: ${marker}`,
      });
    }
  }
  const requiredPrivacyRows = [
    "Final share scope matrix",
    "Access-event field list and retention decision",
    "Token storage proof",
    "PIN/proof storage proof",
    "SHARE_TRUSTED_PROXY_CIDRS",
    "SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS",
    "SHARE_RATE_LIMIT_WINDOW_SECONDS",
    "SHARE_RATE_LIMIT_TOKEN_FAILURES",
    "SHARE_RATE_LIMIT_REQUESTER_FAILURES",
    "SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS",
    "SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS",
    "SHARE_PIN_PROOF_TTL_SECONDS",
    "SHARE_ACCESS_EVENT_RETENTION_DAYS",
  ];
  for (const label of requiredPrivacyRows) {
    const matchingRows = requiredPackageLines.filter((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      return cells[1]?.replace(/`/gu, "") === label;
    });
    const value =
      matchingRows.length === 1
        ? matchingRows[0].split("|")[2]?.replace(/`/gu, "").trim()
        : null;
    if (!value || SECRET_PLACEHOLDER_PATTERN.test(value)) {
      findings.push({
        severity: "high",
        message: `Privacy sign-off evidence is missing or placeholder: ${label}`,
      });
    }
  }
  const privacyOwnerRows = signoffLines.filter((line) =>
    /^\|\s*Privacy owner\s*\|/u.test(line),
  );
  const privacyDecision =
    privacyOwnerRows.length === 1
      ? privacyOwnerRows[0]
          .split("|")[2]
          ?.replace(/`/gu, "")
          .trim()
          .toUpperCase()
      : null;
  if (privacyDecision !== "APPROVED") {
    findings.push({
      severity: "high",
      message:
        "Privacy owner decision must contain exactly one Sign-off decision row with APPROVED.",
    });
  }
  if (/- \[ \]/u.test(privacySignoffText)) {
    findings.push({
      severity: "high",
      message:
        "Privacy sign-off record contains unchecked release requirements.",
    });
  }
  if (/\b(?:PENDING|BLOCKED|PARTIAL)\b/iu.test(privacySignoffText)) {
    findings.push({
      severity: "high",
      message:
        "Privacy sign-off record still contains pending or blocked evidence.",
    });
  }
  return findings;
}

function containsSensitiveJsonValue(
  value: unknown,
  key = "",
  contextKey = "",
): boolean {
  const sensitiveKeyPattern =
    /(?:authorization|bearer|token|pin|proof|cookie|SHARE_RATE_LIMIT_PEPPER|SHARE_PIN_PROOF_PEPPER|SHARE_TRUSTED_PROXY_ATTESTATION_KEY)/iu;
  const sensitiveContext =
    key !== "name" &&
    (sensitiveKeyPattern.test(key) || sensitiveKeyPattern.test(contextKey));

  if (typeof value === "string") {
    const normalized = value.trim();
    if (
      SHARE_TOKEN_PATTERN.test(normalized) ||
      PUBLIC_SHARE_URL_PATTERN.test(normalized)
    ) {
      return true;
    }
    const isReferenceField = /^(?:reference|fingerprint)$/iu.test(key);
    const isApprovedReference =
      SECRET_REFERENCE_PATTERN.test(normalized) ||
      SECRET_FINGERPRINT_PATTERN.test(normalized);
    return (
      sensitiveContext &&
      !SECRET_PLACEHOLDER_PATTERN.test(normalized) &&
      !(isReferenceField && isApprovedReference)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) =>
      containsSensitiveJsonValue(item, key, contextKey),
    );
  }
  if (value !== null && typeof value === "object") {
    const valueWithName = value as { name?: unknown };
    const namedContext =
      typeof valueWithName.name === "string" ? valueWithName.name : contextKey;
    return Object.entries(value).some(([childKey, childValue]) =>
      containsSensitiveJsonValue(childValue, childKey, namedContext),
    );
  }
  return false;
}
function containsUnapprovedNamedSecret(text: string): boolean {
  for (const match of text.matchAll(NAMED_SECRET_ASSIGNMENT_PATTERN)) {
    const value = match[1];
    if (
      value &&
      !SECRET_PLACEHOLDER_PATTERN.test(value) &&
      !SECRET_REFERENCE_PATTERN.test(value) &&
      !SECRET_FINGERPRINT_PATTERN.test(value)
    ) {
      return true;
    }
  }
  return false;
}

async function collectEvidenceFindings(record: GateRecord): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const file of REQUIRED_EVIDENCE_FILES) {
    if (!(await exists(path.join(EVIDENCE_ROOT, file)))) {
      findings.push({
        severity: "high",
        message: `Missing required evidence file: ${file}`,
      });
    }
  }

  const ingressArtifact =
    "openspec/changes/eh-151-scoped-expiring-share-links/deployment/trusted-ingress.yaml";
  if (!(await exists(ingressArtifact))) {
    findings.push({
      severity: "high",
      message: `Missing trusted-ingress artifact: ${ingressArtifact}`,
    });
  }

  for (const surface of PRODUCTION_SURFACES) {
    const missing = [] as string[];
    for (const relativePath of surface.paths) {
      if (!(await exists(relativePath))) missing.push(relativePath);
    }
    if (missing.length > 0) {
      findings.push({
        severity: "high",
        message: `${surface.id} is unavailable; missing: ${missing.join(", ")}`,
      });
    }
  }

  const evidenceText = await Promise.all(
    REQUIRED_EVIDENCE_FILES.map((file) =>
      readFile(path.join(EVIDENCE_ROOT, file), "utf8").catch(() => ""),
    ),
  );
  const combinedEvidence = evidenceText.join("\n");
  const secretValuePatterns = [
    /["'`]?(?:authorization|bearer|token|pin|proof|cookie)["'`]?\s*[:=]\s*["'`]?(?!\b(?:pending|reference|fingerprint|version|redacted|none|null|omitted|never)\b)[A-Za-z0-9._+/=-]{4,}/iu,
    /\bPIN\s+(?:(?:is|was)\s+)?(?:[`'"]\s*)?\d{4,}(?:\s*[`'"])?/iu,
    /\b(?:proof|cookie)\s+(?:(?:is|was)\s+)?(?:`[^`\r\n]+`|<[^>\r\n]+>)|\b(?:bearer|authorization)\s+(?:(?:is|was)\s+)?(?!(?:header|fields?|path|policy|request|response|context|metadata|token|secret|secrets|link|data|body|value|scope|route|failure|issuance)\b)(?:`[^`\r\n]+`|<[^>\r\n]+>|[A-Za-z0-9][A-Za-z0-9._+/=-]{7,})/iu,
  ];
  let jsonSecretFound = false;
  for (const [index, file] of REQUIRED_EVIDENCE_FILES.entries()) {
    if (!file.endsWith(".json")) continue;
    try {
      if (containsSensitiveJsonValue(JSON.parse(evidenceText[index]), file)) {
        jsonSecretFound = true;
      }
    } catch {
      findings.push({
        severity: "critical",
        message: `Evidence JSON cannot be parsed: ${file}`,
      });
    }
  }
  const shareCredentialFound =
    SHARE_TOKEN_PATTERN.test(combinedEvidence) ||
    PUBLIC_SHARE_URL_PATTERN.test(combinedEvidence);
  const namedSecretFound = containsUnapprovedNamedSecret(combinedEvidence);
  if (
    jsonSecretFound ||
    shareCredentialFound ||
    namedSecretFound ||
    secretValuePatterns.some((pattern) => pattern.test(combinedEvidence))
  ) {
    findings.push({
      severity: "critical",
      message: "Evidence files contain a possible secret or bearer value.",
    });
  }
  const privacySignoffText =
    evidenceText[REQUIRED_EVIDENCE_FILES.indexOf("privacy-signoff.md")] ?? "";
  findings.push(...validateReadyPrivacyEvidence(record, privacySignoffText));

  return findings;
}

type ReviewedScenarioResult = {
  status: ScenarioStatus;
  evidence: string;
};

type ReviewedScenarioResults = {
  hasSection: boolean;
  statuses: ReadonlyMap<string, ReviewedScenarioResult>;
  duplicateIds: ReadonlySet<string>;
};

function markdownSectionLines(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/u);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex < 0) return [];
  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && /^##\s/u.test(line),
  );
  return lines.slice(
    headingIndex,
    nextHeadingIndex >= 0 ? nextHeadingIndex : lines.length,
  );
}

function parseReviewedScenarioResults(
  releaseRecordText: string,
): ReviewedScenarioResults {
  const sectionLines = markdownSectionLines(
    releaseRecordText,
    "## Machine-readable scenario evidence",
  );
  const statuses = new Map<string, ReviewedScenarioResult>();
  const duplicateIds = new Set<string>();
  const rowPattern =
    /^\|\s*`?([a-z0-9-]+)`?\s*\|\s*`?(PASS|FAIL|BLOCKED|NOT-RUN)`?\s*\|\s*(.*?)\s*\|/iu;
  for (const line of sectionLines) {
    const match = rowPattern.exec(line);
    if (!match) continue;
    const scenarioId = match[1];
    if (statuses.has(scenarioId)) duplicateIds.add(scenarioId);
    statuses.set(scenarioId, {
      status: match[2].toLowerCase() as ScenarioStatus,
      evidence: match[3].replace(/`/gu, "").trim(),
    });
  }
  return {
    hasSection: sectionLines.length > 0,
    statuses,
    duplicateIds,
  };
}

function validateReleaseRecord(
  record: GateRecord,
  releaseRecordText: string,
  reviewedScenarioResults: ReviewedScenarioResults,
): Finding[] {
  if (record.gateStatus === "blocked") return [];

  const findings: Finding[] = [];
  const lines = releaseRecordText.split(/\r?\n/u);
  const readUniqueField = (label: string): string | null => {
    const marker = `**${label}:**`;
    const matchingLines = lines.filter((line) => line.includes(marker));
    if (matchingLines.length !== 1) return null;
    return matchingLines[0]
      .slice(matchingLines[0].indexOf(marker) + marker.length)
      .replace(/`/gu, "")
      .trim();
  };
  const metadata: Array<[string, string | null]> = [
    ["Gate status", record.gateStatus],
    ["Reviewed build / commit", record.reviewedBuild],
    ["Reviewed deployment", record.reviewedDeployment],
    ["Evidence owner", record.evidenceOwner],
  ];
  for (const [label, expected] of metadata) {
    const actual = readUniqueField(label);
    if (!expected || !actual || actual !== expected) {
      findings.push({
        severity: "high",
        message: `Release record metadata is missing or does not match the gate: ${label}`,
      });
    }
  }
  if (!reviewedScenarioResults.hasSection) {
    findings.push({
      severity: "high",
      message: "Release record is missing machine-readable scenario evidence.",
    });
  }
  for (const scenarioId of REQUIRED_SCENARIOS) {
    if (reviewedScenarioResults.duplicateIds.has(scenarioId)) {
      findings.push({
        severity: "high",
        message: `Release record duplicates scenario evidence: ${scenarioId}`,
      });
    }
    const reviewedResult = reviewedScenarioResults.statuses.get(scenarioId);
    if (reviewedResult?.status !== "pass") {
      findings.push({
        severity: "high",
        message: `Release record does not contain a passing result for scenario: ${scenarioId}`,
      });
    } else if (
      !reviewedResult.evidence ||
      SECRET_PLACEHOLDER_PATTERN.test(reviewedResult.evidence) ||
      !REVIEWED_EVIDENCE_REFERENCE_PATTERN.test(reviewedResult.evidence)
    ) {
      findings.push({
        severity: "high",
        message: `Release record has no reviewed evidence reference for scenario: ${scenarioId}`,
      });
    }
  }
  const commandSection = markdownSectionLines(
    releaseRecordText,
    "## Commands executed for this package",
  );
  if (commandSection.length === 0) {
    findings.push({
      severity: "high",
      message: "Release record is missing the executed-command section.",
    });
  }
  for (const command of record.commands) {
    const matchingCommandRows = commandSection.filter((line) =>
      line.includes(`\`${command.command}\``),
    );
    const result =
      matchingCommandRows.length === 1
        ? matchingCommandRows[0]
            .split("|")[2]
            ?.replace(/`/gu, "")
            .trim()
            .toUpperCase()
        : null;
    if (matchingCommandRows.length !== 1 || result !== "PASS") {
      findings.push({
        severity: "high",
        message: `Release record command is missing, duplicated, or not passed: ${command.command}`,
      });
    }
  }
  const blockingFindingRows = markdownSectionLines(
    releaseRecordText,
    "## Blocking findings",
  ).filter((line) => /^\|\s*EH154-F-\d+\s*\|/u.test(line));
  const blockingFindings = blockingFindingRows.map((line) => {
    const cells = line.split("|").map((cell) => cell.replace(/`/gu, "").trim());
    return {
      id: cells[1] ?? "",
      status: cells[3]?.toUpperCase() ?? "",
      closureEvidence: cells[5] ?? "",
    };
  });
  for (const finding of record.findings.filter((item) =>
    ["high", "critical"].includes(item.severity),
  )) {
    const matchingRows = blockingFindings.filter(
      (row) => row.id === finding.id,
    );
    const closure = matchingRows[0]?.closureEvidence ?? "";
    if (
      matchingRows.length !== 1 ||
      finding.status !== "resolved" ||
      matchingRows[0]?.status !== "RESOLVED" ||
      !REVIEWED_EVIDENCE_REFERENCE_PATTERN.test(closure) ||
      SECRET_PLACEHOLDER_PATTERN.test(closure)
    ) {
      findings.push({
        severity: "high",
        message: `Release record lacks one resolved closure-evidence row for finding: ${finding.id}`,
      });
    }
  }
  for (const row of blockingFindings) {
    if (!record.findings.some((finding) => finding.id === row.id)) {
      findings.push({
        severity: "high",
        message: `Release record contains an unknown blocking finding: ${row.id}`,
      });
    }
  }
  if (/\b(?:PENDING|BLOCKED|PARTIAL)\b/iu.test(releaseRecordText)) {
    findings.push({
      severity: "high",
      message:
        "Release record still contains pending, blocked, or partial evidence.",
    });
  }
  return findings;
}

async function isCommitObject(commit: string | null): Promise<boolean> {
  if (!commit || !/^[0-9a-f]{7,64}$/iu.test(commit)) return false;
  try {
    await execFileAsync("git", ["cat-file", "-e", `${commit}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

async function reviewedSourceMatchesCurrent(
  reviewedBuild: string,
  currentCommit: string,
): Promise<boolean> {
  const reviewedPaths = [
    ...PRODUCTION_SURFACES.flatMap((surface) => surface.paths),
    "openspec/changes/eh-151-scoped-expiring-share-links/deployment/trusted-ingress.yaml",
  ];
  try {
    await execFileAsync("git", [
      "diff",
      "--quiet",
      reviewedBuild,
      currentCommit,
      "--",
      ...reviewedPaths,
    ]);
    return true;
  } catch {
    return false;
  }
}

async function validateReviewedBuild(
  record: GateRecord,
  localAdapterRun: LocalAdapterRun | null,
): Promise<Finding[]> {
  if (record.gateStatus === "blocked" || !localAdapterRun) return [];

  const findings: Finding[] = [];
  if (
    !record.reviewedBuild ||
    !localAdapterRun.reviewedBuild ||
    record.reviewedBuild !== localAdapterRun.reviewedBuild
  ) {
    findings.push({
      severity: "high",
      message:
        "Local adapter evidence must match one immutable reviewed build commit.",
    });
    return findings;
  }
  if (!(await isCommitObject(record.reviewedBuild))) {
    findings.push({
      severity: "high",
      message: "The reviewed build is not a resolvable commit object.",
    });
    return findings;
  }
  const currentCommit = await getCurrentCommit();
  if (
    !currentCommit ||
    !(await reviewedSourceMatchesCurrent(record.reviewedBuild, currentCommit))
  ) {
    findings.push({
      severity: "high",
      message:
        "Reviewed production source differs from the immutable build used for adapter evidence.",
    });
  }
  return findings;
}

function validateRecord(
  record: GateRecord,
  localAdapterRun: LocalAdapterRun | null,
  reviewedScenarioResults: ReviewedScenarioResults,
): Finding[] {
  const findings: Finding[] = [];
  const recordedScenarioIds = new Set(
    record.scenarios.map((scenario) => scenario.id),
  );

  for (const scenarioId of REQUIRED_SCENARIOS) {
    if (!recordedScenarioIds.has(scenarioId)) {
      findings.push({
        severity: "high",
        message: `Missing required scenario result: ${scenarioId}`,
      });
    }
  }

  for (const scenario of record.scenarios) {
    if (
      !REQUIRED_SCENARIOS.includes(
        scenario.id as (typeof REQUIRED_SCENARIOS)[number],
      )
    ) {
      findings.push({
        severity: "medium",
        message: `Unknown scenario is recorded: ${scenario.id}`,
      });
    }
    if (scenario.status !== "pass") {
      findings.push({
        severity: "high",
        message: `Scenario ${scenario.id} is ${scenario.status}, not pass.`,
      });
    }
    const evidenceReference = scenario.evidence?.trim();
    if (!evidenceReference) {
      findings.push({
        severity: "high",
        message: `Scenario ${scenario.id} has no evidence reference.`,
      });
    } else {
      const [evidenceFile, evidenceAnchor] = evidenceReference
        .split("#", 2)
        .map((part) => part.replace(/^evidence\//u, ""));
      if (
        !REQUIRED_EVIDENCE_FILES.includes(
          evidenceFile as (typeof REQUIRED_EVIDENCE_FILES)[number],
        )
      ) {
        findings.push({
          severity: "high",
          message: `Scenario ${scenario.id} references unavailable evidence: ${evidenceReference}`,
        });
      }
      if (record.gateStatus !== "blocked" && scenario.status === "pass") {
        const isLocalAdapterEvidence =
          evidenceFile === "local-adapter-scenarios.json";
        const isReviewedReleaseEvidence = evidenceFile === "release-record.md";
        if (
          evidenceAnchor !== scenario.id ||
          (!isLocalAdapterEvidence && !isReviewedReleaseEvidence)
        ) {
          findings.push({
            severity: "high",
            message: `Scenario ${scenario.id} requires an anchored local adapter or reviewed release result.`,
          });
        } else if (isLocalAdapterEvidence) {
          const adapterScenario = localAdapterRun?.scenarios.find(
            (result) => result.id === scenario.id,
          );
          if (!adapterScenario || adapterScenario.status !== "pass") {
            findings.push({
              severity: "high",
              message: `Scenario ${scenario.id} is not backed by a passing local adapter result.`,
            });
          }
        } else {
          const reviewedResult = reviewedScenarioResults.statuses.get(
            scenario.id,
          );
          if (
            reviewedResult?.status !== "pass" ||
            !reviewedResult.evidence ||
            SECRET_PLACEHOLDER_PATTERN.test(reviewedResult.evidence) ||
            !REVIEWED_EVIDENCE_REFERENCE_PATTERN.test(reviewedResult.evidence)
          ) {
            findings.push({
              severity: "high",
              message: `Scenario ${scenario.id} is not backed by a passing reviewed release result.`,
            });
          }
          const adapterScenario = localAdapterRun?.scenarios.find(
            (result) => result.id === scenario.id,
          );
          if (adapterScenario?.status === "fail") {
            findings.push({
              severity: "high",
              message: `Scenario ${scenario.id} has a failing supplemental local adapter result.`,
            });
          }
        }
      }
    }
  }

  for (const finding of record.findings) {
    if (finding.status !== "open") continue;
    if (
      ["high", "critical"].includes(finding.severity) ||
      record.gateStatus === "ready"
    ) {
      findings.push({
        severity: finding.severity === "critical" ? "critical" : "high",
        message: `${finding.id} remains open: ${finding.summary}`,
      });
      continue;
    }
    if (
      record.gateStatus === "ready-with-risk" &&
      ["low", "medium"].includes(finding.severity) &&
      !record.residualRisks.some((risk) => risk.id === finding.id)
    ) {
      findings.push({
        severity: "high",
        message: `Open finding ${finding.id} is not represented by a residual risk.`,
      });
    }
  }

  if (!record.reviewedBuild) {
    findings.push({
      severity: "high",
      message: "No reviewed build or commit is recorded.",
    });
  }
  if (!record.reviewedDeployment) {
    findings.push({
      severity: "high",
      message: "No reviewed deployment configuration is recorded.",
    });
  }
  if (!record.evidenceOwner) {
    findings.push({
      severity: "high",
      message: "No evidence owner is recorded.",
    });
  }
  if (!record.privacySignOff) {
    findings.push({
      severity: "high",
      message: "Privacy sign-off is not recorded.",
    });
  }
  if (record.gateStatus !== "blocked") {
    if (!Array.isArray(record.commands) || record.commands.length === 0) {
      findings.push({
        severity: "high",
        message: "Ready gate requires executed command evidence.",
      });
    }
    for (const command of record.commands ?? []) {
      if (!command.command || command.status !== "pass") {
        findings.push({
          severity: "high",
          message: `Gate command is missing or not passed: ${command.command || "<unnamed>"}`,
        });
      }
    }
    if (!localAdapterRun) {
      findings.push({
        severity: "high",
        message: "Releasable gate has no parsed local adapter evidence.",
      });
    } else {
      if (localAdapterRun.reviewedBuild !== record.reviewedBuild) {
        findings.push({
          severity: "high",
          message: "Local adapter evidence does not match the reviewed build.",
        });
      }
      if (localAdapterRun.reviewedDeployment !== record.reviewedDeployment) {
        findings.push({
          severity: "high",
          message:
            "Local adapter evidence does not match the reviewed deployment.",
        });
      }
    }
  }

  if (record.gateStatus === "ready" && record.residualRisks.length > 0) {
    findings.push({
      severity: "high",
      message: "Ready gate cannot contain residual risks.",
    });
  }
  if (
    record.gateStatus === "ready-with-risk" &&
    record.residualRisks.length === 0
  ) {
    findings.push({
      severity: "high",
      message: "Ready-with-risk gate requires documented residual risks.",
    });
  }
  for (const risk of record.residualRisks) {
    const [year, month, day] = risk.expiresOn.split("-").map(Number);
    const expiryDate = new Date(Date.UTC(year, month - 1, day));
    const calendarDateIsValid =
      expiryDate.getUTCFullYear() === year &&
      expiryDate.getUTCMonth() === month - 1 &&
      expiryDate.getUTCDate() === day;
    const expiryMs = expiryDate.getTime();
    const expiryInvalid =
      !calendarDateIsValid ||
      !Number.isFinite(expiryMs) ||
      (record.gateStatus === "ready-with-risk" && expiryMs <= Date.now());
    if (!risk.owner.trim() || expiryInvalid) {
      findings.push({
        severity: "high",
        message: `Residual risk ${risk.id} lacks a valid future expiry or owner.`,
      });
    }
  }

  const highOrCritical = findings.some((finding) =>
    ["high", "critical"].includes(finding.severity),
  );
  if (highOrCritical && record.gateStatus !== "blocked") {
    findings.push({
      severity: "critical",
      message:
        "Gate status must be blocked while high or critical findings remain.",
    });
  }

  return findings;
}

async function main(): Promise<void> {
  const record = await readGateRecord();
  const localAdapterEvidence = await collectLocalAdapterEvidence();
  const releaseRecordText = await readFile(
    path.join(EVIDENCE_ROOT, "release-record.md"),
    "utf8",
  ).catch(() => "");
  const reviewedScenarioResults =
    parseReviewedScenarioResults(releaseRecordText);
  const findings = [
    ...(await collectEvidenceFindings(record)),
    ...localAdapterEvidence.findings,
    ...(await validateReviewedBuild(record, localAdapterEvidence.run)),
    ...validateReleaseRecord(
      record,
      releaseRecordText,
      reviewedScenarioResults,
    ),
    ...validateRecord(
      record,
      localAdapterEvidence.run,
      reviewedScenarioResults,
    ),
  ];

  console.log(`verify-eh154-share-privacy: ${record.gateStatus}`);
  for (const finding of findings) {
    console.log(`${finding.severity.toUpperCase()}: ${finding.message}`);
  }

  const releasable =
    record.gateStatus === "ready" || record.gateStatus === "ready-with-risk";
  if (!releasable || findings.length > 0) {
    throw new Error(
      `EH-154 release gate is not ready; ${findings.length} blocking or incomplete finding(s) recorded`,
    );
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "EH-154 verification failed",
  );
  process.exitCode = 1;
});
