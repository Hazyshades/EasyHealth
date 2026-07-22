import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  getMeasurementDefinition,
  resolveMeasurementDefinition,
  type MeasurementResolution,
  type MeasurementResolutionInput,
  type MeasurementValueKind,
  type ResolverResult,
} from "../../src/lib/biomarkers";

/**
 * Candidate-release governance is intentionally tooling-only.  This module
 * accepts fixtures and a resolver, then returns in-memory evidence.  It has no
 * client, database, filesystem-write, promotion, acceptance, correction,
 * trend, readiness, score, or manual-decision dependency.
 */

export const DEFAULT_CANDIDATE_CORPUS_ROOT = "registry/candidate-release/v1";
export const REQUIRED_CANDIDATE_CORPUS_ROW_COUNT = 44;

const RESULTS: readonly ResolverResult[] = ["resolved", "partial", "ambiguous", "unmapped"];
const VALUE_KINDS: readonly MeasurementValueKind[] = ["numeric", "qualitative", "ordinal", "unspecified"];
const UNIT_CONFLICTS = new Set(["unit_dimension_conflict", "unit_not_accepted"]);
const APPROVAL_SCOPES = ["false_concrete_review", "score_affecting_binding", "release_gate"] as const;
const APPROVAL_STATUSES = ["approved"] as const;

export type CandidateCorpusRow = {
  id: string;
  documentId: string;
  panel: string;
  family: string;
  rawLabel: string;
  rawUnit: string | null;
  rawValueText: string;
  valueKind: MeasurementValueKind;
  specimen?: string | null;
  modifier?: string | null;
  expected: {
    classification: ResolverResult;
    measurementDefinitionKey?: string | null;
    manualCorrection?: {
      selectedDefinitionKey: string;
      reviewStatus: "reviewed";
      note: string;
    };
  };
};

export type CandidateReleaseCorpus = {
  schemaVersion: "1";
  candidate: {
    id: string;
    registryRelease: string;
  };
  requiredRowCount: number;
  rows: CandidateCorpusRow[];
};

export type CandidateDocumentIndex = {
  schemaVersion: "1";
  requiredCoverage: {
    panels: string[];
    languages: string[];
    laboratories: string[];
    requiresSpecialtyRows: boolean;
  };
  documents: Array<{
    id: string;
    fixture: string;
  }>;
};

export type CandidateDocumentFixture = {
  schemaVersion: "1";
  id: string;
  language: string;
  laboratory: string;
  panels: string[];
  specialtyRows: boolean;
  deidentified: boolean;
  rawRows: Array<{
    rawLabel: string;
    rawUnit: string | null;
    rawValueText: string;
    valueKind: MeasurementValueKind;
  }>;
};

export type CandidateReleasePolicy = {
  schemaVersion: "1";
  requiredLaunchRows: number;
  thresholds: {
    minRawPreservationRate: number;
    minRecognitionRate: number;
    minExpectedClassificationRate: number;
    minAliasCoverageRate: number;
    minUnitCoverageRate: number;
    maxFalseConcreteResolutions: number;
    maxProcessingErrors: number;
    maxUnclassifiedRows: number;
  };
  approvals: {
    falseConcreteReviewRoles: string[];
    releaseApprovalRoles: string[];
    scoreAffectingBindingOwners: Record<string, string>;
  };
  releaseEvidence: {
    resetRollbackFile: string;
  };
};

export type CandidateApproval = {
  id: string;
  scope: (typeof APPROVAL_SCOPES)[number];
  role: string;
  approvedBy: string;
  status: (typeof APPROVAL_STATUSES)[number];
  candidateInputHash: string;
  bindingKey?: string;
  note: string;
};

export type CandidateApprovalEvidence = {
  schemaVersion: "1";
  approvals: CandidateApproval[];
};

type LoadedCandidateCorpus = {
  root: string;
  corpus: CandidateReleaseCorpus;
  documentIndex: CandidateDocumentIndex;
  documents: Map<string, CandidateDocumentFixture>;
  documentFixtureHashes: Record<string, string>;
  policy: CandidateReleasePolicy;
  approvals: CandidateApprovalEvidence;
  resetRollbackNotes: string;
  fixtureErrors: string[];
};

export type CandidateCorpusReportRow = {
  id: string;
  documentId: string;
  panel: string;
  family: string;
  language: string;
  laboratory: string;
  valueKind: MeasurementValueKind;
  contextAvailability: "provided" | "missing";
  rawEvidence: {
    label: string;
    unit: string | null;
    valueText: string;
    hash: string;
  };
  rawPreserved: boolean;
  expectedClassification: ResolverResult;
  expectedMeasurementDefinitionKey: string | null;
  actualClassification: ResolverResult | null;
  actualMeasurementDefinitionKey: string | null;
  classificationMatches: boolean;
  falseConcreteResolution: boolean;
  aliasCovered: boolean;
  unitCovered: boolean;
  error: string | null;
  manualCorrection: CandidateCorpusRow["expected"]["manualCorrection"] | null;
  assessmentBindings: string[];
};

