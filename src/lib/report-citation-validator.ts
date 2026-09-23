export {
  CURRENT_REPORT_SCHEMA_VERSION,
  CURRENT_VALIDATOR_VERSION,
  PUBLISHABLE_VALIDATION_STATUSES,
  RECOGNIZED_REPORT_SCHEMA_VERSIONS,
  RECOGNIZED_VALIDATOR_VERSIONS,
  REPORT_CLAIM_KINDS,
  REPORT_CLAIM_ORIGINS,
  REPORT_CLAIM_STATUSES,
  REPORT_CITATION_ISSUE_CODES,
  REPORT_DETAIL_LEVELS,
  REPORT_EMPTY_STATES,
  REPORT_SECTION_IDS,
  REPORT_SOURCE_KINDS,
  RETIRED_VALIDATOR_VERSIONS,
  VALIDATION_STATUSES,
  isPublishableValidationStatus,
  isRecognizedValidatorVersion,
  isReportCitationIssueCode,
  validateReportValidationEnvelope,
} from "./report-citation-validator-contract";

export type {
  AuthorizedReportSource,
  MachineLimitationCode,
  PublishableValidationStatus,
  ReportCandidateClaim,
  ReportCandidateContent,
  ReportClaim,
  ReportClaimKind,
  ReportClaimOrigin,
  ReportClaimStatus,
  ReportCitation,
  ReportCitationIssueCode,
  ReportCitationValidationContext,
  ReportContent,
  ReportDetailLevel,
  ReportEmptyState,
  ReportLimitation,
  ReportSection,
  ReportSectionId,
  ReportSectionItem,
  ReportSource,
  ReportSourceKind,
  ReportSourceReference,
  ReportSourceResolver,
  ReportTemplateParams,
  ReportValidationEnvelope,
  ReportValidationEnvelopeResult,
  ReportValidationIssue,
  ReportValidationResult,
  SourceAvailability,
  SourceDocumentStatus,
  ValidationStatus,
} from "./report-citation-validator-contract";

import {
  addIssue,
  CLAIM_SECTION_RULES,
  CURRENT_VALIDATOR_VERSION,
  FATAL_IDENTITY_CODES,
  getDocumentScope,
  getProfileId,
  getSourceResolver,
  EMPTY_STATE_BY_SECTION,
  invalidResult,
  isOneOf,
  isRecord,
  projectDisplaySafeSnapshot,
  nonEmptyString,
  orderedIssueCodes,
  resultIssues,
  REPORT_SOURCE_KINDS,
  type ReportCitationIssueCode,
  type ReportClaim,
  type ReportSource,
  type ReportSection,
  type ReportSectionItem,
  type ReportValidationResult,
  type ReportCitationValidationContext,
  type UnknownRecord,
} from "./report-citation-validator-contract";
import {
  addMachineLimitation,
  documentStatus,
  parseHeader,
  parseTopLevelArrays,
  projectClaim,
  projectedContent,
  resolverRows,
  sameSet,
  safeQuestionText,
  sourceStatus,
} from "./report-citation-validator-parser";

/**
 * Validate and sanitize a candidate report at the EH-148 generation seam.
 *
 * The resolver is called once with all source IDs. Its return is treated as an
 * authorization result, not as public content. Invalid identity or scope
 * evidence returns no candidate content; only unsupported but in-scope claim
 * content is downgraded to a limited result.
 */
