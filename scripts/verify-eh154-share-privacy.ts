import { createHash } from "node:crypto";
import { access, lstat, readdir, realpath, readFile } from "node:fs/promises";
import path from "node:path";
import { isIP } from "node:net";
import { parseCanonicalAddress } from "../src/lib/share-links/trusted-ingress-transport";
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
const EVIDENCE_MANIFEST_PATH = path.join(
  EVIDENCE_ROOT,
  "evidence-manifest.json",
);
const GATE_RECORD_PATH = path.join(EVIDENCE_ROOT, "release-gate.json");

const REQUIRED_EVIDENCE_FILES = [
  "threat-model.md",
  "release-controls.md",
  "privacy-signoff.md",
  "incident-runbook.md",
  "release-record.md",
  "local-adapter-scenarios.json",
  "evidence-manifest.json",
  "release-gate.json",
] as const;
const SECRET_REFERENCE_PATTERN =
  /^(?:(?:secret|vault|aws-secretsmanager|gcp-secretmanager|azure-keyvault|keyvault):\/\/[A-Za-z0-9._/-]+(?:[#@]version[=:]?[A-Za-z0-9._-]+)?)$/iu;
const SECRET_FINGERPRINT_PATTERN = /^(?:sha256[:/-])?[A-Fa-f0-9]{64}$/u;
const SECRET_PLACEHOLDER_PATTERN =
  /^(?:_pending_|pending|reference|fingerprint|version|redacted|none|null|unknown|tbd|unassigned|n\/a|omitted|never|ci-placeholder|<[^>]+>)$/iu;
const REVIEWED_EVIDENCE_REFERENCE_PATTERN =
  /^evidence:\/\/([A-Za-z0-9._/-]+)#([A-Za-z0-9._-]+)@sha256:([A-Fa-f0-9]{64})$/u;
const DEPLOYMENT_REFERENCE_PATTERN =
  /^(?:(?:deployment|config|artifact):\/\/[A-Za-z0-9._/-]+#sha256:[A-Fa-f0-9]{64}|sha256:[A-Fa-f0-9]{64})$/iu;
function hasConcreteReference(
  value: string | null | undefined,
): value is string {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 && !SECRET_PLACEHOLDER_PATTERN.test(normalized);
}

function isTrustedCidr(value: string): boolean {
  const [address, prefix] = value.trim().split("/");
  if (
    !address ||
    !prefix ||
    !/^(?:0|[1-9]\d*)$/u.test(prefix) ||
    !parseCanonicalAddress(address)
  ) {
    return false;
  }
  const prefixLength = Number(prefix);
  const family = isIP(address);
  return (
    Number.isInteger(prefixLength) &&
    ((family === 4 && prefixLength <= 32) ||
      (family === 6 && prefixLength <= 128))
  );
}

function isTrustedCidrs(value: string): boolean {
  const cidrs = value.split(",").map((entry) => entry.trim());
  return cidrs.length > 0 && cidrs.every(isTrustedCidr);
}
const PRIVACY_SETTING_RANGES: Record<string, readonly [number, number]> = {
  SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS: [5, 120],
  SHARE_RATE_LIMIT_WINDOW_SECONDS: [10, 300],
  SHARE_RATE_LIMIT_TOKEN_FAILURES: [1, 100],
  SHARE_RATE_LIMIT_REQUESTER_FAILURES: [1, 300],
  SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS: [1, 86_400_000],
  SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS: [1, 86_400_000],
  SHARE_PIN_PROOF_TTL_SECONDS: [60, 3_600],
  SHARE_ACCESS_EVENT_RETENTION_DAYS: [1, 90],
};
const NAMED_SECRET_ASSIGNMENT_PATTERN =
  /(?:^|[|{,\n])\s*["'`]?(?:SHARE_RATE_LIMIT_PEPPER|SHARE_PIN_PROOF_PEPPER|SHARE_TRUSTED_PROXY_ATTESTATION_KEY)["'`]?\s*(?::|=|\bis\b|\bwas\b|\|)\s*["'`]?([^\s"'|,;`]+)["'`]?/giu;
const SHARE_TOKEN_PATTERN =
  /(?:^|[^A-Za-z0-9._~-])v[A-Za-z0-9._~-]{1,32}\.[A-Za-z0-9_-]{43,}(?![A-Za-z0-9_-])/u;
const PUBLIC_SHARE_URL_PATTERN =
  /https?:\/\/[^\s/]+\/(?:api\/)?share\/v[A-Za-z0-9._~-]{1,32}\.[A-Za-z0-9_-]{43,}(?![A-Za-z0-9_-])/iu;

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

const REQUIRED_PRIVACY_ARTIFACT_ANCHORS = {
  "Final share scope matrix": "final-share-scope-matrix",
  "Access-event field list and retention decision":
    "access-event-field-list-retention-decision",
  "Token storage proof": "token-storage-proof",
  "PIN/proof storage proof": "pin-proof-storage-proof",
  "Trusted-ingress artifact": "trusted-ingress-artifact",
  "Shared Postgres rate-limit storage": "shared-postgres-rate-limit-storage",
  "Access-event, rate-limit-bucket, and expired-proof cleanup schedules":
    "access-event-rate-limit-expired-proof-cleanup-schedules",
  "Durable document tombstone/report invalidation/final-purge handoff":
    "durable-document-tombstone-report-invalidation-final-purge-handoff",
  "Focused route, header, event, rate-limit, key-rotation, and raw-download evidence":
    "focused-route-header-event-rate-limit-key-rotation-raw-download-evidence",
  "Incident runbook is reviewed": "incident-runbook-reviewed",
} as const;
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

const EvidenceAnchorSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9._/-]+$/u),
    kind: z.enum(["scenario", "finding", "artifact"]),
    status: z.enum(["pass", "resolved", "reviewed"]),
    reviewedBuild: z.string().regex(/^[0-9a-f]{7,64}$/iu),
    reviewedDeployment: z
      .string()
      .refine(
        (value) => DEPLOYMENT_REFERENCE_PATTERN.test(value),
        "Evidence anchors require an immutable deployment reference.",
      ),
    payload: z.unknown().optional(),
  })
  .strict();

const EvidenceArtifactSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9._/-]+$/u),
    path: z
      .string()
      .min(1)
      .refine(
        (value) =>
          !path.isAbsolute(value) &&
          !value.split(/[\\/]/u).some((segment) => segment === ".."),
        "Evidence artifact paths must remain under the evidence directory.",
      )
      .refine(
        (value) => value.toLowerCase().endsWith(".json"),
        "Evidence artifacts must use the canonical JSON format.",
      ),
    sha256: z.string().regex(/^[A-Fa-f0-9]{64}$/u),
    reviewedBuild: z.string().regex(/^[0-9a-f]{7,64}$/iu),
    reviewedDeployment: z
      .string()
      .refine(
        (value) => DEPLOYMENT_REFERENCE_PATTERN.test(value),
        "Evidence artifacts require an immutable deployment reference.",
      ),
    anchors: z
      .array(z.string().regex(/^[A-Za-z0-9._/-]+$/u))
      .min(1)
      .refine(
        (anchors) => new Set(anchors).size === anchors.length,
        "Evidence artifact anchors must be unique.",
      ),
  })
  .strict();

const EvidenceManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    reviewedBuild: z
      .string()
      .regex(/^[0-9a-f]{7,64}$/iu)
      .nullable(),
    reviewedDeployment: z
      .string()
      .refine(
        (value) => DEPLOYMENT_REFERENCE_PATTERN.test(value),
        "Evidence manifests require an immutable deployment reference.",
      )
      .nullable(),
    artifacts: z.array(EvidenceArtifactSchema),
  })
  .strict();

type EvidenceManifest = z.infer<typeof EvidenceManifestSchema>;
const EvidenceArtifactContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    reviewedBuild: z.string().regex(/^[0-9a-f]{7,64}$/iu),
    reviewedDeployment: z
      .string()
      .refine(
        (value) => DEPLOYMENT_REFERENCE_PATTERN.test(value),
        "Evidence artifacts require an immutable deployment reference.",
      ),
    anchors: z
      .array(EvidenceAnchorSchema)
      .min(1)
      .refine(
        (anchors) =>
          new Set(anchors.map((anchor) => anchor.id)).size === anchors.length,
        "Evidence artifact anchors must be unique.",
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

const JSON_NUMBER_PATTERN =
  /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u;

function skipJsonWhitespace(text: string, start: number): number {
  let index = start;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code !== 9 && code !== 10 && code !== 13 && code !== 32) break;
    index += 1;
  }
  return index;
}

