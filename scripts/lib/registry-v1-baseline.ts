import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BIOMARKER_DEFINITIONS } from "../../src/lib/biomarkers/catalog/definitions";
import { ALIAS_MAP, resolveCanonicalKey, snakeCaseToken } from "../../src/lib/biomarkers/normalize";
import type { BiomarkerDefinition, BodySystemId, ConversionRule } from "../../src/lib/biomarkers/types";

export const REGISTRY_V1_BASELINE_VERSION = "1.0.0";
export const REGISTRY_V1_SNAPSHOT_SCHEMA_VERSION = 1;

export type AuditClassification =
  | "documented-safe"
  | "ambiguous-context-required"
  | "breaking-change-risk"
  | "metadata-gap"
  | "follow-up-required";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type BaselineDefinition = {
  key: string;
  displayName: string;
  system: BodySystemId;
  scoreRole: BiomarkerDefinition["scoreRole"];
  coversConfidence: boolean;
  aliases: string[];
  specimen: BiomarkerDefinition["specimen"] | null;
  tags: string[];
  conversion: ConversionRule | null;
  equivalenceGroup: string | null;
  derived: boolean;
};

export type AliasOwner = {
  alias: string;
  owners: string[];
  effectiveCanonicalKey: string | null;
};

export type ResolverCase = {
  id: string;
  category: "canonical" | "alias" | "collision" | "short_alias" | "missing_token" | "fallback" | "unknown" | "identity_risk";
  input: { key: string; name: string };
  expectedCanonicalKey: string;
  note: string;
};

export type AuditFinding = {
  id: string;
  classification: AuditClassification;
  title: string;
  summary: string;
};

export type RegistryV1Snapshot = {
  schemaVersion: number;
  registryVersion: string;
  definitions: BaselineDefinition[];
  effectiveAliasMap: Array<{ alias: string; canonicalKey: string }>;
  normalizedAliasOwners: AliasOwner[];
  normalizedAliasCollisions: AliasOwner[];
  shortAliasOverlays: Array<{ alias: string; canonicalKey: string }>;
};

export type RegistryV1Manifest = {
  schemaVersion: number;
  registryVersion: string;
  sourceFiles: Array<{ path: string; role: string }>;
  contentDigests: {
    registryJson: string;
    resolverCasesJson: string;
    auditMarkdown: string;
  };
  summary: {
    definitionCount: number;
    definitionsBySystem: Record<BodySystemId, number>;
    sourceAliasCount: number;
    effectiveAliasCount: number;
    normalizedAliasCollisionCount: number;
    specimenCounts: Record<string, number>;
    conversionCounts: Record<string, number>;
    equivalenceGroups: Record<string, string[]>;
    derivedMarkers: string[];
    auditFindingCounts: Record<AuditClassification, number>;
  };
};

export type RegistryV1BaselineArtifacts = {
  registry: RegistryV1Snapshot;
  resolverCases: {
    schemaVersion: number;
    registryVersion: string;
    cases: ResolverCase[];
  };
  auditFindings: AuditFinding[];
  manifest: RegistryV1Manifest;
  files: Record<"registry.json" | "resolver-cases.json" | "manifest.json" | "AUDIT.md", string>;
};

export type RegistryV1BaselineInputs = {
  definitions?: readonly BiomarkerDefinition[];
  aliasMap?: ReadonlyMap<string, string>;
  resolve?: (key: string, name?: string) => string;
  normalizeAlias?: (raw: string) => string;
};

function asJson(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(asJson);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, asJson(record[key])])) as JsonValue;
  }
  throw new Error(`Cannot serialize value of type ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(asJson(value), null, 2)}\n`;
}

/** Use UTF-16 code-unit order rather than locale-sensitive collation for stable artifacts. */
export function compareStableStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeDefinition(definition: BiomarkerDefinition): BaselineDefinition {
  return {
    key: definition.key,
    displayName: definition.displayName,
    system: definition.system,
    scoreRole: definition.scoreRole,
    coversConfidence: definition.coversConfidence,
    aliases: [...definition.aliases].sort(),
    specimen: definition.specimen ?? null,
    tags: [...(definition.tags ?? [])].sort(),
    conversion: definition.conversion ?? null,
    equivalenceGroup: definition.equivalenceGroup ?? null,
    derived: definition.derived ?? false,
  };
}