export type CandidateCorpusSegment = {
  total: number;
  recognized: number;
  resolved: number;
  partial: number;
  ambiguous: number;
  unmapped: number;
  expectedClassificationFailures: number;
  falseConcreteResolutions: number;
  processingErrors: number;
};

export type CandidateCorpusReport = {
  schemaVersion: "1";
  candidateId: string;
  candidateInputHash: string;
  coverage: {
    requiredRows: number;
    actualRows: number;
    documentCount: number;
    deidentifiedDocumentCount: number;
    missingContextNegativeCount: number;
    panels: string[];
    languages: string[];
    laboratories: string[];
    specialtyDocumentCount: number;
  };
  metrics: {
    rawPreservationRate: number;
    recognitionRate: number;
    expectedClassificationRate: number;
    aliasCoverageRate: number;
    unitCoverageRate: number;
    resolved: number;
    partial: number;
    ambiguous: number;
    unmapped: number;
    falseConcreteResolutions: number;
    processingErrors: number;
    unclassifiedRows: number;
  };
  rows: CandidateCorpusReportRow[];
  falseConcreteResolutions: CandidateCorpusReportRow[];
  processingErrors: CandidateCorpusReportRow[];
  manualCorrections: CandidateCorpusReportRow[];
  assessmentImpact: Array<{
    rowId: string;
    definitionKey: string;
    assessmentInputKeys: string[];
    source: "resolved" | "manual_correction";
  }>;
  segments: {
    panel: Record<string, CandidateCorpusSegment>;
    family: Record<string, CandidateCorpusSegment>;
    language: Record<string, CandidateCorpusSegment>;
    laboratory: Record<string, CandidateCorpusSegment>;
    valueKind: Record<string, CandidateCorpusSegment>;
    contextAvailability: Record<string, CandidateCorpusSegment>;
  };
};

export type CandidateThresholdCheck = {
  metric: string;
  operator: ">=" | "<=";
  expected: number;
  actual: number;
  passed: boolean;
};

export type CandidateApprovalValidation = {
  valid: boolean;
  errors: string[];
  approvalsHash: string;
};

export type CandidateReleaseManifest = {
  schemaVersion: "1";
  candidate: {
    id: string;
    registryRelease: string;
    catalogManifestVersion: string;
    catalogManifestDigest: string;
    resolverVersion: string;
    normalizationVersion: string;
  };
  candidateInputHash: string;
  inputHashes: {
    corpus: string;
    documentIndex: string;
    documentFixtures: Record<string, string>;
    policy: string;
    resetRollbackNotes: string;
    registryManifest: string;
  };
  reportHash: string;
  approvalEvidenceHash: string;
  /** Digest of this manifest excluding the digest field itself. */
  manifestHash: string;
  thresholdChecks: CandidateThresholdCheck[];
  approvals: {
    valid: boolean;
    errors: string[];
  };
  fixtureErrors: string[];
  launchable: boolean;
};

export type CandidateCorpusRun = {
  manifest: CandidateReleaseManifest;
  report: CandidateCorpusReport;
};

export type CandidateCorpusRunnerOptions = {
  root?: string;
  resolver?: (input: MeasurementResolutionInput) => MeasurementResolution;
  /**
   * A caller may use this option to declare a prohibited writer dependency.
   * The runner rejects it before evaluation and never calls the supplied
   * function, which makes accidental mutation attempts observable in tests.
   */
  mutationAttempt?: () => unknown;
};

function normalizedText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function canonicalValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON cannot contain a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Canonical JSON cannot serialize ${typeof value}`);
}

/** Stable JSON preserves array order and sorts object keys. */
export function canonicalJson(value: unknown): string {
  return `${canonicalValue(value)}\n`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function compareStableStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hashJson(value: unknown): string {
  return sha256(canonicalJson(value));
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read candidate corpus JSON ${path}: ${message}`);
  }
}

