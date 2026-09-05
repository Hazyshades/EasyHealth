import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  auditKnowledgeBaseSafety,
  type KnowledgeBaseSafetyFinding,
} from "../src/lib/knowledge-base/safety-policy";
import { getMarkerStatus } from "../src/lib/health-systems";

const REPOSITORY_ROOT = path.resolve(".");

export const DEFAULT_KNOWLEDGE_BASE_ROOTS = [
  "content/knowledge-base",
  "src/app/knowledge",
  "src/app/knowledge-base",
  "src/app/app/knowledge-base",
  "src/components/knowledge-base",
  "src/lib/knowledge-base",
] as const;

export const REQUIRED_KNOWLEDGE_BASE_SURFACES = [
  {
    label: "EH-134 biomarker article",
    pathPrefixes: [
      "src/app/knowledge/biomarkers/",
      "src/app/app/knowledge/measurements/",
      "src/components/knowledge-base/knowledge-article-page",
      "src/components/knowledge-base/biomarker-article",
      "content/knowledge-base/biomarker",
      "content/knowledge-base/measurement",
    ],
  },
  {
    label: "EH-135 panel/CBC article",
    pathPrefixes: [
      "src/app/knowledge/panels/",
      "src/app/app/knowledge/panels/",
      "src/components/knowledge-base/knowledge-panel-article-page",
      "src/components/knowledge-base/panel-article",
      "content/knowledge-base/panel",
      "content/knowledge-base/cbc",
    ],
  },
  {
    label: "EH-138 index/search",
    pathPrefixes: [
      "src/app/knowledge/page",
      "src/app/knowledge-base/page",
      "src/app/app/knowledge-base/page",
      "src/components/knowledge-base/knowledge-header",
      "src/lib/knowledge-base/index",
      "content/knowledge-base/index",
    ],
  },
] as const;

const EXCLUDED_KNOWLEDGE_BASE_FILES: Readonly<Record<string, true>> = {
  "src/lib/knowledge-base/safety-policy.ts": true,
};

export function missingKnowledgeBaseSurfaces(
  files: readonly string[],
): string[] {
  const normalizedFiles = files.map((filePath) =>
    filePath.replaceAll("\\", "/"),
  );
  return REQUIRED_KNOWLEDGE_BASE_SURFACES.filter(
    (surface) =>
      !surface.pathPrefixes.some((prefix) =>
        normalizedFiles.some((filePath) => filePath.startsWith(prefix)),
      ),
  ).map((surface) => surface.label);
}

const CONTENT_EXTENSIONS: Readonly<Record<string, true>> = {
  ".json": true,
  ".js": true,
  ".jsx": true,
  ".md": true,
  ".mdx": true,
  ".ts": true,
  ".tsx": true,
};
const MARKDOWN_EXTENSIONS: Readonly<Record<string, true>> = {
  ".md": true,
  ".mdx": true,
};
const JSX_EXTENSIONS: Readonly<Record<string, true>> = {
  ".jsx": true,
  ".tsx": true,
};

type SurfaceFinding = {
  code:
    | KnowledgeBaseSafetyFinding["code"]
    | "broken_local_link"
    | "accessibility_hazard";
  file: string;
  message: string;
  excerpt?: string;
};

export type KnowledgeBaseSurfaceReport = {
  files: string[];
  externalLinks: string[];
  findings: SurfaceFinding[];
  missingSurfaces: string[];
  blocked: boolean;
};

function relativeRepositoryPath(
  filePath: string,
  repositoryRoot = REPOSITORY_ROOT,
): string {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

function collectContentFiles(directory: string, files: string[]): void {
  if (!existsSync(directory)) return;
  const stats = lstatSync(directory);
  if (stats.isFile()) {
    if (CONTENT_EXTENSIONS[path.extname(directory).toLowerCase()])
      files.push(directory);
    return;
  }
  if (!stats.isDirectory()) return;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    collectContentFiles(path.join(directory, entry.name), files);
  }
}