function requireUniqueKeys(definitions: readonly BiomarkerDefinition[]) {
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.key)) throw new Error(`Duplicate canonical biomarker key: ${definition.key}`);
    seen.add(definition.key);
  }
}

function buildAliasOwners(
  definitions: readonly BiomarkerDefinition[],
  aliasMap: ReadonlyMap<string, string>,
  normalizeAlias: (raw: string) => string
): AliasOwner[] {
  const owners = new Map<string, Set<string>>();

  for (const definition of definitions) {
    for (const rawAlias of [definition.key, ...definition.aliases]) {
      const alias = normalizeAlias(rawAlias);
      if (!alias) continue;
      const bucket = owners.get(alias) ?? new Set<string>();
      bucket.add(definition.key);
      owners.set(alias, bucket);
    }
  }

  return [...owners.entries()]
    .map(([alias, keys]) => ({
      alias,
      owners: [...keys].sort(),
      effectiveCanonicalKey: aliasMap.get(alias) ?? null,
    }))
    .sort((left, right) => compareStableStrings(left.alias, right.alias));
}

function buildResolverCases(
  definitions: readonly BiomarkerDefinition[],
  collisions: AliasOwner[],
  resolve: (key: string, name?: string) => string
): ResolverCase[] {
  const russianAlias = definitions
    .flatMap((definition) => definition.aliases.map((alias) => ({ alias, key: definition.key })))
    .find(({ alias }) => /[^\u0000-\u007f]/.test(alias));
  if (!russianAlias) throw new Error("Registry v1 baseline requires at least one non-ASCII alias fixture");

  const fixedCases: Array<Omit<ResolverCase, "expectedCanonicalKey">> = [
    {
      id: "canonical-hba1c",
      category: "canonical",
      input: { key: "hba1c", name: "Hemoglobin A1c" },
      note: "Canonical keys retain direct precedence.",
    },
    {
      id: "english-vitamin-d-alias",
      category: "alias",
      input: { key: "25-OH Vitamin D", name: "" },
      note: "Common normalized English alias.",
    },
    {
      id: "non-ascii-catalog-alias",
      category: "alias",
      input: { key: russianAlias.alias, name: "" },
      note: "Catalog-provided non-ASCII alias retained as observed legacy behavior.",
    },
    {
      id: "short-sodium-alias",
      category: "short_alias",
      input: { key: "Na", name: "" },
      note: "Short chemistry token behavior is frozen for compatibility review.",
    },
    {
      id: "missing-na-slash-a",
      category: "missing_token",
      input: { key: "N/A", name: "" },
      note: "Missing-value token must not inherit sodium behavior.",
    },
    {
      id: "missing-na-dot-a",
      category: "missing_token",
      input: { key: "n.a.", name: "" },
      note: "Punctuated missing-value token is a separate observed fixture.",
    },
    {
      id: "name-fallback-hba1c",
      category: "fallback",
      input: { key: "unrecognized_key", name: "HbA1c" },
      note: "Name fallback remains part of legacy resolution behavior.",
    },
    {
      id: "empty-input",
      category: "unknown",
      input: { key: "", name: "" },
      note: "Empty input fallback.",
    },
    {
      id: "unknown-input",
      category: "unknown",
      input: { key: "made-up lab marker", name: "" },
      note: "Unknown labels are preserved as normalized tokens.",
    },
    {
      id: "differential-absolute-legacy-key",
      category: "identity_risk",
      input: { key: "neutrophils", name: "" },
      note: "Legacy key denotes the absolute form; Registry 2.0 resolves count versus percent from context.",
    },
    {
      id: "differential-percent-legacy-key",
      category: "identity_risk",
      input: { key: "neutrophils_percent", name: "" },
      note: "Legacy percentage form remains distinct from the absolute form.",
    },
    {
      id: "rdw-legacy-key",
      category: "identity_risk",
      input: { key: "rdw", name: "" },
      note: "Registry 2.0 distinguishes RDW-CV and RDW-SD; v1 has one compatibility key.",
    },
    {
      id: "reticulocytes-no-v1-key",
      category: "identity_risk",
      input: { key: "reticulocytes", name: "" },
      note: "No v1 canonical reticulocyte key exists; future definitions cannot claim one-to-one compatibility.",
    },
    {
      id: "glucose-serum-plasma-legacy-key",
      category: "identity_risk",
      input: { key: "glucose", name: "" },
      note: "v1 glucose does not encode specimen.",
    },
    {
      id: "glucose-urine-legacy-key",
      category: "identity_risk",
      input: { key: "glucose_urine", name: "" },
      note: "Urine glucose maps to a distinct qualitative v1 key.",
    },
    {
      id: "fasting-glucose-legacy-key",
      category: "identity_risk",
      input: { key: "fpg", name: "" },
      note: "Fasting context is encoded only by label aliases in v1.",
    },
    {
      id: "free-t4-legacy-key",
      category: "identity_risk",
      input: { key: "free_t4", name: "" },
      note: "Free and total T4 remain distinct measurements and are not equivalents.",
    },
    {
      id: "total-t4-legacy-key",
      category: "identity_risk",
      input: { key: "t4", name: "" },
      note: "Free and total T4 remain distinct measurements and are not equivalents.",
    },
  ];

  const collisionCases = collisions.map((collision) => ({
    id: `collision-${collision.alias}`,
    category: "collision" as const,
    input: { key: collision.alias, name: "" },
    note: `Normalized source alias has owners: ${collision.owners.join(", ")}.`,
  }));

  return [...fixedCases, ...collisionCases]
    .map((fixture) => ({
      ...fixture,
      expectedCanonicalKey: resolve(fixture.input.key, fixture.input.name),
    }))
    .sort((left, right) => compareStableStrings(left.id, right.id));
}