function readText(path: string): string {
  try {
    return normalizedText(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read candidate corpus evidence ${path}: ${message}`);
  }
}

function asRelativePath(root: string, path: string, label: string): string {
  if (isAbsolute(path)) throw new Error(`${label} must be relative to the candidate corpus root`);
  const resolvedPath = resolve(root, path);
  const pathFromRoot = relative(resolve(root), resolvedPath);
  if (pathFromRoot === "" || pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    throw new Error(`${label} must stay within the candidate corpus root`);
  }
  return resolvedPath;
}

function missingString(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function requiredStringArray(value: unknown, label: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(missingString)) {
    errors.push(`${label} must be a non-empty string array`);
    return [];
  }
  return value;
}

function rawEvidenceKey(row: Pick<CandidateCorpusRow, "rawLabel" | "rawUnit" | "rawValueText" | "valueKind">): string {
  return canonicalJson({
    rawLabel: row.rawLabel,
    rawUnit: row.rawUnit,
    rawValueText: row.rawValueText,
    valueKind: row.valueKind,
  });
}

function validateCandidateCorpus(loaded: Omit<LoadedCandidateCorpus, "fixtureErrors">): string[] {
  const errors: string[] = [];
  const { corpus, documentIndex, documents, policy, resetRollbackNotes } = loaded;
  if (corpus.schemaVersion !== "1") errors.push("corpus.schemaVersion must be 1");
  if (missingString(corpus.candidate?.id)) errors.push("corpus.candidate.id is required");
  if (missingString(corpus.candidate?.registryRelease)) errors.push("corpus.candidate.registryRelease is required");
  if (corpus.requiredRowCount !== REQUIRED_CANDIDATE_CORPUS_ROW_COUNT) {
    errors.push(`corpus.requiredRowCount must remain ${REQUIRED_CANDIDATE_CORPUS_ROW_COUNT}`);
  }
  if (!Array.isArray(corpus.rows)) errors.push("corpus.rows must be an array");
  if (!Array.isArray(corpus.rows) || corpus.rows.length !== corpus.requiredRowCount) {
    errors.push(`required row count is ${corpus.requiredRowCount}, but fixture contains ${Array.isArray(corpus.rows) ? corpus.rows.length : 0}`);
  }
  if (!Array.isArray(corpus.rows) || corpus.rows.length !== REQUIRED_CANDIDATE_CORPUS_ROW_COUNT) {
    errors.push(`candidate corpus must contain exactly ${REQUIRED_CANDIDATE_CORPUS_ROW_COUNT} rows`);
  }
  if (policy.requiredLaunchRows !== REQUIRED_CANDIDATE_CORPUS_ROW_COUNT) {
    errors.push(`policy.requiredLaunchRows must remain ${REQUIRED_CANDIDATE_CORPUS_ROW_COUNT}`);
  }
  if (corpus.requiredRowCount !== policy.requiredLaunchRows) {
    errors.push(`corpus.requiredRowCount (${corpus.requiredRowCount}) must match policy.requiredLaunchRows (${policy.requiredLaunchRows})`);
  }

  const ids = new Set<string>();
  for (const row of corpus.rows ?? []) {
    if (missingString(row.id)) errors.push("row.id is required");
    else if (ids.has(row.id)) errors.push(`duplicate row id: ${row.id}`);
    else ids.add(row.id);
    if (missingString(row.documentId) || !documents.has(row.documentId)) errors.push(`row ${row.id || "<unknown>"} references a missing document fixture`);
    if (missingString(row.panel)) errors.push(`row ${row.id || "<unknown>"} is missing panel coverage`);
    if (missingString(row.family)) errors.push(`row ${row.id || "<unknown>"} is missing family coverage`);
    if (missingString(row.rawLabel)) errors.push(`row ${row.id || "<unknown>"} is missing rawLabel`);
    if (row.rawUnit !== null && typeof row.rawUnit !== "string") errors.push(`row ${row.id || "<unknown>"} rawUnit must be a string or null`);
    if (missingString(row.rawValueText)) errors.push(`row ${row.id || "<unknown>"} is missing rawValueText`);
    if (!VALUE_KINDS.includes(row.valueKind)) errors.push(`row ${row.id || "<unknown>"} has an invalid valueKind`);
    if (!row.expected || !RESULTS.includes(row.expected.classification)) errors.push(`row ${row.id || "<unknown>"} has no valid expected classification`);
    if (row.expected?.classification === "resolved" && missingString(row.expected.measurementDefinitionKey)) {
      errors.push(`resolved row ${row.id || "<unknown>"} must declare an expected measurement definition`);
    }
    if (row.expected?.measurementDefinitionKey != null && !getMeasurementDefinition(row.expected.measurementDefinitionKey)) {
      errors.push(`row ${row.id || "<unknown>"} references an unknown expected measurement definition ${row.expected.measurementDefinitionKey}`);
    }
    const correction = row.expected?.manualCorrection;
    if (correction) {
      const definition = getMeasurementDefinition(correction.selectedDefinitionKey);
      if (!definition || definition.maturity !== "reviewed") {
        errors.push(`manual correction on ${row.id || "<unknown>"} must select a reviewed Registry 2.0 definition`);
      }
      if (correction.reviewStatus !== "reviewed") errors.push(`manual correction on ${row.id || "<unknown>"} lacks reviewed evidence`);
      if (missingString(correction.note)) errors.push(`manual correction on ${row.id || "<unknown>"} lacks a review note`);
    }
  }

  if (documentIndex.schemaVersion !== "1") errors.push("documents.schemaVersion must be 1");
  if (!Array.isArray(documentIndex.documents) || documentIndex.documents.length === 0) errors.push("at least one representative document fixture is required");
  if (documents.size !== documentIndex.documents?.length) errors.push("document fixture identifiers must be unique");
  const requiredCoverage = documentIndex.requiredCoverage;
  if (!requiredCoverage || typeof requiredCoverage !== "object") {
    errors.push("documents.requiredCoverage is required");
  }
  const requiredPanels = requiredStringArray(requiredCoverage?.panels, "documents.requiredCoverage.panels", errors);
  const requiredLanguages = requiredStringArray(requiredCoverage?.languages, "documents.requiredCoverage.languages", errors);
  const requiredLaboratories = requiredStringArray(requiredCoverage?.laboratories, "documents.requiredCoverage.laboratories", errors);
  if (typeof requiredCoverage?.requiresSpecialtyRows !== "boolean") {
    errors.push("documents.requiredCoverage.requiresSpecialtyRows must be a boolean");
  }
  const corpusRawRowsByDocument = new Map<string, Set<string>>();
  for (const row of corpus.rows ?? []) {
    const rows = corpusRawRowsByDocument.get(row.documentId) ?? new Set<string>();
    rows.add(rawEvidenceKey(row));
    corpusRawRowsByDocument.set(row.documentId, rows);
  }
  const panels = new Set<string>();
  const languages = new Set<string>();
  const laboratories = new Set<string>();
  let specialtyCount = 0;
  for (const document of documents.values()) {
    if (document.schemaVersion !== "1") errors.push(`document ${document.id} has an unsupported schema version`);
    if (missingString(document.id)) errors.push("document fixture id is required");
    if (missingString(document.language)) errors.push(`document ${document.id || "<unknown>"} has no language`);
    if (missingString(document.laboratory)) errors.push(`document ${document.id || "<unknown>"} has no laboratory`);
    if (!document.deidentified) errors.push(`document ${document.id || "<unknown>"} is not marked deidentified`);
    if (!Array.isArray(document.panels) || document.panels.length === 0) errors.push(`document ${document.id || "<unknown>"} has no panel coverage`);
    if (!Array.isArray(document.rawRows) || document.rawRows.length === 0) errors.push(`document ${document.id || "<unknown>"} has no representative raw rows`);
    const corpusRawRows = corpusRawRowsByDocument.get(document.id) ?? new Set<string>();
    for (const rawRow of document.rawRows ?? []) {
      if (!rawRow || typeof rawRow !== "object") {
        errors.push(`document ${document.id || "<unknown>"} has an invalid raw row`);
        continue;
      }
      let rawRowValid = true;
      if (missingString(rawRow.rawLabel)) {
        errors.push(`document ${document.id || "<unknown>"} raw row is missing rawLabel`);
        rawRowValid = false;
      }
      if (rawRow.rawUnit !== null && typeof rawRow.rawUnit !== "string") {
        errors.push(`document ${document.id || "<unknown>"} raw row has an invalid rawUnit`);
        rawRowValid = false;
      }
      if (missingString(rawRow.rawValueText)) {
        errors.push(`document ${document.id || "<unknown>"} raw row is missing rawValueText`);
        rawRowValid = false;
      }
      if (!VALUE_KINDS.includes(rawRow.valueKind)) {
        errors.push(`document ${document.id || "<unknown>"} raw row has an invalid valueKind`);
        rawRowValid = false;
      }
      if (!rawRowValid) continue;
      if (!corpusRawRows.has(rawEvidenceKey(rawRow))) {
        errors.push(`document ${document.id || "<unknown>"} raw row is not represented in the candidate corpus: ${rawRow.rawLabel || "<unknown>"}`);
      }
    }
    for (const panel of document.panels ?? []) panels.add(panel);
    if (document.language) languages.add(document.language);
    if (document.laboratory) laboratories.add(document.laboratory);
    if (document.specialtyRows) specialtyCount += 1;
  }
  for (const panel of requiredPanels) if (!panels.has(panel)) errors.push(`required document panel coverage is missing: ${panel}`);
  for (const language of requiredLanguages) if (!languages.has(language)) errors.push(`required document language coverage is missing: ${language}`);
  for (const laboratory of requiredLaboratories) if (!laboratories.has(laboratory)) errors.push(`required document laboratory coverage is missing: ${laboratory}`);
  if (requiredCoverage?.requiresSpecialtyRows && specialtyCount === 0) errors.push("representative specialty document coverage is missing");

  if (policy.schemaVersion !== "1") errors.push("policy.schemaVersion must be 1");
  const thresholds = policy.thresholds;
  if (!thresholds || typeof thresholds !== "object") errors.push("policy.thresholds is required");
  for (const [name, value] of Object.entries(thresholds ?? {})) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) errors.push(`policy threshold ${name} must be a non-negative number`);
  }
  for (const [name, value] of Object.entries({
    minRawPreservationRate: thresholds?.minRawPreservationRate,
    minRecognitionRate: thresholds?.minRecognitionRate,
    minExpectedClassificationRate: thresholds?.minExpectedClassificationRate,
    minAliasCoverageRate: thresholds?.minAliasCoverageRate,
    minUnitCoverageRate: thresholds?.minUnitCoverageRate,
  })) {
    if (typeof value === "number" && value > 1) errors.push(`policy threshold ${name} cannot exceed 1`);
  }
  if (!policy.approvals || policy.approvals.falseConcreteReviewRoles.length === 0) errors.push("policy must name a false-concrete-resolution approval role");
  if (!policy.approvals || policy.approvals.releaseApprovalRoles.length === 0) errors.push("policy must name a release approval role");
  if (missingString(policy.releaseEvidence?.resetRollbackFile)) errors.push("policy must name reset/rollback notes");
  if (!/##\s+Reset/i.test(resetRollbackNotes) || !/##\s+Rollback/i.test(resetRollbackNotes)) {
    errors.push("reset/rollback notes must include Reset and Rollback sections");
  }
  return errors;
}

function loadCandidateCorpus(rootInput = DEFAULT_CANDIDATE_CORPUS_ROOT): LoadedCandidateCorpus {
  const root = resolve(rootInput);
  const corpus = readJson<CandidateReleaseCorpus>(join(root, "corpus.json"));
  const documentIndex = readJson<CandidateDocumentIndex>(join(root, "documents.json"));
  const policy = readJson<CandidateReleasePolicy>(join(root, "policy.json"));
  const approvals = readJson<CandidateApprovalEvidence>(join(root, "approvals.json"));
  const documents = new Map<string, CandidateDocumentFixture>();
  const documentFixtureHashes: Record<string, string> = {};
  for (const entry of documentIndex.documents ?? []) {
    if (missingString(entry.id) || missingString(entry.fixture)) continue;
    const documentPath = asRelativePath(root, entry.fixture, `document fixture ${entry.id}`);
    if (!existsSync(documentPath)) throw new Error(`Required document fixture is missing: ${entry.fixture}`);
    const document = readJson<CandidateDocumentFixture>(documentPath);
    if (document.id !== entry.id) throw new Error(`Document fixture id mismatch: expected ${entry.id}, received ${document.id}`);
    documents.set(entry.id, document);
    documentFixtureHashes[entry.id] = hashJson(document);
  }
  const resetRollbackPath = asRelativePath(root, policy.releaseEvidence?.resetRollbackFile ?? "", "reset/rollback notes");
  if (!existsSync(resetRollbackPath)) throw new Error(`Required reset/rollback notes are missing: ${policy.releaseEvidence?.resetRollbackFile ?? "<unset>"}`);
  const resetRollbackNotes = readText(resetRollbackPath);
  const loadedWithoutErrors = { root, corpus, documentIndex, documents, documentFixtureHashes, policy, approvals, resetRollbackNotes };
  return { ...loadedWithoutErrors, fixtureErrors: validateCandidateCorpus(loadedWithoutErrors) };
}

function countRate(rows: readonly CandidateCorpusReportRow[], predicate: (row: CandidateCorpusReportRow) => boolean): number {
  return rows.length === 0 ? 0 : rows.filter(predicate).length / rows.length;
}

function blankSegment(): CandidateCorpusSegment {
  return {
    total: 0,
    recognized: 0,
    resolved: 0,
    partial: 0,
    ambiguous: 0,
    unmapped: 0,
    expectedClassificationFailures: 0,
    falseConcreteResolutions: 0,
    processingErrors: 0,
  };
}

function toSegments(rows: readonly CandidateCorpusReportRow[], key: (row: CandidateCorpusReportRow) => string): Record<string, CandidateCorpusSegment> {
  const grouped = new Map<string, CandidateCorpusSegment>();
  for (const row of rows) {
    const group = key(row);
    const segment = grouped.get(group) ?? blankSegment();
    segment.total += 1;
    if (row.actualClassification && row.actualClassification !== "unmapped") segment.recognized += 1;
    if (row.actualClassification === "resolved") segment.resolved += 1;
    if (row.actualClassification === "partial") segment.partial += 1;
    if (row.actualClassification === "ambiguous") segment.ambiguous += 1;
    if (row.actualClassification === "unmapped") segment.unmapped += 1;
    if (!row.classificationMatches) segment.expectedClassificationFailures += 1;
    if (row.falseConcreteResolution) segment.falseConcreteResolutions += 1;
    if (row.error) segment.processingErrors += 1;
    grouped.set(group, segment);
  }
  return Object.fromEntries([...grouped.entries()].sort(([left], [right]) => compareStableStrings(left, right)));
}

function thresholdChecks(report: CandidateCorpusReport, policy: CandidateReleasePolicy): CandidateThresholdCheck[] {
  const metric = report.metrics;
  const checks: Array<Omit<CandidateThresholdCheck, "passed">> = [
    { metric: "rawPreservationRate", operator: ">=", expected: policy.thresholds.minRawPreservationRate, actual: metric.rawPreservationRate },
    { metric: "recognitionRate", operator: ">=", expected: policy.thresholds.minRecognitionRate, actual: metric.recognitionRate },
    { metric: "expectedClassificationRate", operator: ">=", expected: policy.thresholds.minExpectedClassificationRate, actual: metric.expectedClassificationRate },
    { metric: "aliasCoverageRate", operator: ">=", expected: policy.thresholds.minAliasCoverageRate, actual: metric.aliasCoverageRate },
    { metric: "unitCoverageRate", operator: ">=", expected: policy.thresholds.minUnitCoverageRate, actual: metric.unitCoverageRate },
    { metric: "falseConcreteResolutions", operator: "<=", expected: policy.thresholds.maxFalseConcreteResolutions, actual: metric.falseConcreteResolutions },
    { metric: "processingErrors", operator: "<=", expected: policy.thresholds.maxProcessingErrors, actual: metric.processingErrors },
    { metric: "unclassifiedRows", operator: "<=", expected: policy.thresholds.maxUnclassifiedRows, actual: metric.unclassifiedRows },
  ];
  return checks.map((check) => ({ ...check, passed: check.operator === ">=" ? check.actual >= check.expected : check.actual <= check.expected }));
}

function validateApprovals(
  evidence: CandidateApprovalEvidence,
  policy: CandidateReleasePolicy,
  candidateInputHash: string,
  assessmentDefinitionKeys: readonly string[]
): CandidateApprovalValidation {
  const errors: string[] = [];
  if (evidence.schemaVersion !== "1") errors.push("approval evidence has an unsupported schema version");
  if (!Array.isArray(evidence.approvals)) errors.push("approval evidence must contain an approvals array");
  const approved = (scope: CandidateApproval["scope"], role: string, bindingKey?: string): boolean =>
    (evidence.approvals ?? []).some(
      (approval) =>
        approval.scope === scope &&
        approval.role === role &&
        approval.status === "approved" &&
        approval.candidateInputHash === candidateInputHash &&
        (bindingKey === undefined || approval.bindingKey === bindingKey)
    );
  for (const role of policy.approvals.falseConcreteReviewRoles) {
    if (!approved("false_concrete_review", role)) errors.push(`missing hash-bound false-concrete-resolution approval from ${role}`);
  }
  for (const role of policy.approvals.releaseApprovalRoles) {
    if (!approved("release_gate", role)) errors.push(`missing hash-bound release approval from ${role}`);
  }
  for (const definitionKey of [...new Set(assessmentDefinitionKeys)].sort()) {
    const owner = policy.approvals.scoreAffectingBindingOwners[definitionKey];
    if (!owner) {
      errors.push(`score-affecting definition ${definitionKey} has no named approval owner`);
      continue;
    }
    if (!approved("score_affecting_binding", owner, definitionKey)) {
      errors.push(`missing hash-bound score-affecting approval for ${definitionKey} from ${owner}`);
    }
  }
  for (const approval of evidence.approvals ?? []) {
    if (missingString(approval.id) || missingString(approval.role) || missingString(approval.approvedBy) || missingString(approval.note)) {
      errors.push("approval evidence contains an incomplete approval record");
    }
    if (!APPROVAL_SCOPES.includes(approval.scope)) {
      errors.push(`approval ${approval.id || "<unknown>"} has an invalid scope`);
    }
    if (!APPROVAL_STATUSES.includes(approval.status)) {
      errors.push(`approval ${approval.id || "<unknown>"} has an invalid status`);
    }
    if (approval.scope === "score_affecting_binding" && missingString(approval.bindingKey)) {
      errors.push(`score-affecting approval ${approval.id || "<unknown>"} must name a binding key`);
    }
    if (approval.scope !== "score_affecting_binding" && approval.bindingKey !== undefined) {
      errors.push(`non-score approval ${approval.id || "<unknown>"} must not name a binding key`);
    }
    if (approval.candidateInputHash !== candidateInputHash) errors.push(`approval ${approval.id || "<unknown>"} is bound to a different candidate input hash`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(), approvalsHash: hashJson(evidence) };
}

function buildInputHashes(loaded: LoadedCandidateCorpus): CandidateReleaseManifest["inputHashes"] {
  return {
    corpus: hashJson(loaded.corpus),
    documentIndex: hashJson(loaded.documentIndex),
    documentFixtures: Object.fromEntries(Object.entries(loaded.documentFixtureHashes).sort(([left], [right]) => compareStableStrings(left, right))),
    policy: hashJson(loaded.policy),
    resetRollbackNotes: sha256(loaded.resetRollbackNotes),
    registryManifest: MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  };
}

function candidateInputHash(corpus: CandidateReleaseCorpus, inputHashes: CandidateReleaseManifest["inputHashes"]): string {
  return hashJson({
    candidate: corpus.candidate,
    inputHashes,
    catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    resolverVersion: MEASUREMENT_RESOLVER_VERSION,
    normalizationVersion: MEASUREMENT_NORMALIZATION_VERSION,
  });
}

/**
 * Runs only the supplied resolver over frozen inputs.  Passing a writer is
 * rejected before anything is called; the runner cannot invoke a mutation
 * path as part of normal candidate evaluation.
 */
export function runRegistryV2CandidateCorpus(options: CandidateCorpusRunnerOptions = {}): CandidateCorpusRun {
  if (options.mutationAttempt) {
    throw new Error("Candidate corpus runner rejects runtime mutation attempts before evaluation");
  }
  const loaded = loadCandidateCorpus(options.root);
  if (loaded.fixtureErrors.length > 0) {
    throw new Error(`Candidate corpus fixture validation failed:\n${loaded.fixtureErrors.map((error) => `- ${error}`).join("\n")}`);
  }
  const inputHashes = buildInputHashes(loaded);
  const inputHash = candidateInputHash(loaded.corpus, inputHashes);
  const resolver = options.resolver ?? resolveMeasurementDefinition;
  const reportRows: CandidateCorpusReportRow[] = loaded.corpus.rows.map((row) => {
    const document = loaded.documents.get(row.documentId);
    if (!document) throw new Error(`Missing document fixture for row ${row.id}`);
    let resolution: MeasurementResolution | null = null;
    let error: string | null = null;
    try {
      resolution = resolver({
        rawLabel: row.rawLabel,
        rawUnit: row.rawUnit,
        rawValueText: row.rawValueText,
        specimen: row.specimen ?? null,
        modifier: row.modifier ?? null,
        section: row.panel,
        valueKind: row.valueKind,
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const actualClassification = resolution?.result ?? null;
    const actualMeasurementDefinitionKey = resolution?.measurementDefinitionKey ?? null;
    const expectedDefinition = row.expected.measurementDefinitionKey ?? null;
    const classificationMatches =
      actualClassification === row.expected.classification &&
      (expectedDefinition === null || actualMeasurementDefinitionKey === expectedDefinition);
    const falseConcreteResolution = actualClassification === "resolved" && row.expected.classification !== "resolved";
    const definition = actualMeasurementDefinitionKey ? getMeasurementDefinition(actualMeasurementDefinitionKey) : undefined;
    const assessmentBindings = (definition?.assessmentBindings ?? [])
      .filter((binding) => binding.status === "reviewed" && binding.compatibility === "compatible")
      .map((binding) => binding.assessmentInputKey)
      .sort();
    const rawPreserved = row.rawLabel.trim().length > 0 && row.rawValueText.trim().length > 0 && (row.valueKind !== "numeric" || row.rawUnit !== null);
    return {
      id: row.id,
      documentId: row.documentId,
      panel: row.panel,
      family: row.family,
      language: document.language,
      laboratory: document.laboratory,
      valueKind: row.valueKind,
      contextAvailability: row.specimen || row.modifier ? "provided" : "missing",
      rawEvidence: {
        label: row.rawLabel,
        unit: row.rawUnit,
        valueText: row.rawValueText,
        hash: hashJson({ label: row.rawLabel, unit: row.rawUnit, valueText: row.rawValueText, valueKind: row.valueKind }),
      },
      rawPreserved,
      expectedClassification: row.expected.classification,
      expectedMeasurementDefinitionKey: expectedDefinition,
      actualClassification,
      actualMeasurementDefinitionKey,
      classificationMatches,
      falseConcreteResolution,
      aliasCovered: Boolean(resolution?.reasons.some((reason) => reason.startsWith("alias_") || reason === "definition_key_match")),
      unitCovered: Boolean(resolution && !resolution.conflicts.some((conflict) => UNIT_CONFLICTS.has(conflict))),
      error,
      manualCorrection: row.expected.manualCorrection ?? null,
      assessmentBindings,
    };
  });

  const resolved = reportRows.filter((row) => row.actualClassification === "resolved").length;
  const partial = reportRows.filter((row) => row.actualClassification === "partial").length;
  const ambiguous = reportRows.filter((row) => row.actualClassification === "ambiguous").length;
  const unmapped = reportRows.filter((row) => row.actualClassification === "unmapped").length;
  const falseConcreteResolutions = reportRows.filter((row) => row.falseConcreteResolution);
  const processingErrors = reportRows.filter((row) => row.error !== null);
  const manualCorrections = reportRows.filter((row) => row.manualCorrection !== null);
  const assessmentImpact = reportRows.flatMap((row) => {
    const impacts: CandidateCorpusReport["assessmentImpact"] = [];
    if (row.actualMeasurementDefinitionKey !== null && row.assessmentBindings.length > 0) {
      impacts.push({
        rowId: row.id,
        definitionKey: row.actualMeasurementDefinitionKey,
        assessmentInputKeys: row.assessmentBindings,
        source: "resolved",
      });
    }
    const correctedDefinitionKey = row.manualCorrection?.selectedDefinitionKey;
    const correctedBindings = correctedDefinitionKey
      ? (getMeasurementDefinition(correctedDefinitionKey)?.assessmentBindings ?? [])
          .filter((binding) => binding.status === "reviewed" && binding.compatibility === "compatible")
          .map((binding) => binding.assessmentInputKey)
          .sort()
      : [];
    if (correctedDefinitionKey && correctedBindings.length > 0) {
      impacts.push({
        rowId: row.id,
        definitionKey: correctedDefinitionKey,
        assessmentInputKeys: correctedBindings,
        source: "manual_correction",
      });
    }
    return impacts;
  });
  const report: CandidateCorpusReport = {
    schemaVersion: "1",
    candidateId: loaded.corpus.candidate.id,
    candidateInputHash: inputHash,
    coverage: {
      requiredRows: loaded.corpus.requiredRowCount,
      actualRows: reportRows.length,
      documentCount: loaded.documents.size,
      deidentifiedDocumentCount: [...loaded.documents.values()].filter((document) => document.deidentified).length,
      missingContextNegativeCount: reportRows.filter((row) => row.contextAvailability === "missing" && row.expectedClassification !== "resolved").length,
      panels: [...new Set(reportRows.map((row) => row.panel))].sort(),
      languages: [...new Set(reportRows.map((row) => row.language))].sort(),
      laboratories: [...new Set(reportRows.map((row) => row.laboratory))].sort(),
      specialtyDocumentCount: [...loaded.documents.values()].filter((document) => document.specialtyRows).length,
    },
    metrics: {
      rawPreservationRate: countRate(reportRows, (row) => row.rawPreserved),
      recognitionRate: countRate(reportRows, (row) => row.actualClassification !== null && row.actualClassification !== "unmapped"),
      expectedClassificationRate: countRate(reportRows, (row) => row.classificationMatches),
      aliasCoverageRate: countRate(reportRows, (row) => row.aliasCovered),
      unitCoverageRate: countRate(reportRows, (row) => row.unitCovered),
      resolved,
      partial,
      ambiguous,
      unmapped,
      falseConcreteResolutions: falseConcreteResolutions.length,
      processingErrors: processingErrors.length,
      unclassifiedRows: loaded.fixtureErrors.filter((error) => error.includes("expected classification")).length,
    },
    rows: reportRows,
    falseConcreteResolutions,
    processingErrors,
    manualCorrections,
    assessmentImpact,
    segments: {
      panel: toSegments(reportRows, (row) => row.panel),
      family: toSegments(reportRows, (row) => row.family),
      language: toSegments(reportRows, (row) => row.language),
      laboratory: toSegments(reportRows, (row) => row.laboratory),
      valueKind: toSegments(reportRows, (row) => row.valueKind),
      contextAvailability: toSegments(reportRows, (row) => row.contextAvailability),
    },
  };
  const checks = thresholdChecks(report, loaded.policy);
  const approvals = validateApprovals(
    loaded.approvals,
    loaded.policy,
    inputHash,
    assessmentImpact.map((item) => item.definitionKey)
  );
  const manifestWithoutHash: Omit<CandidateReleaseManifest, "manifestHash"> = {
    schemaVersion: "1",
    candidate: {
      id: loaded.corpus.candidate.id,
      registryRelease: loaded.corpus.candidate.registryRelease,
      catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
      catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_DIGEST,
      resolverVersion: MEASUREMENT_RESOLVER_VERSION,
      normalizationVersion: MEASUREMENT_NORMALIZATION_VERSION,
    },
    candidateInputHash: inputHash,
    inputHashes,
    reportHash: hashJson(report),
    approvalEvidenceHash: approvals.approvalsHash,
    thresholdChecks: checks,
    approvals: { valid: approvals.valid, errors: approvals.errors },
    fixtureErrors: loaded.fixtureErrors,
    launchable: loaded.fixtureErrors.length === 0 && checks.every((check) => check.passed) && approvals.valid,
  };
  const manifest: CandidateReleaseManifest = {
    ...manifestWithoutHash,
    manifestHash: hashJson(manifestWithoutHash),
  };
  return { manifest, report };
}

export function candidateCorpusSummary(run: CandidateCorpusRun): Record<string, unknown> {
  return {
    candidate: run.manifest.candidate.id,
    candidateInputHash: run.manifest.candidateInputHash,
    manifestHash: run.manifest.manifestHash,
    reportHash: run.manifest.reportHash,
    launchable: run.manifest.launchable,
    rows: run.report.coverage.actualRows,
    thresholdChecks: run.manifest.thresholdChecks,
    approvalErrors: run.manifest.approvals.errors,
    fixtureErrors: run.manifest.fixtureErrors,
  };
}