export function discoverKnowledgeBaseFiles(
  repositoryRoot = REPOSITORY_ROOT,
  roots: readonly string[] = DEFAULT_KNOWLEDGE_BASE_ROOTS,
): string[] {
  const files: string[] = [];
  for (const root of roots) {
    const absoluteRoot = path.isAbsolute(root)
      ? root
      : path.resolve(repositoryRoot, root);
    collectContentFiles(absoluteRoot, files);
  }
  return [
    ...new Set(files.filter((filePath) => {
      const relativePath = relativeRepositoryPath(filePath, repositoryRoot);
      return !EXCLUDED_KNOWLEDGE_BASE_FILES[relativePath];
    })),
  ].sort((left, right) => left.localeCompare(right));
}

function trackedRepositoryPaths(): Set<string> {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return new Set(output.split("\0").filter(Boolean));
}

function localLinkTarget(
  rawLink: string,
  filePath: string,
  repositoryRoot: string,
): string | null {
  const link = rawLink.trim();
  if (
    link === "" ||
    link.startsWith("#") ||
    link.startsWith("/") ||
    /^(?:https?:|mailto:|tel:|data:)/i.test(link)
  ) {
    return null;
  }

  const withoutFragment = link.split(/[?#]/, 1)[0];
  if (withoutFragment === "") return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    decoded = withoutFragment;
  }
  const target = path.resolve(path.dirname(filePath), decoded);
  const relativeTarget = path
    .relative(repositoryRoot, target)
    .split(path.sep)
    .join("/");
  if (relativeTarget === "" || relativeTarget.startsWith(".."))
    return relativeTarget;
  return relativeTarget;
}

function localLinkFindings(
  filePath: string,
  source: string,
  repositoryRoot: string,
  trackedPaths: Set<string>,
  externalLinks: string[],
): SurfaceFinding[] {
  const findings: SurfaceFinding[] = [];
  const relativeFile = relativeRepositoryPath(filePath, repositoryRoot);
  for (const match of source.matchAll(
    /\[[^\]]+\]\(([^)\s]+)(?:\s+[^)]*)?\)/g,
  )) {
    const rawLink = match[1];
    if (/^(?:https?:|mailto:|tel:)/i.test(rawLink)) {
      externalLinks.push(rawLink);
      continue;
    }
    const relativeTarget = localLinkTarget(rawLink, filePath, repositoryRoot);
    if (relativeTarget === null) continue;
    const targetExists =
      trackedPaths.has(relativeTarget) ||
      [...trackedPaths].some((trackedPath) =>
        trackedPath.startsWith(`${relativeTarget}/`),
      );
    if (!targetExists) {
      findings.push({
        code: "broken_local_link",
        file: relativeFile,
        message: `${rawLink} resolves to missing tracked target ${relativeTarget}`,
        excerpt: rawLink,
      });
    }
  }
  return findings;
}