function countBy<T>(items: readonly T[], keyFor: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyFor(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => compareStableStrings(left, right)));
}

function buildAuditFindings(snapshot: RegistryV1Snapshot): AuditFinding[] {
  const unspecifiedSpecimens = snapshot.definitions.filter((definition) => definition.specimen === null).length;
  const explicitNoConversion = snapshot.definitions.filter((definition) => definition.conversion?.type === "none").length;
  const missingConversion = snapshot.definitions.filter((definition) => definition.conversion === null).length;

  return [
    {
      id: "ALIAS-001",
      classification: "ambiguous-context-required",
      title: "Normalized source alias collisions",
      summary: `${snapshot.normalizedAliasCollisions.length} normalized aliases have more than one v1 owner; their current effective winners are frozen as compatibility behavior. Follow-up: EH-102 and EH-110.`,
    },
    {
      id: "RESOLVER-001",
      classification: "follow-up-required",
      title: "Short aliases and missing-value tokens",
      summary: "Short chemistry aliases, blocked missing tokens, first-registration behavior, canonical-key precedence, and key/name fallback are recorded by resolver fixtures for later context-aware review. Follow-up: EH-102 and EH-110.",
    },
    {
      id: "SPECIMEN-001",
      classification: "metadata-gap",
      title: "Unspecified specimen metadata",
      summary: `${unspecifiedSpecimens} v1 definitions have no explicit specimen policy. This is an inventory fact, not a clinical error classification. Follow-up: EH-102.`,
    },
    {
      id: "CONVERSION-001",
      classification: "documented-safe",
      title: "Explicit no-conversion policies",
      summary: `${explicitNoConversion} definitions explicitly declare no conversion, including assay-specific, activity, ratio, or already-native unit handling.`,
    },
    {
      id: "CONVERSION-002",
      classification: "follow-up-required",
      title: "Definitions without a conversion policy",
      summary: `${missingConversion} definitions omit conversion metadata and require later classification without adding conversion behavior in EH-101. Follow-up: EH-102.`,
    },
    {
      id: "EQUIVALENCE-001",
      classification: "documented-safe",
      title: "Current equivalence groups",
      summary: "The snapshot preserves BUN and urea in the existing urea_nitrogen group; free/total thyroid measurements and other related analytes are not collapsed into this group.",
    },
    {
      id: "IDENTITY-001",
      classification: "breaking-change-risk",
      title: "Measurement-definition migration boundaries",
      summary: "Differential count versus percent, RDW-CV/RDW-SD, reticulocytes, specimen-specific glucose, fasting context, and free/total thyroid forms require explicit compatibility review before mapping changes are promoted. Follow-up: EH-102 and EH-107.",
    },
  ];
}