function scanJsonString(text: string, start: number): number {
  if (text[start] !== '"') {
    throw new Error("JSON object keys and string values must be quoted.");
  }
  let index = start + 1;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === 34) return index + 1;
    if (code === 92) {
      index += 1;
      if (index >= text.length) throw new Error("JSON escape is incomplete.");
      if (text[index] === "u") {
        const hex = text.slice(index + 1, index + 5);
        if (!/^[0-9a-f]{4}$/iu.test(hex)) {
          throw new Error("JSON unicode escape is invalid.");
        }
        index += 5;
      } else {
        index += 1;
      }
      continue;
    }
    if (code < 32)
      throw new Error("JSON strings cannot contain control characters.");
    index += 1;
  }
  throw new Error("JSON string is unterminated.");
}

function scanJsonValue(text: string, start: number): number {
  const index = skipJsonWhitespace(text, start);
  const token = text[index];
  if (token === "{") {
    let cursor = skipJsonWhitespace(text, index + 1);
    const keys = new Set<string>();
    if (text[cursor] === "}") return cursor + 1;
    while (cursor < text.length) {
      const keyStart = cursor;
      const keyEnd = scanJsonString(text, keyStart);
      const key = JSON.parse(text.slice(keyStart, keyEnd)) as string;
      if (keys.has(key)) {
        throw new Error(`Duplicate JSON object key: ${key}`);
      }
      keys.add(key);
      cursor = skipJsonWhitespace(text, keyEnd);
      if (text[cursor] !== ":") {
        throw new Error("JSON object member is missing a colon.");
      }
      cursor = scanJsonValue(text, cursor + 1);
      cursor = skipJsonWhitespace(text, cursor);
      if (text[cursor] === "}") return cursor + 1;
      if (text[cursor] !== ",") {
        throw new Error("JSON object member is missing a comma.");
      }
      cursor = skipJsonWhitespace(text, cursor + 1);
      if (text[cursor] === "}") {
        throw new Error("JSON object cannot contain a trailing comma.");
      }
    }
    throw new Error("JSON object is unterminated.");
  }
  if (token === "[") {
    let cursor = skipJsonWhitespace(text, index + 1);
    if (text[cursor] === "]") return cursor + 1;
    while (cursor < text.length) {
      cursor = scanJsonValue(text, cursor);
      cursor = skipJsonWhitespace(text, cursor);
      if (text[cursor] === "]") return cursor + 1;
      if (text[cursor] !== ",") {
        throw new Error("JSON array member is missing a comma.");
      }
      cursor = skipJsonWhitespace(text, cursor + 1);
      if (text[cursor] === "]") {
        throw new Error("JSON array cannot contain a trailing comma.");
      }
    }
    throw new Error("JSON array is unterminated.");
  }
  if (token === '"') return scanJsonString(text, index);
  const primitive = JSON_NUMBER_PATTERN.exec(text.slice(index));
  if (!primitive) throw new Error("JSON value is invalid.");
  return index + primitive[0].length;
}

