import assert from "node:assert/strict";
import {
  CURRENT_VALIDATOR_VERSION,
  isRecognizedValidatorVersion,
  validateReportContent,
  validateReportValidationEnvelope,
  type AuthorizedReportSource,
  type ReportCitationValidationContext,
  type ReportValidationResult,
} from "../src/lib/report-citation-validator";
import {
  DOCUMENT_A,
  DOCUMENT_B,
  PROFILE_A,
  PROFILE_B,
  SOURCE_SUMMARY,
  SOURCE_OBSERVATION,
  VALID_AUTHORIZED_SOURCES,
  cloneReportContent,
  makeValidationContext,
} from "./fixtures/eh150-report-citation-validator";

const VALIDATOR_SCRIPT_NAME = "verify-eh150-report-citation-validator";
type MutableContent = {
  schema_version: string;
  overview?: string;
  source_document_ids: string[];
  sections: Array<Record<string, unknown>>;
  claims: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
};

function mutableContent(): MutableContent {
  return cloneReportContent() as unknown as MutableContent;
}

function findClaim(
  content: MutableContent,
  id: string,
): Record<string, unknown> {
  const claim = content.claims.find((candidate) => candidate.id === id);
  assert.ok(claim, `fixture claim ${id} exists`);
  return claim;
}

function findSource(
  content: MutableContent,
  id: string,
): Record<string, unknown> {
  const source = content.sources.find(
    (candidate) => candidate.source_id === id,
  );
  assert.ok(source, `fixture source ${id} exists`);
  return source;
}
function addRetainedSummaryClaim(content: MutableContent): void {
  const original = findClaim(content, "claim-summary");
  const retained = {
    ...original,
    id: "claim-summary-retained",
    status: "supported",
    citations: [{ source_id: SOURCE_SUMMARY, document_id: DOCUMENT_A }],
  };
  content.claims.push(retained);
  const items = content.sections[0]?.items;
  assert.ok(Array.isArray(items), "document summary items exist");
  items.push({ type: "claim_ref", claim_id: retained.id });
}

async function validate(
  content: unknown,
  context: ReportCitationValidationContext = makeValidationContext(),
): Promise<ReportValidationResult> {
  return validateReportContent(content, context);
}