function renderAuditReport(
  snapshot: RegistryV1Snapshot,
  manifestSummary: Omit<RegistryV1Manifest["summary"], "auditFindingCounts">,
  findings: AuditFinding[]
): string {
  const collisionRows = snapshot.normalizedAliasCollisions
    .map(
      (collision) =>
        `| \`${collision.alias}\` | ${collision.owners.map((owner) => `\`${owner}\``).join(", ")} | \`${collision.effectiveCanonicalKey ?? "unmapped"}\` | ALIAS-001 |`
    )
    .join("\n");
  const systemRows = Object.entries(manifestSummary.definitionsBySystem)
    .map(([system, count]) => `| ${system} | ${count} |`)
    .join("\n");
  const conversionRows = Object.entries(manifestSummary.conversionCounts)
    .map(([type, count]) => `| ${type} | ${count} |`)
    .join("\n");
  const specimenRows = Object.entries(manifestSummary.specimenCounts)
    .map(([specimen, count]) => `| ${specimen} | ${count} |`)
    .join("\n");
  const findingRows = findings
    .map((finding) => `| ${finding.id} | ${finding.classification} | ${finding.title} | ${finding.summary} |`)
    .join("\n");

  return `# Registry v1.0.0 Audit\n\n## Scope\n\nThis is a retrospective compatibility baseline for the static Registry v1 catalog. Registry 2.0 exists in parallel; this report neither asserts Registry 2.0 migration coverage nor changes runtime resolution, observations, scores, or medical policy.\n\n## Method\n\nThe baseline generator reads the current \`BIOMARKER_DEFINITIONS\`, serializes the effective \`ALIAS_MAP\` as sorted entries, derives normalized alias ownership, and executes named \`resolveCanonicalKey\` fixtures. All factual counts below are generated from those sources.\n\n## Catalog Summary\n\n- Canonical definitions: ${manifestSummary.definitionCount}\n- Source aliases including canonical keys: ${manifestSummary.sourceAliasCount}\n- Effective alias-map entries: ${manifestSummary.effectiveAliasCount}\n- Normalized multi-owner aliases: ${manifestSummary.normalizedAliasCollisionCount}\n- Derived markers: ${manifestSummary.derivedMarkers.map((key) => `\`${key}\``).join(", ") || "none"}\n\n| System | Definitions |\n| --- | ---: |\n${systemRows}\n\n## Alias Collisions\n\nThe following source aliases normalize to more than one v1 definition. The effective result is observed legacy behavior, not a context-aware approval.\n\n| Normalized alias | Source owners | Effective v1 result | Finding |\n| --- | --- | --- | --- |\n${collisionRows || "| none | - | - | - |"}\n\n## Resolver Behavior\n\nResolver fixtures freeze canonical-key precedence, direct alias lookup, short chemistry aliases, blocked/missing-token handling, key/name fallback, and unknown-token fallback. In particular, \`Na\`, \`N/A\`, and \`n.a.\` are separate fixtures. The source comment describes short aliases as contextual, but the effective v1 map contains direct short-alias entries; EH-101 records this behavior and does not alter it.\n\n## Specimen Inventory\n\nUnspecified means the v1 definition does not declare a specimen. It does not itself prove that the measurement is clinically invalid or that \`any\` is safe.\n\n| Specimen policy | Definitions |\n| --- | ---: |\n${specimenRows}\n\n## Conversion Inventory\n\nExplicit \`none\` means conversion was consciously not defined. Missing means the definition has no conversion field and remains a metadata-review item. EH-101 adds neither medical conversions nor external reference ranges.\n\n| Conversion policy | Definitions |\n| --- | ---: |\n${conversionRows}\n\n## Equivalence and Derived Markers\n\nThe current equivalence inventory is preserved without semantic expansion. \`bun\` and \`urea\` share \`urea_nitrogen\`. Free T4 and total T4 are distinct measurements, not equivalence members.\n\n| Equivalence group | Members |\n| --- | --- |\n${Object.entries(manifestSummary.equivalenceGroups)
    .map(([group, members]) => `| \`${group}\` | ${members.map((member) => `\`${member}\``).join(", ")} |`)
    .join("\n") || "| none | - |"}\n\n## Registry 2.0 Migration Risks\n\nThe following distinctions require explicit compatibility review in later changes: differential absolute versus percentage values, RDW-CV versus RDW-SD, reticulocytes without a v1 canonical key, serum/plasma versus whole-blood versus urine glucose, fasting glucose context, and free versus total thyroid forms. A shared analyte family is not an equivalence rule.\n\n## Reviewed Findings\n\n| ID | Classification | Title | Summary |\n| --- | --- | --- | --- |\n${findingRows}\n\n## Release Boundary\n\nRun \`npm run check:registry-v1\`, \`npm run test:registry-v1\`, \`npm run verify:registry\`, and \`npm run typecheck\` before committing this baseline. After a clean commit contains the generated artifacts and tooling, create the annotated tag:\n\n\`git tag -a registry-v1.0.0 -m "Registry v1.0.0 legacy compatibility baseline"\`\n\nDo not rewrite a published tag. Publish an audit erratum or a new baseline version for later corrections.\n`;
}