function parseJsonWithUniqueKeys(raw: string): unknown {
  const end = scanJsonValue(raw, 0);
  if (skipJsonWhitespace(raw, end) !== raw.length) {
    throw new Error("JSON contains trailing content.");
  }
  return JSON.parse(raw);
}

async function collectLocalAdapterEvidence(): Promise<LocalAdapterEvidence> {
  try {
    const raw = await readFile(
      path.join(EVIDENCE_ROOT, "local-adapter-scenarios.json"),
      "utf8",
    );
    const parsed = LocalAdapterRunSchema.safeParse(
      parseJsonWithUniqueKeys(raw),
    );
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

async function evidenceRootsAreTrusted(): Promise<boolean> {
  try {
    const [changeRootStats, evidenceRootStats] = await Promise.all([
      lstat(CHANGE_ROOT),
      lstat(EVIDENCE_ROOT),
    ]);
    return changeRootStats.isDirectory() && evidenceRootStats.isDirectory();
  } catch {
    return false;
  }
}

async function readGateRecord(): Promise<GateRecord> {
  if (!(await evidenceRootsAreTrusted())) {
    throw new Error(
      "CRITICAL: EH-154 change/evidence roots must be regular directories, not symlinks.",
    );
  }
  const raw = await readFile(GATE_RECORD_PATH, "utf8");
  const parsed = GateRecordSchema.safeParse(parseJsonWithUniqueKeys(raw));
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
async function readEvidenceManifest(): Promise<EvidenceManifest | null> {
  try {
    const raw = await readFile(EVIDENCE_MANIFEST_PATH, "utf8");
    const parsed = EvidenceManifestSchema.safeParse(
      parseJsonWithUniqueKeys(raw),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type ParsedEvidenceReference = {
  artifactId: string;
  anchor: string;
  sha256: string;
};

function parseReviewedEvidenceReference(
  reference: string,
): ParsedEvidenceReference | null {
  const match = REVIEWED_EVIDENCE_REFERENCE_PATTERN.exec(reference.trim());
  if (!match) return null;
  return {
    artifactId: match[1],
    anchor: match[2],
    sha256: match[3].toLowerCase(),
  };
}

type EvidenceAnchorExpectation = {
  id?: string;
  kind: "scenario" | "finding" | "artifact";
  status: "pass" | "resolved" | "reviewed";
};

async function resolveEvidenceArtifactPath(
  artifactPath: string,
): Promise<string | null> {
  if (!(await evidenceRootsAreTrusted())) return null;
  try {
    const evidenceRootRealPath = await realpath(EVIDENCE_ROOT);
    const candidateRealPath = await realpath(
      path.resolve(EVIDENCE_ROOT, artifactPath),
    );
    const relativePath = path.relative(evidenceRootRealPath, candidateRealPath);
    if (
      !relativePath ||
      relativePath === ".." ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      return null;
    }
    return candidateRealPath;
  } catch {
    return null;
  }
}
type EvidenceTree = {
  files: string[];
  symlinks: string[];
};

async function enumerateEvidenceTree(
  relativeDirectory = "",
): Promise<EvidenceTree> {
  const entries = await readdir(path.join(EVIDENCE_ROOT, relativeDirectory), {
    withFileTypes: true,
  });
  const tree: EvidenceTree = { files: [], symlinks: [] };
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isSymbolicLink()) {
      tree.symlinks.push(relativePath);
    } else if (entry.isDirectory()) {
      const nested = await enumerateEvidenceTree(relativePath);
      tree.files.push(...nested.files);
      tree.symlinks.push(...nested.symlinks);
    } else if (entry.isFile()) {
      tree.files.push(relativePath);
    }
  }
  return tree;
}

function canonicalJsonValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Evidence JSON cannot contain a non-finite number.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonValue).join(",")}]`;
  }
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJsonValue(objectValue[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Evidence JSON contains an unsupported value.");
}

function canonicalJson(value: unknown): string {
  return `${canonicalJsonValue(value)}\n`;
}

async function verifyReviewedEvidenceReference(
  reference: string,
  manifest: EvidenceManifest | null,
  record: Pick<GateRecord, "reviewedBuild" | "reviewedDeployment">,
  expectation: EvidenceAnchorExpectation,
): Promise<boolean> {
  const parsedReference = parseReviewedEvidenceReference(reference);
  if (
    !parsedReference ||
    !manifest ||
    !record.reviewedBuild ||
    !record.reviewedDeployment ||
    manifest.reviewedBuild !== record.reviewedBuild ||
    manifest.reviewedDeployment !== record.reviewedDeployment
  ) {
    return false;
  }
  const artifact = manifest.artifacts.find(
    (candidate) => candidate.id === parsedReference.artifactId,
  );
  if (
    !artifact ||
    !artifact.anchors.includes(parsedReference.anchor) ||
    artifact.reviewedBuild !== record.reviewedBuild ||
    artifact.reviewedDeployment !== record.reviewedDeployment ||
    artifact.sha256.toLowerCase() !== parsedReference.sha256
  ) {
    return false;
  }
  const resolvedPath = await resolveEvidenceArtifactPath(artifact.path);
  if (!resolvedPath) return false;
  try {
    const contentBytes = await readFile(resolvedPath);
    const parsedJson = parseJsonWithUniqueKeys(contentBytes.toString("utf8"));
    const canonicalBytes = Buffer.from(canonicalJson(parsedJson), "utf8");
    if (!contentBytes.equals(canonicalBytes)) return false;
    const digest = createHash("sha256").update(canonicalBytes).digest("hex");
    if (
      digest !== parsedReference.sha256 ||
      digest !== artifact.sha256.toLowerCase()
    ) {
      return false;
    }
    const parsedContent = EvidenceArtifactContentSchema.safeParse(parsedJson);
    if (!parsedContent.success) return false;
    if (
      parsedContent.data.reviewedBuild !== record.reviewedBuild ||
      parsedContent.data.reviewedDeployment !== record.reviewedDeployment
    ) {
      return false;
    }
    const matchingAnchors = parsedContent.data.anchors.filter(
      (anchor) => anchor.id === parsedReference.anchor,
    );
    if (matchingAnchors.length !== 1) return false;
    const [anchor] = matchingAnchors;
    return (
      (!expectation.id || anchor.id === expectation.id) &&
      anchor.kind === expectation.kind &&
      anchor.status === expectation.status &&
      anchor.reviewedBuild === record.reviewedBuild &&
      anchor.reviewedDeployment === record.reviewedDeployment
    );
  } catch {
    return false;
  }
}

async function validateReadyPrivacyEvidence(
  record: GateRecord,
  privacySignoffText: string,
  evidenceManifest: EvidenceManifest | null,
): Promise<Finding[]> {
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
  let privacyApprover: string | null = null;
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
    if (label === "Privacy approver") privacyApprover = normalizedValue ?? null;
    if (
      !normalizedValue ||
      /(?:_pending_|`?PENDING`?)/iu.test(normalizedValue)
    ) {
      findings.push({
        severity: "high",
        message: `Privacy sign-off metadata is missing or pending: ${label}`,
      });
    } else if (
      label === "Reviewed deployment configuration reference or digest" &&
      !DEPLOYMENT_REFERENCE_PATTERN.test(normalizedValue)
    ) {
      findings.push({
        severity: "high",
        message: "Privacy sign-off deployment reference is malformed.",
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
  const requiredPrivacyArtifacts = Object.keys(
    REQUIRED_PRIVACY_ARTIFACT_ANCHORS,
  ) as Array<keyof typeof REQUIRED_PRIVACY_ARTIFACT_ANCHORS>;
  const readRequiredPackageValue = (label: string): string | null => {
    const matchingRows = requiredPackageLines.filter((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      return cells[1]?.replace(/`/gu, "") === label;
    });
    return matchingRows.length === 1
      ? (matchingRows[0].split("|")[2]?.replace(/`/gu, "").trim() ?? null)
      : null;
  };
  for (const label of requiredPrivacyArtifacts) {
    const value = readRequiredPackageValue(label);
    const validReference =
      !!value &&
      !SECRET_PLACEHOLDER_PATTERN.test(value) &&
      (await verifyReviewedEvidenceReference(value, evidenceManifest, record, {
        id: REQUIRED_PRIVACY_ARTIFACT_ANCHORS[label],
        kind: "artifact",
        status: "reviewed",
      }));
    if (!validReference) {
      findings.push({
        severity: "high",
        message: `Privacy sign-off evidence is missing or unresolvable: ${label}`,
      });
    }
  }
  const privacySettings = [
    "SHARE_TRUSTED_PROXY_CIDRS",
    ...Object.keys(PRIVACY_SETTING_RANGES),
  ];
  for (const label of privacySettings) {
    const value = readRequiredPackageValue(label);
    const range = PRIVACY_SETTING_RANGES[label];
    const numericValue = value === null ? Number.NaN : Number(value);
    const validValue =
      !!value &&
      !SECRET_PLACEHOLDER_PATTERN.test(value) &&
      (REVIEWED_EVIDENCE_REFERENCE_PATTERN.test(value)
        ? await verifyReviewedEvidenceReference(
            value,
            evidenceManifest,
            record,
            {
              kind: "artifact",
              status: "reviewed",
            },
          )
        : label === "SHARE_TRUSTED_PROXY_CIDRS"
          ? isTrustedCidrs(value)
          : !!range &&
            Number.isInteger(numericValue) &&
            numericValue >= range[0] &&
            numericValue <= range[1]);
    if (!validValue) {
      findings.push({
        severity: "high",
        message: `Privacy sign-off setting is missing, invalid, or unbound: ${label}`,
      });
    }
  }
  const privacyOwnerRows = signoffLines.filter((line) =>
    /^\|\s*Privacy owner\s*\|/u.test(line),
  );
  const privacyOwnerCells =
    privacyOwnerRows.length === 1
      ? privacyOwnerRows[0].split("|").map((cell) => cell.trim())
      : [];
  const privacyDecision = privacyOwnerCells[2]
    ?.replace(/`/gu, "")
    .trim()
    .toUpperCase();
  const privacyOwnerReference = privacyOwnerCells[3]?.replace(/`/gu, "").trim();
  if (
    privacyDecision !== "APPROVED" ||
    !hasConcreteReference(privacyOwnerReference) ||
    !hasConcreteReference(privacyApprover) ||
    privacyOwnerReference !== privacyApprover
  ) {
    findings.push({
      severity: "high",
      message:
        "Privacy owner decision must be APPROVED and bind its reference exactly to the Privacy approver metadata.",
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

const IP_LITERAL_PATTERN =
  /(?<![A-Za-z0-9])(?:[0-9]{1,3}(?:\.[0-9]{1,3}){3}|[0-9A-Fa-f:]{2,})(?![A-Za-z0-9])/gu;

const RAW_ADDRESS_KEY_PATTERN =
  /(?:client[\s_-]?(?:ip|addr|address)|remote[\s_-]?(?:addr|address|ip)|requester[\s_-]?(?:addr|address|ip)|forwarded[\s_-]?(?:for|addr|address|ip)|x[\s_-]?forwarded[\s_-]?(?:for|host|addr|address|ip))/iu;

function containsRawIpAddress(value: string): boolean {
  for (const match of value.matchAll(IP_LITERAL_PATTERN)) {
    const token = match[0];
    const start = match.index ?? -1;
    const suffix = start >= 0 ? value.slice(start + token.length) : "";
    const family = isIP(token);
    if (family === 0) continue;
    const cidrPrefix = /^\/(\d{1,3})(?:\b|$)/u.exec(suffix)?.[1];
    if (cidrPrefix !== undefined) {
      const prefix = Number(cidrPrefix);
      const maxPrefix = family === 4 ? 32 : 128;
      if (Number.isInteger(prefix) && prefix >= 0 && prefix <= maxPrefix) {
        continue;
      }
    }
    return true;
  }
  return false;
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

  if (RAW_ADDRESS_KEY_PATTERN.test(key)) return true;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (containsRawIpAddress(normalized)) return true;
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

async function isRegularEvidenceFile(relativePath: string): Promise<boolean> {
  try {
    const stats = await lstat(path.join(EVIDENCE_ROOT, relativePath));
    return stats.isFile();
  } catch {
    return false;
  }
}

async function collectEvidenceFindings(
  record: GateRecord,
  evidenceManifest: EvidenceManifest | null,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const file of REQUIRED_EVIDENCE_FILES) {
    if (!(await isRegularEvidenceFile(file))) {
      findings.push({
        severity: "high",
        message: `Required evidence path is missing, unreadable, or not a regular file: ${file}`,
      });
    }
  }
  if (!evidenceManifest) {
    findings.push({
      severity: "critical",
      message: "Evidence manifest is missing or has an invalid schema.",
    });
  } else {
    for (const artifact of evidenceManifest.artifacts) {
      const resolvedArtifactPath = await resolveEvidenceArtifactPath(
        artifact.path,
      );
      if (!resolvedArtifactPath || !(await exists(resolvedArtifactPath))) {
        findings.push({
          severity: "high",
          message: `Evidence artifact is missing or escapes the evidence directory: ${artifact.id}`,
        });
      }
    }
  }
  let evidenceTree: EvidenceTree = { files: [], symlinks: [] };
  try {
    evidenceTree = await enumerateEvidenceTree();
  } catch {
    findings.push({
      severity: "critical",
      message: "Evidence directory cannot be enumerated.",
    });
  }
  for (const symlink of evidenceTree.symlinks) {
    findings.push({
      severity: "high",
      message: `Evidence directory contains an unsupported symlink: ${symlink}`,
    });
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

  const filesToScan = [
    ...new Set([...REQUIRED_EVIDENCE_FILES, ...evidenceTree.files]),
  ];
  const evidenceText = await Promise.all(
    filesToScan.map((file) =>
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
  for (const [index, file] of filesToScan.entries()) {
    if (!file.endsWith(".json")) continue;
    try {
      if (
        containsSensitiveJsonValue(
          parseJsonWithUniqueKeys(evidenceText[index]),
          file,
        )
      ) {
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
  const rawIpFound = containsRawIpAddress(combinedEvidence);
  const rawAddressFieldFound = RAW_ADDRESS_KEY_PATTERN.test(combinedEvidence);
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
  if (rawIpFound || rawAddressFieldFound) {
    findings.push({
      severity: "critical",
      message: "Evidence files contain a raw client address or address field.",
    });
  }
  const privacySignoffText =
    evidenceText[filesToScan.indexOf("privacy-signoff.md")] ?? "";
  findings.push(
    ...(await validateReadyPrivacyEvidence(
      record,
      privacySignoffText,
      evidenceManifest,
    )),
  );

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

async function validateReleaseRecord(
  record: GateRecord,
  releaseRecordText: string,
  reviewedScenarioResults: ReviewedScenarioResults,
  evidenceManifest: EvidenceManifest | null,
): Promise<Finding[]> {
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
    } else {
      const evidence = reviewedResult.evidence.trim();
      const evidenceVerified = await verifyReviewedEvidenceReference(
        evidence,
        evidenceManifest,
        record,
        { id: scenarioId, kind: "scenario", status: "pass" },
      );
      if (!evidenceVerified) {
        findings.push({
          severity: "high",
          message: `Release record has no resolvable reviewed evidence reference for scenario: ${scenarioId}`,
        });
      }
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
  for (const finding of record.findings) {
    const requiresClosure =
      finding.status === "resolved" ||
      ["high", "critical"].includes(finding.severity);
    if (!requiresClosure) continue;
    const matchingRows = blockingFindings.filter(
      (row) => row.id === finding.id,
    );
    const closure = matchingRows[0]?.closureEvidence ?? "";
    const closureVerified = await verifyReviewedEvidenceReference(
      closure,
      evidenceManifest,
      record,
      { id: finding.id, kind: "finding", status: "resolved" },
    );
    if (
      matchingRows.length !== 1 ||
      finding.status !== "resolved" ||
      matchingRows[0]?.status !== "RESOLVED" ||
      !closureVerified ||
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

async function reviewedSourceMatchesCurrent(
  reviewedBuild: string,
  currentCommit: string,
): Promise<boolean> {
  const reviewedPaths = [
    ".",
    ":(exclude)openspec/changes/eh-154-share-link-privacy-release-gate/**",
    ":(exclude)QA/eh-154/**",
    ":(exclude).papercuts.jsonl",
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
  if (!(await isWorkingTreeClean())) {
    findings.push({
      severity: "high",
      message:
        "Releasable EH-154 evidence requires a clean worktree matching the reviewed build.",
    });
    return findings;
  }
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
        "Reviewed build differs from the complete immutable build used for adapter evidence.",
    });
  }
  return findings;
}

async function validateRecord(
  record: GateRecord,
  localAdapterRun: LocalAdapterRun | null,
  reviewedScenarioResults: ReviewedScenarioResults,
  evidenceManifest: EvidenceManifest | null,
): Promise<Finding[]> {
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
        const isReviewedReleaseEvidence =
          evidenceFile === "release-record.md" &&
          evidenceAnchor === scenario.id;
        if (!isReviewedReleaseEvidence) {
          findings.push({
            severity: "high",
            message: `Scenario ${scenario.id} requires an anchored reviewed release result; local adapter evidence is supplemental only.`,
          });
        } else {
          const reviewedResult = reviewedScenarioResults.statuses.get(
            scenario.id,
          );
          const reviewedEvidenceValid = reviewedResult?.evidence
            ? await verifyReviewedEvidenceReference(
                reviewedResult.evidence,
                evidenceManifest,
                record,
                { id: scenario.id, kind: "scenario", status: "pass" },
              )
            : false;
          if (
            reviewedResult?.status !== "pass" ||
            !reviewedEvidenceValid ||
            !reviewedResult.evidence
          ) {
            findings.push({
              severity: "high",
              message: `Scenario ${scenario.id} is not backed by a passing, resolvable reviewed release result.`,
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
  if (
    !record.reviewedDeployment ||
    !DEPLOYMENT_REFERENCE_PATTERN.test(record.reviewedDeployment.trim())
  ) {
    findings.push({
      severity: "high",
      message:
        "No valid immutable reviewed deployment configuration reference is recorded.",
    });
  }
  if (!hasConcreteReference(record.evidenceOwner)) {
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
    if (!hasConcreteReference(risk.owner) || expiryInvalid) {
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
  const evidenceManifest = await readEvidenceManifest();
  const localAdapterEvidence = await collectLocalAdapterEvidence();
  const releaseRecordText = await readFile(
    path.join(EVIDENCE_ROOT, "release-record.md"),
    "utf8",
  ).catch(() => "");
  const reviewedScenarioResults =
    parseReviewedScenarioResults(releaseRecordText);
  const findings = [
    ...(await collectEvidenceFindings(record, evidenceManifest)),
    ...localAdapterEvidence.findings,
    ...(await validateReviewedBuild(record, localAdapterEvidence.run)),
    ...(await validateReleaseRecord(
      record,
      releaseRecordText,
      reviewedScenarioResults,
      evidenceManifest,
    )),
    ...(await validateRecord(
      record,
      localAdapterEvidence.run,
      reviewedScenarioResults,
      evidenceManifest,
    )),
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