async function main(): Promise<void> {
  const valid = await validate(cloneReportContent());
  assert.equal(valid.status, "valid");
  assert.equal(valid.version, CURRENT_VALIDATOR_VERSION);
  assert.deepEqual(valid.issue_codes, []);
  assert.equal(valid.content?.sections.length, 6);
  assert.equal(valid.content?.claims.length, 3);
  assert.equal(valid.content?.limitations.length, 1);
  assert.equal(JSON.stringify(valid.content).includes(PROFILE_A), false);
  assert.deepEqual(
    valid.content?.sources.find((source) => source.source_id === SOURCE_SUMMARY)
      ?.snapshot,
    { text: "Trusted synthetic document summary." },
  );

  const missingSection = mutableContent();
  missingSection.sections.splice(2, 1);
  const missingSectionResult = await validate(missingSection);
  assert.equal(missingSectionResult.status, "invalid");
  assert.deepEqual(missingSectionResult.issue_codes, ["SCHEMA_INVALID"]);
  const unknownContractVersion = mutableContent();
  unknownContractVersion.schema_version = "eh148.v99";
  const unknownContractVersionResult = await validate(unknownContractVersion);
  assert.equal(unknownContractVersionResult.status, "invalid");
  assert.deepEqual(unknownContractVersionResult.issue_codes, [
    "SCHEMA_INVALID",
  ]);
  const candidateOverview = mutableContent();
  candidateOverview.overview =
    "Diagnosis or treatment prose must not bypass claims";
  const candidateOverviewResult = await validate(candidateOverview);
  assert.equal(candidateOverviewResult.status, "invalid");
  assert.deepEqual(candidateOverviewResult.issue_codes, ["SCHEMA_INVALID"]);

  const unknownSection = mutableContent();
  unknownSection.sections[2].id = "unknown_section";
  const unknownSectionResult = await validate(unknownSection);
  assert.equal(unknownSectionResult.status, "invalid");
  assert.deepEqual(unknownSectionResult.issue_codes, ["SCHEMA_INVALID"]);

  const duplicateSection = mutableContent();
  duplicateSection.sections[1].id = "document_summary";
  const duplicateSectionResult = await validate(duplicateSection);
  assert.equal(duplicateSectionResult.status, "invalid");
  assert.deepEqual(duplicateSectionResult.issue_codes, ["SCHEMA_INVALID"]);

  const missingEmptyState = mutableContent();
  missingEmptyState.sections[1].items = [];
  delete missingEmptyState.sections[1].empty_state;
  const missingEmptyStateResult = await validate(missingEmptyState);
  assert.equal(missingEmptyStateResult.status, "invalid");
  assert.deepEqual(missingEmptyStateResult.issue_codes, ["SCHEMA_INVALID"]);

  const incompatibleClaim = mutableContent();
  findClaim(incompatibleClaim, "claim-summary").section = "clinician_questions";
  const incompatibleClaimResult = await validate(incompatibleClaim);
  assert.equal(incompatibleClaimResult.status, "invalid");
  assert.deepEqual(incompatibleClaimResult.issue_codes, ["SCHEMA_INVALID"]);
  const unknownTemplate = mutableContent();
  findClaim(unknownTemplate, "claim-summary").template_id = "unknown_template";
  const unknownTemplateResult = await validate(unknownTemplate);
  assert.equal(unknownTemplateResult.status, "invalid");
  assert.deepEqual(unknownTemplateResult.issue_codes, ["SCHEMA_INVALID"]);

  const invalidLimitationsEmptyState = mutableContent();
  invalidLimitationsEmptyState.sections[4].empty_state =
    "insufficient_evidence";
  const invalidLimitationsResult = await validate(invalidLimitationsEmptyState);
  assert.equal(invalidLimitationsResult.status, "invalid");
  assert.deepEqual(invalidLimitationsResult.issue_codes, ["SCHEMA_INVALID"]);

  const unknownSource = mutableContent();
  findClaim(unknownSource, "claim-summary").citations = [
    { source_id: "missing-source", document_id: DOCUMENT_A },
  ];
  const unknownSourceResult = await validate(unknownSource);
  assert.equal(unknownSourceResult.status, "invalid");
  assert.deepEqual(unknownSourceResult.issue_codes, ["SOURCE_NOT_FOUND"]);

  const brokenCitation = mutableContent();
  findClaim(brokenCitation, "claim-summary").citations = [
    { source_id: "source-summary", document_id: DOCUMENT_B },
  ];
  const brokenCitationResult = await validate(brokenCitation);
  assert.equal(brokenCitationResult.status, "invalid");
  assert.deepEqual(brokenCitationResult.issue_codes, ["SOURCE_NOT_FOUND"]);

  const outOfScope = mutableContent();
  outOfScope.source_document_ids = [DOCUMENT_B];
  const outOfScopeResult = await validate(
    outOfScope,
    makeValidationContext(VALID_AUTHORIZED_SOURCES, {
      documentScope: [DOCUMENT_B],
    }),
  );
  assert.equal(outOfScopeResult.status, "invalid");
  assert.deepEqual(outOfScopeResult.issue_codes, ["DOCUMENT_OUT_OF_SCOPE"]);

  const crossProfileRows = VALID_AUTHORIZED_SOURCES.map((row) => ({
    ...row,
    profile_id: PROFILE_B,
  }));
  const crossProfileResult = await validate(
    cloneReportContent(),
    makeValidationContext(crossProfileRows, { profileId: PROFILE_A }),
  );
  assert.equal(crossProfileResult.status, "invalid");
  assert.deepEqual(crossProfileResult.issue_codes, ["PROFILE_MISMATCH"]);
  assert.equal(JSON.stringify(crossProfileResult).includes(PROFILE_B), false);

  const sourceKindRows = VALID_AUTHORIZED_SOURCES.map((row) =>
    row.source_id === SOURCE_OBSERVATION ? { ...row, kind: "finding" } : row,
  ) as AuthorizedReportSource[];
  const sourceKindResult = await validate(
    cloneReportContent(),
    makeValidationContext(sourceKindRows),
  );
  assert.equal(sourceKindResult.status, "invalid");
  assert.deepEqual(sourceKindResult.issue_codes, ["SOURCE_KIND_NOT_ALLOWED"]);

  const archivedRows = VALID_AUTHORIZED_SOURCES.map((row) =>
    row.source_id === SOURCE_OBSERVATION
      ? { ...row, source_status: "archived" as const }
      : row,
  );
  const archivedResult = await validate(
    cloneReportContent(),
    makeValidationContext(archivedRows),
  );
  assert.equal(archivedResult.status, "limited");
  assert.deepEqual(archivedResult.issue_codes, ["SOURCE_UNAVAILABLE"]);
  assert.equal(
    archivedResult.content?.claims.find(
      (claim) => claim.id === "claim-observation",
    )?.status,
    "limited",
  );
  assert.equal(
    archivedResult.content?.limitations.some(
      (limitation) => limitation.code === "SOURCE_UNAVAILABLE",
    ),
    true,
  );
  const removedRows = VALID_AUTHORIZED_SOURCES.map((row) =>
    row.source_id === SOURCE_OBSERVATION
      ? { ...row, source_status: "removed" as const }
      : row,
  );
  const removedSourceResult = await validate(
    cloneReportContent(),
    makeValidationContext(removedRows),
  );
  assert.equal(removedSourceResult.status, "limited");
  assert.deepEqual(removedSourceResult.issue_codes, ["SOURCE_UNAVAILABLE"]);

  const tombstonedRows = VALID_AUTHORIZED_SOURCES.map((row) =>
    row.source_id === SOURCE_OBSERVATION
      ? { ...row, document_status: "tombstoned" as const }
      : row,
  );
  const tombstonedResult = await validate(
    cloneReportContent(),
    makeValidationContext(tombstonedRows),
  );
  assert.equal(tombstonedResult.status, "invalid");
  assert.deepEqual(tombstonedResult.issue_codes, ["SOURCE_UNAVAILABLE"]);
  assert.equal(tombstonedResult.content, null);

  const uncited = mutableContent();
  addRetainedSummaryClaim(uncited);
  findClaim(uncited, "claim-summary").citations = [];
  const uncitedResult = await validate(uncited);
  assert.equal(uncitedResult.status, "limited");
  assert.deepEqual(uncitedResult.issue_codes, ["CLAIM_UNCITED"]);
  assert.equal(
    uncitedResult.content?.claims.some((claim) => claim.id === "claim-summary"),
    false,
  );
  assert.equal(
    uncitedResult.content?.limitations.some(
      (limitation) => limitation.code === "CLAIM_UNCITED",
    ),
    true,
  );
  const emptiedBySanitization = mutableContent();
  findClaim(emptiedBySanitization, "claim-summary").citations = [];
  const emptiedBySanitizationResult = await validate(emptiedBySanitization);
  assert.equal(emptiedBySanitizationResult.status, "invalid");
  assert.equal(
    emptiedBySanitizationResult.issue_codes.includes("SCHEMA_INVALID"),
    true,
  );

  const unsafe = mutableContent();
  addRetainedSummaryClaim(unsafe);
  const unsafeClaim = findClaim(unsafe, "claim-summary");
  unsafeClaim.text = "Unsafe directive must never be published";
  unsafeClaim.diagnosis = "Synthetic diagnosis";
  const unsafeResult = await validate(unsafe);
  assert.equal(unsafeResult.status, "limited");
  assert.deepEqual(unsafeResult.issue_codes, ["UNSAFE_CONTENT"]);
  assert.equal(
    unsafeResult.content?.claims.some((claim) => claim.id === "claim-summary"),
    false,
  );
  assert.equal(
    JSON.stringify(unsafeResult).includes("Unsafe directive"),
    false,
  );
  assert.equal(
    JSON.stringify(unsafeResult).includes("Synthetic diagnosis"),
    false,
  );
  assert.equal(
    unsafeResult.content?.claims.some((claim) => claim.id === "claim-question"),
    true,
  );
  const removed = mutableContent();
  addRetainedSummaryClaim(removed);
  findClaim(removed, "claim-summary").status = "removed";
  const removedResult = await validate(removed);
  assert.equal(removedResult.status, "valid");
  assert.equal(
    removedResult.content?.claims.some((claim) => claim.id === "claim-summary"),
    false,
  );
  assert.equal(
    JSON.stringify(removedResult.content).includes('"claim-summary"'),
    false,
  );

  const unsafeSnapshot = mutableContent();
  findSource(unsafeSnapshot, SOURCE_SUMMARY).snapshot = {
    text: "Synthetic document summary.",
    storage_path: "profiles/profile-a/private/report.pdf",
    token: "secret-token",
  };
  const unsafeSnapshotResult = await validate(unsafeSnapshot);
  assert.equal(unsafeSnapshotResult.status, "invalid");
  assert.deepEqual(unsafeSnapshotResult.issue_codes, ["SCHEMA_INVALID"]);
  assert.equal(
    JSON.stringify(unsafeSnapshotResult).includes("secret-token"),
    false,
  );

  const preLimited = mutableContent();
  findClaim(preLimited, "claim-summary").status = "limited";
  const preLimitedResult = await validate(preLimited);
  assert.equal(preLimitedResult.status, "invalid");
  assert.deepEqual(preLimitedResult.issue_codes, ["SCHEMA_INVALID"]);

  assert.equal(isRecognizedValidatorVersion(CURRENT_VALIDATOR_VERSION), true);
  assert.equal(isRecognizedValidatorVersion("eh150.v0"), true);
  assert.equal(isRecognizedValidatorVersion("eh150.v2"), false);
  assert.equal(isRecognizedValidatorVersion("eh150.retired"), false);
  assert.equal(isRecognizedValidatorVersion(null), false);

  assert.equal(
    validateReportValidationEnvelope({
      status: "valid",
      version: CURRENT_VALIDATOR_VERSION,
      issue_codes: [],
    }).valid,
    true,
  );
  assert.equal(
    validateReportValidationEnvelope({
      status: "limited",
      version: "eh150.v0",
      issue_codes: ["CLAIM_UNCITED"],
    }).valid,
    true,
  );
  assert.equal(
    validateReportValidationEnvelope({
      status: "limited",
      version: "eh150.v1",
      issue_codes: ["PROFILE_MISMATCH"],
    }).valid,
    false,
  );
  assert.equal(
    validateReportValidationEnvelope({
      status: "valid",
      version: "eh150.v1",
      issue_codes: ["UNSAFE_CONTENT"],
    }).valid,
    false,
  );
  assert.equal(
    validateReportValidationEnvelope({
      status: "limited",
      version: "eh150.v2",
      issue_codes: ["CLAIM_UNCITED"],
    }).valid,
    false,
  );
  assert.equal(validateReportValidationEnvelope(null).valid, false);
  assert.equal(
    validateReportValidationEnvelope({
      status: "limited",
      version: CURRENT_VALIDATOR_VERSION,
      issue_codes: [],
    }).valid,
    false,
  );
  assert.equal(
    validateReportValidationEnvelope({
      status: "valid",
      version: CURRENT_VALIDATOR_VERSION,
      issue_codes: [],
      unexpected: "tampered",
    }).valid,
    false,
  );

  const malformedResolverResult = await validate(cloneReportContent(), {
    ...makeValidationContext(),
    resolve_sources: () =>
      [
        ...VALID_AUTHORIZED_SOURCES,
        "not-a-source-row",
      ] as unknown as AuthorizedReportSource[],
  });
  assert.equal(malformedResolverResult.status, "invalid");
  assert.deepEqual(malformedResolverResult.issue_codes, ["SOURCE_NOT_FOUND"]);

  const batchCalls: string[][] = [];
  const batchContext: ReportCitationValidationContext = {
    profile_id: PROFILE_A,
    document_scope: [DOCUMENT_A],
    resolve_sources: (sourceIds) => {
      batchCalls.push([...sourceIds]);
      return VALID_AUTHORIZED_SOURCES;
    },
  };
  await validate(cloneReportContent(), batchContext);
  assert.deepEqual(batchCalls, [["source-summary", SOURCE_OBSERVATION]]);

  console.log(`${VALIDATOR_SCRIPT_NAME}: all checks passed`);
}

void main().catch((error: unknown) => {
  console.error(`${VALIDATOR_SCRIPT_NAME}: failed`);
  console.error(error);
  process.exitCode = 1;
});