export async function validateReportContent(
  content: unknown,
  context: ReportCitationValidationContext,
): Promise<ReportValidationResult> {
  const issues = new Set<ReportCitationIssueCode>();
  if (!isRecord(content)) return invalidResult(["SCHEMA_INVALID"]);

  const header = parseHeader(content, issues);
  if (!header.ok) {
    return invalidResult(issues);
  }

  const parsed = parseTopLevelArrays(content, issues);
  if (!parsed.ok) {
    return invalidResult(issues);
  }
  const profileId = getProfileId(context);
  const documentScope = getDocumentScope(context);
  const resolver = getSourceResolver(context);
  if (!profileId || documentScope === null || !resolver) {
    return invalidResult(["SCHEMA_INVALID"]);
  }

  if (!sameSet(header.value.source_document_ids, documentScope)) {
    addIssue(issues, "DOCUMENT_OUT_OF_SCOPE");
    return invalidResult(issues);
  }

  const sourceIds = parsed.value.sources.map((source) => source.source_id);
  const resolvedById = new Map<string, UnknownRecord>();
  const unavailableSourceIds = new Set<string>();
  const trustedSources = new Map<string, ReportSource>();
  let resolved: unknown;
  try {
    resolved = sourceIds.length === 0 ? [] : await resolver(sourceIds);
  } catch {
    return invalidResult(["SOURCE_NOT_FOUND"]);
  }

  const rows = resolverRows(resolved);
  if (rows === null) return invalidResult(["SOURCE_NOT_FOUND"]);
  for (const row of rows) {
    const sourceId = row.source_id;
    if (!nonEmptyString(sourceId) || resolvedById.has(sourceId)) {
      return invalidResult(["SOURCE_NOT_FOUND"]);
    }
    resolvedById.set(sourceId, row);
  }

  for (const source of parsed.value.sources) {
    const row = resolvedById.get(source.source_id);
    if (!row) {
      addIssue(issues, "SOURCE_NOT_FOUND");
      continue;
    }

    const rowKind = row.kind;
    const rowDocumentId = row.document_id;
    const rowProfileId = row.profile_id;
    const rowSourceRowId = row.source_row_id;
    const rowSourceStatus = sourceStatus(row);
    const rowDocumentStatus = documentStatus(row);
    const rowSnapshot = row.snapshot;
    const projectedSnapshot = projectDisplaySafeSnapshot(rowSnapshot);
    const observedAt = row.observed_at;
    const recordedAt = row.recorded_at;

    if (!isOneOf(rowKind, REPORT_SOURCE_KINDS)) {
      addIssue(issues, "SOURCE_KIND_NOT_ALLOWED");
    }
    if (!nonEmptyString(rowProfileId) || rowProfileId !== profileId) {
      addIssue(issues, "PROFILE_MISMATCH");
    }
    if (!nonEmptyString(rowSourceRowId)) {
      addIssue(issues, "SOURCE_NOT_FOUND");
    }
    if (
      !nonEmptyString(rowDocumentId) ||
      rowDocumentId !== source.document_id
    ) {
      addIssue(issues, "SOURCE_NOT_FOUND");
    }
    if (!documentScope.includes(source.document_id)) {
      addIssue(issues, "DOCUMENT_OUT_OF_SCOPE");
    }
    if (rowKind !== source.kind) {
      addIssue(issues, "SOURCE_KIND_NOT_ALLOWED");
    }
    if (rowSourceStatus === null || rowDocumentStatus === null) {
      addIssue(issues, "SOURCE_NOT_FOUND");
    }
    if (
      rowDocumentStatus === "deleting" ||
      rowDocumentStatus === "tombstoned"
    ) {
      addIssue(issues, "SOURCE_UNAVAILABLE");
    } else if (
      rowSourceStatus === "archived" ||
      rowSourceStatus === "removed"
    ) {
      unavailableSourceIds.add(source.source_id);
      addIssue(issues, "SOURCE_UNAVAILABLE");
    }
    if (
      projectedSnapshot === null ||
      (observedAt !== undefined &&
        observedAt !== null &&
        typeof observedAt !== "string") ||
      (recordedAt !== undefined &&
        recordedAt !== null &&
        typeof recordedAt !== "string")
    ) {
      addIssue(issues, "SCHEMA_INVALID");
    }
    if (
      isOneOf(rowKind, REPORT_SOURCE_KINDS) &&
      nonEmptyString(rowDocumentId) &&
      projectedSnapshot !== null
    ) {
      trustedSources.set(source.source_id, {
        source_id: source.source_id,
        kind: rowKind,
        document_id: rowDocumentId,
        snapshot: projectedSnapshot,
        ...(typeof observedAt === "string" || observedAt === null
          ? { observed_at: observedAt }
          : {}),
        ...(typeof recordedAt === "string" || recordedAt === null
          ? { recorded_at: recordedAt }
          : {}),
      });
    }
  }

  if (
    orderedIssueCodes(issues).some(
      (code) => FATAL_IDENTITY_CODES[code] === true,
    )
  ) {
    return invalidResult(issues);
  }
  if (issues.has("SOURCE_UNAVAILABLE")) {
    const tombstoned = parsed.value.sources.some((source) => {
      const row = resolvedById.get(source.source_id);
      if (!row) return false;
      const status = documentStatus(row);
      return status === "deleting" || status === "tombstoned";
    });
    if (tombstoned) return invalidResult(issues);
  }

  const claimById = new Map(
    parsed.value.claims.map((claim) => [claim.id, claim]),
  );
  const sanitizedClaims = new Map<string, ReportClaim>();
  const removedClaimIds = new Set<string>();

  for (const claim of parsed.value.claims) {
    if (!CLAIM_SECTION_RULES[claim.kind].includes(claim.section)) {
      addIssue(issues, "SCHEMA_INVALID");
      continue;
    }
    if (
      !safeQuestionText(claim.question_text ?? "") &&
      claim.kind === "clinician_question"
    ) {
      addIssue(issues, "SCHEMA_INVALID");
      continue;
    }

    let citationProblem = false;
    for (const citation of claim.citations) {
      const source = parsed.value.sources.find(
        (candidate) => candidate.source_id === citation.source_id,
      );
      if (!source) {
        addIssue(issues, "SOURCE_NOT_FOUND");
        citationProblem = true;
        continue;
      }
      if (citation.document_id !== source.document_id) {
        addIssue(issues, "SOURCE_NOT_FOUND");
        citationProblem = true;
        continue;
      }
      if (!documentScope.includes(citation.document_id)) {
        addIssue(issues, "DOCUMENT_OUT_OF_SCOPE");
        citationProblem = true;
      }
      if (
        claim.kind === "numeric_observation" &&
        source.kind !== "observation"
      ) {
        addIssue(issues, "SOURCE_KIND_NOT_ALLOWED");
        citationProblem = true;
      }
    }
    if (citationProblem) continue;

    if (
      claim.template_params !== undefined &&
      claim.citations.length > 0 &&
      !claim.citations.some(
        (citation) => citation.source_id === claim.template_params!.source_id,
      )
    ) {
      addIssue(issues, "SCHEMA_INVALID");
      continue;
    }
    if (claim.unsafe) {
      removedClaimIds.add(claim.id);
      addIssue(issues, "UNSAFE_CONTENT");
      continue;
    }
    if (claim.status === "removed") {
      removedClaimIds.add(claim.id);
      if (claim.kind !== "clinician_question" && claim.citations.length === 0) {
        addIssue(issues, "CLAIM_UNCITED");
      }
      continue;
    }
    if (claim.kind !== "clinician_question" && claim.citations.length === 0) {
      removedClaimIds.add(claim.id);
      addIssue(issues, "CLAIM_UNCITED");
      continue;
    }

    const unavailable = claim.citations.some((citation) =>
      unavailableSourceIds.has(citation.source_id),
    );
    sanitizedClaims.set(
      claim.id,
      projectClaim(claim, unavailable ? "limited" : "supported"),
    );
  }

  if (issues.has("SCHEMA_INVALID")) {
    return invalidResult(issues);
  }
  if (
    orderedIssueCodes(issues).some(
      (code) => FATAL_IDENTITY_CODES[code] === true,
    )
  ) {
    return invalidResult(issues);
  }

  const sourceIdsInLedger = new Set<string>();
  const limitationIdsInLedger = new Set<string>();
  const claimIdsInSections = new Set<string>();
  const outputSections: ReportSection[] = [];
  let hasEmptyEvidenceSection = false;
  const rawLimitations = [...parsed.value.limitations];

  for (const section of parsed.value.sections) {
    const outputItems: ReportSectionItem[] = [];
    for (const item of section.items) {
      if (item.type === "claim_ref") {
        const claim = claimById.get(item.claim_id);
        if (!claim) {
          addIssue(issues, "SCHEMA_INVALID");
          continue;
        }
        if (removedClaimIds.has(claim.id)) continue;
        const projected = sanitizedClaims.get(claim.id);
        if (!projected) continue;
        if (claim.section !== section.id) {
          addIssue(issues, "SCHEMA_INVALID");
          continue;
        }
        if (claimIdsInSections.has(claim.id)) {
          addIssue(issues, "SCHEMA_INVALID");
          continue;
        }
        claimIdsInSections.add(claim.id);
        outputItems.push({ type: "claim_ref", claim_id: claim.id });
      } else if (item.type === "limitation_ref") {
        const limitation = rawLimitations.find(
          (candidate) => candidate.id === item.limitation_id,
        );
        if (!limitation || limitationIdsInLedger.has(limitation.id)) {
          addIssue(issues, "SCHEMA_INVALID");
          continue;
        }
        limitationIdsInLedger.add(limitation.id);
        outputItems.push({
          type: "limitation_ref",
          limitation_id: limitation.id,
        });
      } else {
        const source = parsed.value.sources.find(
          (candidate) => candidate.source_id === item.source_id,
        );
        if (!source || sourceIdsInLedger.has(source.source_id)) {
          addIssue(issues, "SCHEMA_INVALID");
          continue;
        }
        sourceIdsInLedger.add(source.source_id);
        outputItems.push({ type: "source_ref", source_id: source.source_id });
      }
    }

    for (const claim of sanitizedClaims.values()) {
      if (claim.section === section.id && !claimIdsInSections.has(claim.id)) {
        addIssue(issues, "SCHEMA_INVALID");
      }
    }
    if (section.id === "source_ledger") {
      for (const source of parsed.value.sources) {
        if (!sourceIdsInLedger.has(source.source_id)) {
          addIssue(issues, "SCHEMA_INVALID");
        }
      }
    }
    for (const limitation of rawLimitations) {
      if (
        section.id === "limitations" &&
        !limitationIdsInLedger.has(limitation.id)
      ) {
        addIssue(issues, "SCHEMA_INVALID");
      }
    }

    if (outputItems.length === 0) {
      const sanitizedRequiredSection =
        section.id !== "limitations" &&
        section.id !== "source_ledger" &&
        section.items.length > 0 &&
        section.items.every(
          (item) =>
            item.type === "claim_ref" && removedClaimIds.has(item.claim_id),
        );
      if (sanitizedRequiredSection) {
        addIssue(issues, "SCHEMA_INVALID");
      }
      const emptyState =
        section.empty_state ??
        (section.id === "limitations" || section.id === "source_ledger"
          ? "no_data"
          : EMPTY_STATE_BY_SECTION[section.id]);
      if (section.id !== "limitations" && section.id !== "source_ledger") {
        hasEmptyEvidenceSection = true;
      }
      outputSections.push({
        id: section.id,
        items: [],
        empty_state: emptyState,
      });
    } else {
      outputSections.push({ id: section.id, items: outputItems });
    }
  }
  if (hasEmptyEvidenceSection) {
    addMachineLimitation(rawLimitations, "NO_DATA");
  }

  if (issues.has("SCHEMA_INVALID")) {
    return invalidResult(issues);
  }
  if (claimIdsInSections.size !== sanitizedClaims.size) {
    return invalidResult(["SCHEMA_INVALID"]);
  }

  for (const code of [
    "CLAIM_UNCITED",
    "SOURCE_UNAVAILABLE",
    "UNSAFE_CONTENT",
  ] as const) {
    if (issues.has(code)) addMachineLimitation(rawLimitations, code);
  }

  const limitationSection = outputSections.find(
    (section) => section.id === "limitations",
  );
  if (!limitationSection) return invalidResult(["SCHEMA_INVALID"]);
  const limitationItems = [...limitationSection.items];
  const limitationRefs = new Set(
    limitationItems
      .filter(
        (
          item,
        ): item is Readonly<{
          type: "limitation_ref";
          limitation_id: string;
        }> => item.type === "limitation_ref",
      )
      .map((item) => item.limitation_id),
  );
  for (const limitation of rawLimitations) {
    if (!limitationRefs.has(limitation.id)) {
      limitationRefs.add(limitation.id);
      limitationItems.push({
        type: "limitation_ref",
        limitation_id: limitation.id,
      });
    }
  }

  const finalSections = outputSections.map((section) =>
    section.id === "limitations"
      ? limitationItems.length > 0
        ? { id: section.id, items: limitationItems }
        : { id: section.id, items: [], empty_state: "no_data" as const }
      : section,
  );

  const finalClaims = [...sanitizedClaims.values()];
  const finalContent = projectedContent(
    header.value,
    finalSections,
    finalClaims,
    [...trustedSources.values()],
    rawLimitations,
  );

  const ordered = orderedIssueCodes(issues);
  const limited =
    ordered.length > 0 ||
    finalClaims.some((claim) => claim.status === "limited");
  return {
    status: limited ? "limited" : "valid",
    content: finalContent,
    version: CURRENT_VALIDATOR_VERSION,
    issue_codes: ordered,
    issues: resultIssues(ordered),
    safe_summary: limited
      ? "The report was validated with visible limitations."
      : "Report citations validated.",
  };
}