function accessibilityFindings(
  filePath: string,
  source: string,
  repositoryRoot = REPOSITORY_ROOT,
): SurfaceFinding[] {
  const findings: SurfaceFinding[] = [];
  const relativeFile = relativeRepositoryPath(filePath, repositoryRoot);
  const add = (message: string, excerpt?: string) => {
    findings.push({
      code: "accessibility_hazard",
      file: relativeFile,
      message,
      excerpt,
    });
  };

  for (const match of source.matchAll(
    /<\s*(?:div|span|li|p|section|article|td|tr)\b[^>]*\bonClick\s*=/gis,
  )) {
    add("click handling is attached to a non-interactive element", match[0]);
  }

  for (const match of source.matchAll(/<\s*img\b[^>]*>/gis)) {
    const tag = match[0];
    if (
      !/\balt\s*=|\baria-hidden\s*=|\brole\s*=\s*["']presentation["']/i.test(
        tag,
      )
    ) {
      add(
        "a native image must provide alt text or be explicitly decorative",
        tag,
      );
    }
  }

  for (const match of source.matchAll(
    /<\s*(?:button|a|input|select|textarea)\b[^>]*(?:aria-hidden\s*=\s*(?:["']true["']|\{true\})|\bhidden(?:\s|=|>))/gis,
  )) {
    add(
      "an interactive element must not be hidden from assistive technology",
      match[0],
    );
  }

  for (const match of source.matchAll(
    /<[^>]*\brole\s*=\s*["']button["'][^>]*>/gis,
  )) {
    const tag = match[0];
    if (!/\btabIndex\s*=|\bonKey(?:Down|Up|Press)\s*=/i.test(tag)) {
      add("a custom button needs keyboard focus and keyboard activation", tag);
    }
  }

  if (
    /<\s*button\b/i.test(source) &&
    !/focus-visible:|focus:ring|focus:outline/i.test(source) &&
    !/from\s+["']@\/components\/ui\/button["']/i.test(source)
  ) {
    add("a locally declared button has no visible focus affordance");
  }

  return findings;
}

function parseStructuredContent(source: string, filePath: string): unknown {
  if (path.extname(filePath).toLowerCase() !== ".json") return undefined;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return undefined;
  }
}

export function auditKnowledgeBaseSurface(
  repositoryRoot = REPOSITORY_ROOT,
  roots: readonly string[] = DEFAULT_KNOWLEDGE_BASE_ROOTS,
): KnowledgeBaseSurfaceReport {
  const files = discoverKnowledgeBaseFiles(repositoryRoot, roots);
  const trackedPaths = trackedRepositoryPaths();
  const findings: SurfaceFinding[] = [];
  const externalLinks: string[] = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    const relativeFile = relativeRepositoryPath(filePath, repositoryRoot);
    const structuredContent = parseStructuredContent(source, filePath);
    const safetyFindings = auditKnowledgeBaseSafety({
      id: relativeFile,
      content: source,
      metadata: structuredContent,
      metadataText: structuredContent === undefined ? source : undefined,
    });
    findings.push(
      ...safetyFindings.map((finding) => ({
        code: finding.code,
        file: relativeFile,
        message: `${finding.rule}: ${finding.excerpt}`,
        excerpt: finding.excerpt,
      })),
    );

    const extension = path.extname(filePath).toLowerCase();
    if (MARKDOWN_EXTENSIONS[extension]) {
      findings.push(
        ...localLinkFindings(
          filePath,
          source,
          repositoryRoot,
          trackedPaths,
          externalLinks,
        ),
      );
    }
    if (JSX_EXTENSIONS[extension]) {
      findings.push(
        ...accessibilityFindings(filePath, source, repositoryRoot),
      );
    }
  }

  const missingSurfaces = missingKnowledgeBaseSurfaces(
    files.map((filePath) => relativeRepositoryPath(filePath, repositoryRoot)),
  );

  return {
    files,
    externalLinks: [...new Set(externalLinks)],
    findings,
    missingSurfaces,
    blocked: missingSurfaces.length > 0,
  };
}

function runSafetyFixtures(): void {
  const safe = auditKnowledgeBaseSafety({
    id: "safe-education",
    content:
      "Hemoglobin carries oxygen in red blood cells. Results can vary with context; discuss questions with a qualified clinician.",
    metadata: { sources: [{ label: "WHO", url: "https://www.who.int/" }] },
  });
  assert.deepEqual(safe, [], "safe educational copy must not produce findings");

  const prohibited = auditKnowledgeBaseSafety({
    id: "prohibited-copy",
    content:
      "Your result confirms anemia. You should start your medication and order a blood test.",
  });
  assert.ok(
    prohibited.some((finding) => finding.code === "prohibited_claim"),
    "diagnostic and prescriptive claims must be detected",
  );

  const negativeProhibited = auditKnowledgeBaseSafety({
    id: "negative-prohibited-copy",
    content: "You do not have anemia.",
  });
  assert.ok(
    negativeProhibited.some((finding) => finding.code === "prohibited_claim"),
    "negative personal diagnostic claims must be detected",
  );

  const externalRange = auditKnowledgeBaseSafety({
    id: "external-range-copy",
    content: "The normal reference range is 120–160 g/L.",
    metadata: { referenceRange: { low: 120, high: 160 } },
  });
  assert.ok(
    externalRange.some(
      (finding) => finding.code === "external_reference_range",
    ),
    "range language and metadata must be detected",
  );
  assert.ok(
    externalRange.some(
      (finding) => finding.rule === "forbidden_range_metadata",
    ),
    "forbidden range fields must identify their metadata path",
  );

  const sourceMetadata = auditKnowledgeBaseSafety({
    id: "source-metadata",
    content: "Learn about this measurement.",
    metadataText:
      'export const article = { referenceRange: { low: 120 }, assessmentInput: "hemoglobin" };',
  });
  assert.ok(
    sourceMetadata.some(
      (finding) => finding.code === "external_reference_range",
    ),
    "non-JSON source metadata range fields must be detected",
  );
  assert.ok(
    sourceMetadata.some((finding) => finding.code === "assessment_coupling"),
    "non-JSON source metadata assessment fields must be detected",
  );

  assert.deepEqual(
    auditKnowledgeBaseSafety({
      id: "ordinary-reflow",
      content: "Learn about this measurement.",
      metadata: { reflow: true },
    }),
    [],
    "ordinary reflow metadata must not be treated as a reference range",
  );

  const assessmentCoupling = auditKnowledgeBaseSafety({
    id: "assessment-coupling",
    content: "Learn about this measurement.",
    metadata: { assessmentInput: "hemoglobin", score: 95 },
  });
  assert.equal(
    assessmentCoupling.filter(
      (finding) => finding.code === "assessment_coupling",
    ).length,
    2,
    "assessment metadata must remain outside Knowledge Base payloads",
  );

  const documentRange = { value: 5, refLow: 4, refHigh: 6 };
  assert.equal(
    getMarkerStatus(
      documentRange.value,
      documentRange.refLow,
      documentRange.refHigh,
    ),
    "in_range",
    "assessment status uses explicit document observation ranges",
  );
  assert.equal(
    getMarkerStatus(5, 6, 8),
    "out_of_range",
    "assessment status changes only with its explicit observation range",
  );

  for (const file of [
    "src/lib/health-profile-input.ts",
    "src/lib/health-profile-assessment-eligibility.ts",
    "src/lib/health-systems.ts",
  ]) {
    const source = readFileSync(path.resolve(file), "utf8");
    assert.doesNotMatch(
      source,
      /from\s+["'][^"']*knowledge-base[^"']*["']/i,
      `${file} must not import Knowledge Base content into assessment`,
    );
  }
}

function runSurfaceFixtures(): void {
  assert.deepEqual(
    missingKnowledgeBaseSurfaces([
      "src/app/knowledge/page.tsx",
      "src/app/knowledge/biomarkers/[slug]/page.tsx",
    ]),
    ["EH-135 panel/CBC article"],
    "strict mode must identify each missing dependency surface",
  );
  assert.deepEqual(
    missingKnowledgeBaseSurfaces([
      "src/app/knowledge/page.tsx",
      "src/app/knowledge/biomarkers/[slug]/page.tsx",
      "src/app/knowledge/panels/[key]/page.tsx",
    ]),
    [],
    "all required dependency surfaces must satisfy strict mode",
  );

  const partialSurfaceWithFinding: KnowledgeBaseSurfaceReport = {
    files: ["src/app/knowledge/biomarkers/[slug]/page.tsx"],
    externalLinks: [],
    findings: [
      {
        code: "prohibited_claim",
        file: "src/app/knowledge/biomarkers/[slug]/page.tsx",
        message: "personal_diagnosis_or_certainty: You do not have anemia.",
      },
    ],
    missingSurfaces: ["EH-135 panel/CBC article", "EH-138 index/search"],
    blocked: true,
  };
  assert.equal(
    knowledgeBaseGateFailed(partialSurfaceWithFinding, false),
    true,
    "unsafe copy on a partial Knowledge Base tree must still fail the baseline gate",
  );
  assert.equal(
    knowledgeBaseGateFailed(
      {
        files: [],
        externalLinks: [],
        findings: [],
        missingSurfaces: [
          "EH-134 biomarker article",
          "EH-135 panel/CBC article",
          "EH-138 index/search",
        ],
        blocked: true,
      },
      false,
    ),
    false,
    "an empty dependency-blocked tree must remain runnable in the baseline suite",
  );
  assert.equal(
    knowledgeBaseGateFailed(
      {
        files: [],
        externalLinks: [],
        findings: [],
        missingSurfaces: [
          "EH-134 biomarker article",
          "EH-135 panel/CBC article",
          "EH-138 index/search",
        ],
        blocked: true,
      },
      true,
    ),
    true,
    "strict mode must fail while required Knowledge Base surfaces are missing",
  );

  const articlePath = path.resolve(
    "content/knowledge-base/synthetic-article.md",
  );
  const trackedPaths = new Set(["content/knowledge-base/synthetic-article.md"]);
  const externalLinks: string[] = [];
  const brokenLinks = localLinkFindings(
    articlePath,
    "[Known source](./missing-source.md)\n[External source](https://example.com/source)",
    REPOSITORY_ROOT,
    trackedPaths,
    externalLinks,
  );
  assert.equal(
    brokenLinks.length,
    1,
    "missing local Knowledge Base links must fail",
  );
  assert.equal(brokenLinks[0]?.code, "broken_local_link");
  assert.deepEqual(externalLinks, ["https://example.com/source"]);

  const accessibleJsx = `
    import Image from "next/image";
    export function SafeArticle() {
      return <button className="focus-visible:ring-2" type="button"><Image alt="Synthetic source" /></button>;
    }
  `;
  assert.deepEqual(
    accessibilityFindings(
      path.resolve("src/components/knowledge-base/safe-article.tsx"),
      accessibleJsx,
    ),
    [],
    "accessible controls and images must pass the static contract",
  );

  const inaccessibleJsx = `
    export function UnsafeArticle() {
      return <div onClick={() => {}}><img src="/source.png" /><button aria-hidden="true">Open</button></div>;
    }
  `;
  const accessibility = accessibilityFindings(
    path.resolve("src/components/knowledge-base/unsafe-article.tsx"),
    inaccessibleJsx,
  );
  assert.equal(
    accessibility.length,
    4,
    "high-confidence accessibility hazards must be reported",
  );
}

function cliRoots(args: readonly string[]): string[] {
  const roots: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--root" && args[index + 1]) {
      roots.push(args[index + 1]);
      index += 1;
    }
  }
  return roots.length > 0 ? roots : [...DEFAULT_KNOWLEDGE_BASE_ROOTS];
}

export function knowledgeBaseGateFailed(
  report: KnowledgeBaseSurfaceReport,
  requireSurface: boolean,
): boolean {
  return report.findings.length > 0 || (requireSurface && report.blocked);
}

function printBlockedSurface(report: KnowledgeBaseSurfaceReport): void {
  if (report.files.length === 0) {
    console.log(
      "[eh140] Knowledge Base surface is BLOCKED: EH-134/EH-135/EH-138 files are not present in this checkout",
    );
    return;
  }
  console.log(
    `[eh140] Knowledge Base surface is BLOCKED: missing required surfaces: ${report.missingSurfaces.join(", ")}`,
  );
}

function printReport(
  report: KnowledgeBaseSurfaceReport,
  requireSurface: boolean,
): number {
  if (report.externalLinks.length > 0) {
    console.log(
      `[eh140] ${report.externalLinks.length} external links require manual source review (no network calls made)`,
    );
  }
  if (report.findings.length > 0) {
    for (const finding of report.findings) {
      console.error(
        `[eh140] ${finding.code} ${finding.file}: ${finding.message}`,
      );
    }
    if (report.blocked) printBlockedSurface(report);
    return 1;
  }
  if (report.blocked) {
    printBlockedSurface(report);
    return knowledgeBaseGateFailed(report, requireSurface) ? 1 : 0;
  }

  console.log(
    `[eh140] audited ${report.files.length} Knowledge Base files with no blocking findings`,
  );
  return 0;
}

function runCli(): void {
  runSafetyFixtures();
  runSurfaceFixtures();
  const args = process.argv.slice(2);
  const report = auditKnowledgeBaseSurface(REPOSITORY_ROOT, cliRoots(args));
  const exitCode = printReport(report, args.includes("--require-surface"));
  if (exitCode !== 0) process.exitCode = exitCode;
}

if (process.argv[1]?.endsWith("verify-eh140-knowledge-base.ts")) runCli();