function baselinePaths(rootDirectory: string) {
  const directory = path.join(rootDirectory, "docs", "biomarker-registry", "v1.0.0");
  return {
    directory,
    registry: path.join(directory, "registry.json"),
    resolverCases: path.join(directory, "resolver-cases.json"),
    manifest: path.join(directory, "manifest.json"),
    audit: path.join(directory, "AUDIT.md"),
  };
}

export function getRegistryV1BaselinePaths(rootDirectory = process.cwd()) {
  return baselinePaths(rootDirectory);
}

export function buildRegistryV1Baseline(inputs: RegistryV1BaselineInputs = {}): RegistryV1BaselineArtifacts {
  const definitions = inputs.definitions ?? BIOMARKER_DEFINITIONS;
  const aliasMap = inputs.aliasMap ?? ALIAS_MAP;
  const resolve = inputs.resolve ?? resolveCanonicalKey;
  const normalizeAlias = inputs.normalizeAlias ?? snakeCaseToken;
  requireUniqueKeys(definitions);

  const normalizedDefinitions = definitions.map(normalizeDefinition).sort((left, right) => compareStableStrings(left.key, right.key));
  const aliasOwners = buildAliasOwners(definitions, aliasMap, normalizeAlias);
  const normalizedAliasCollisions = aliasOwners.filter((owner) => owner.owners.length > 1);
  const sourceAliases = new Set(aliasOwners.map((owner) => owner.alias));
  const effectiveAliasMap = [...aliasMap.entries()]
    .map(([alias, canonicalKey]) => ({ alias, canonicalKey }))
    .sort((left, right) => compareStableStrings(left.alias, right.alias));
  const snapshot: RegistryV1Snapshot = {
    schemaVersion: REGISTRY_V1_SNAPSHOT_SCHEMA_VERSION,
    registryVersion: REGISTRY_V1_BASELINE_VERSION,
    definitions: normalizedDefinitions,
    effectiveAliasMap,
    normalizedAliasOwners: aliasOwners,
    normalizedAliasCollisions,
    shortAliasOverlays: effectiveAliasMap.filter((entry) => !sourceAliases.has(entry.alias)),
  };
  const resolverCases = {
    schemaVersion: REGISTRY_V1_SNAPSHOT_SCHEMA_VERSION,
    registryVersion: REGISTRY_V1_BASELINE_VERSION,
    cases: buildResolverCases(definitions, normalizedAliasCollisions, resolve),
  };
  const auditFindings = buildAuditFindings(snapshot);
  const definitionsBySystem = countBy(normalizedDefinitions, (definition) => definition.system) as Record<BodySystemId, number>;
  const specimenCounts = countBy(normalizedDefinitions, (definition) => definition.specimen ?? "unspecified");
  const conversionCounts = countBy(normalizedDefinitions, (definition) => definition.conversion?.type ?? "missing");
  const equivalenceGroups = Object.fromEntries(
    [...new Set(normalizedDefinitions.map((definition) => definition.equivalenceGroup).filter((group): group is string => Boolean(group)))].sort().map(
      (group) => [group, normalizedDefinitions.filter((definition) => definition.equivalenceGroup === group).map((definition) => definition.key)]
    )
  );
  const summaryWithoutFindings = {
    definitionCount: normalizedDefinitions.length,
    definitionsBySystem,
    sourceAliasCount: aliasOwners.length,
    effectiveAliasCount: effectiveAliasMap.length,
    normalizedAliasCollisionCount: normalizedAliasCollisions.length,
    specimenCounts,
    conversionCounts,
    equivalenceGroups,
    derivedMarkers: normalizedDefinitions.filter((definition) => definition.derived).map((definition) => definition.key),
  };
  const registryContent = canonicalJson(snapshot);
  const resolverCasesContent = canonicalJson(resolverCases);
  const auditContent = renderAuditReport(snapshot, summaryWithoutFindings, auditFindings);
  const manifest: RegistryV1Manifest = {
    schemaVersion: REGISTRY_V1_SNAPSHOT_SCHEMA_VERSION,
    registryVersion: REGISTRY_V1_BASELINE_VERSION,
    sourceFiles: [
      { path: "src/lib/biomarkers/catalog/definitions.ts", role: "legacy canonical definitions" },
      { path: "src/lib/biomarkers/normalize.ts", role: "legacy effective alias resolution" },
    ],
    contentDigests: {
      registryJson: sha256(registryContent),
      resolverCasesJson: sha256(resolverCasesContent),
      auditMarkdown: sha256(auditContent),
    },
    summary: {
      ...summaryWithoutFindings,
      auditFindingCounts: countBy(auditFindings, (finding) => finding.classification) as Record<AuditClassification, number>,
    },
  };
  const manifestContent = canonicalJson(manifest);

  return {
    registry: snapshot,
    resolverCases,
    auditFindings,
    manifest,
    files: {
      "registry.json": registryContent,
      "resolver-cases.json": resolverCasesContent,
      "manifest.json": manifestContent,
      "AUDIT.md": auditContent,
    },
  };
}

