import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

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
] as const;

const REQUIRED_SCENARIOS = [
  "invalid-token",
  "expired-token",
  "revoked-token",
  "pin-failed",
  "cross-profile-report",
  "out-of-scope-document",
  "allowed-report",
  "denied-raw-document",
  "cache-index-referrer-policy",
  "event-redaction",
  "rate-limit-token-dimension",
  "rate-limit-requester-dimension",
  "rate-limit-store-unavailable",
  "trusted-ingress-direct-origin",
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
    requiredSecretReferences: z.array(z.string()),
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
          expiresOn: z.string(),
          summary: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

type LocalAdapterRun = {
  schemaVersion: number;
  scope: "local-production-adapters";
  command: string;
  scenarios: Array<{
    id: string;
    status: "pass" | "fail" | "blocked";
    evidence: string;
  }>;
};

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
  for (const scenario of run.scenarios) {
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

async function collectLocalAdapterFindings(): Promise<Finding[]> {
  try {
    const raw = await readFile(
      path.join(EVIDENCE_ROOT, "local-adapter-scenarios.json"),
      "utf8",
    );
    return validateLocalAdapterRun(JSON.parse(raw) as LocalAdapterRun);
  } catch (error) {
    return [
      {
        severity: "high",
        message: `Local adapter evidence is unreadable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ];
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
  const readField = (label: string): string | null => {
    const marker = `**${label}:**`;
    const line = lines.find((candidate) => candidate.includes(marker));
    return line
      ? line.slice(line.indexOf(marker) + marker.length).trim()
      : null;
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
  for (const label of [
    "Secret-manager references",
    "SHARE_ACCESS_EVENT_RETENTION_DAYS",
    "Sign-off decision",
  ]) {
    if (!privacySignoffText.includes(label)) {
      findings.push({
        severity: "high",
        message: `Privacy sign-off record is missing required evidence label: ${label}`,
      });
    }
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
      readFile(path.join(EVIDENCE_ROOT, file), "utf8"),
    ),
  );
  const combinedEvidence = evidenceText.join("\n");
  const secretValuePatterns = [
    /(?:SHARE_RATE_LIMIT_PEPPER|SHARE_PIN_PROOF_PEPPER|SHARE_TRUSTED_PROXY_ATTESTATION_KEY)\s*[:=]\s*(?!["'`]?<(?:reference|fingerprint|version)[^>]*>)(?!["'`]?\b(?:pending|reference|fingerprint|version)\b)["'`]?[A-Za-z0-9+/=_-]{24,}/iu,
    /(?:bearer|token|pin|proof)\s*[:=]\s*[A-Za-z0-9._-]{24,}/iu,
  ];
  if (secretValuePatterns.some((pattern) => pattern.test(combinedEvidence))) {
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

function validateRecord(record: GateRecord): Finding[] {
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
    if (!scenario.evidence?.trim()) {
      findings.push({
        severity: "high",
        message: `Scenario ${scenario.id} has no evidence reference.`,
      });
    }
  }

  for (const finding of record.findings) {
    if (
      finding.status === "open" &&
      ["high", "critical"].includes(finding.severity)
    ) {
      findings.push({
        severity: finding.severity,
        message: `${finding.id} remains open: ${finding.summary}`,
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
    if (!risk.owner || !risk.expiresOn) {
      findings.push({
        severity: "high",
        message: `Residual risk ${risk.id} lacks an owner or expiry.`,
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
  const findings = [
    ...(await collectEvidenceFindings(record)),
    ...(await collectLocalAdapterFindings()),
    ...validateRecord(record),
  ];

  console.log(`verify-eh154-share-privacy: ${record.gateStatus}`);
  for (const finding of findings) {
    console.log(`${finding.severity.toUpperCase()}: ${finding.message}`);
  }

  if (record.gateStatus === "blocked" || findings.length > 0) {
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