export function verifyRegistryV1Snapshot(
  snapshot: RegistryV1Snapshot,
  definitions: readonly BiomarkerDefinition[] = BIOMARKER_DEFINITIONS
): string[] {
  const errors: string[] = [];
  const expected = new Set(definitions.map((definition) => definition.key));
  const observed = snapshot.definitions.map((definition) => definition.key);
  const counts = countBy(observed, (key) => key);
  for (const key of expected) {
    if (!counts[key]) errors.push(`Snapshot omits canonical key: ${key}`);
  }
  for (const key of observed) {
    if (!expected.has(key)) errors.push(`Snapshot contains unknown canonical key: ${key}`);
    if (counts[key] !== 1) errors.push(`Snapshot canonical key must appear exactly once: ${key}`);
  }
  return [...new Set(errors)].sort();
}

export function verifyRegistryV1Baseline(rootDirectory = process.cwd()): string[] {
  const artifacts = buildRegistryV1Baseline();
  const paths = baselinePaths(rootDirectory);
  const expectedFiles: Array<[keyof RegistryV1BaselineArtifacts["files"], string]> = [
    ["registry.json", paths.registry],
    ["resolver-cases.json", paths.resolverCases],
    ["manifest.json", paths.manifest],
    ["AUDIT.md", paths.audit],
  ];
  const errors = verifyRegistryV1Snapshot(artifacts.registry);

  for (const [name, filePath] of expectedFiles) {
    let actual: string;
    try {
      actual = readFileSync(filePath, "utf8");
    } catch {
      errors.push(`Missing baseline artifact: ${path.relative(rootDirectory, filePath)}`);
      continue;
    }
    if (actual !== artifacts.files[name]) errors.push(`Stale baseline artifact: ${path.relative(rootDirectory, filePath)}`);
  }
  return errors;
}
