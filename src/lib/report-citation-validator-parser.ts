import {
  addIssue,
  CLAIM_KEYS,
  CLAIM_REF_KEYS,
  CLAIM_SECTION_RULES,
  CITATION_KEYS,
  CONTENT_KEYS,
  EMPTY_STATE_BY_SECTION,
  hasOnlyKeys,
  isRecord,
  isOneOf,
  LIMITATION_KEYS,
  LIMITATION_REF_KEYS,
  MACHINE_LIMITATIONS,
  nonEmptyString,
  REPORT_CLAIM_KINDS,
  REPORT_CLAIM_ORIGINS,
  REPORT_CLAIM_STATUSES,
  REPORT_DETAIL_LEVELS,
  REPORT_EMPTY_STATES,
  REPORT_SECTION_IDS,
  REPORT_SOURCE_KINDS,
  SECTION_KEYS,
  SOURCE_KEYS,
  SOURCE_REF_KEYS,
  uniqueStrings,
  UNSAFE_CLAIM_FIELDS,
  type MachineLimitationCode,
  type ParsedClaim,
  type ParsedHeader,
  type ParsedSection,
  type ParseResult,
  type ReportCitation,
  type ReportCitationIssueCode,
  type ReportClaim,
  type ReportContent,
  type ReportLimitation,
  type ReportSection,
  type ReportSectionId,
  type ReportSectionItem,
  type ReportSource,
  type ReportSourceReference,
  type ReportTemplateParams,
  type ReportClaimStatus,
  type SourceAvailability,
  type SourceDocumentStatus,
  type UnknownRecord,
  RECOGNIZED_REPORT_SCHEMA_VERSIONS,
} from "./report-citation-validator-contract";

function parseHeader(
  record: UnknownRecord,
  issues: Set<ReportCitationIssueCode>,
): ParseResult<ParsedHeader> {
  if (!hasOnlyKeys(record, CONTENT_KEYS)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  const schemaVersion = record.schema_version;
  const reportKind = record.report_kind;
  const generatedAt = record.generated_at;
  const detailLevel = record.detail_level;
  const documentIds = record.source_document_ids;
  const disclaimer = record.disclaimer;

  if (
    !nonEmptyString(schemaVersion) ||
    !isOneOf(schemaVersion, RECOGNIZED_REPORT_SCHEMA_VERSIONS) ||
    !nonEmptyString(reportKind) ||
    !nonEmptyString(generatedAt) ||
    !Number.isFinite(Date.parse(generatedAt)) ||
    !isOneOf(detailLevel, REPORT_DETAIL_LEVELS) ||
    !Array.isArray(documentIds) ||
    !documentIds.every(nonEmptyString) ||
    !uniqueStrings(documentIds) ||
    !nonEmptyString(disclaimer)
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      schema_version: schemaVersion,
      report_kind: reportKind,
      generated_at: generatedAt,
      detail_level: detailLevel,
      source_document_ids: [...documentIds],
      disclaimer: disclaimer.trim(),
      ...(record.extensions !== undefined
        ? { extensions: record.extensions }
        : {}),
    },
  };
}

function parseCitation(value: unknown): ParseResult<ReportCitation> {
  if (!isRecord(value) || !hasOnlyKeys(value, CITATION_KEYS)) {
    return { ok: false };
  }
  if (!nonEmptyString(value.source_id) || !nonEmptyString(value.document_id)) {
    return { ok: false };
  }
  return {
    ok: true,
    value: {
      source_id: value.source_id,
      document_id: value.document_id,
    },
  };
}

function parseCitations(
  value: unknown,
  issues: Set<ReportCitationIssueCode>,
): ParseResult<readonly ReportCitation[]> {
  if (!Array.isArray(value)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  const citations: ReportCitation[] = [];
  const seen = new Map<string, string>();
  for (const item of value) {
    const parsed = parseCitation(item);
    if (!parsed.ok) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
    const previousDocumentId = seen.get(parsed.value.source_id);
    if (previousDocumentId !== undefined) {
      if (previousDocumentId !== parsed.value.document_id) {
        addIssue(issues, "SCHEMA_INVALID");
        return { ok: false };
      }
      continue;
    }
    seen.set(parsed.value.source_id, parsed.value.document_id);
    citations.push(parsed.value);
  }
  return { ok: true, value: citations };
}

function parseTemplateParams(
  value: unknown,
): ParseResult<ReportTemplateParams> {
  if (!isRecord(value)) return { ok: false };
  const keys = Object.keys(value);
  if (
    keys.some(
      (key) => !["source_id", "include_date", "include_range"].includes(key),
    ) ||
    !nonEmptyString(value.source_id)
  ) {
    return { ok: false };
  }
  if (
    value.include_date !== undefined &&
    typeof value.include_date !== "boolean"
  ) {
    return { ok: false };
  }
  if (
    value.include_range !== undefined &&
    typeof value.include_range !== "boolean"
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    value: {
      source_id: value.source_id,
      ...(value.include_date !== undefined
        ? { include_date: value.include_date }
        : {}),
      ...(value.include_range !== undefined
        ? { include_range: value.include_range }
        : {}),
    },
  };
}

function validateTemplateShape(
  claim: ParsedClaim,
  issues: Set<ReportCitationIssueCode>,
): boolean {
  if (claim.status === "removed" || claim.unsafe) return true;

  if (claim.kind === "clinician_question") {
    if (
      claim.template_id !== undefined ||
      claim.template_params !== undefined
    ) {
      addIssue(issues, "SCHEMA_INVALID");
      return false;
    }
    return true;
  }

  const expectedTemplate =
    claim.kind === "source_fact"
      ? "source_fact_snapshot"
      : "numeric_observation_snapshot";
  if (
    claim.template_id !== expectedTemplate ||
    claim.template_params === undefined
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return false;
  }

  const params = claim.template_params;
  const keys = Object.keys(params);
  const expectedKeys =
    claim.kind === "source_fact"
      ? ["source_id", "include_date"]
      : ["source_id", "include_range"];
  if (
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !keys.includes(key)) ||
    !nonEmptyString(params.source_id) ||
    (claim.kind === "source_fact" &&
      typeof params.include_date !== "boolean") ||
    (claim.kind === "numeric_observation" &&
      typeof params.include_range !== "boolean")
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return false;
  }
  return true;
}

function parseClaim(
  value: unknown,
  issues: Set<ReportCitationIssueCode>,
): ParseResult<ParsedClaim> {
  if (!isRecord(value) || !hasOnlyKeys(value, CLAIM_KEYS)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  const id = value.id;
  const section = value.section;
  const kind = value.kind;
  const origin = value.origin;
  const factual = value.factual;
  const status = value.status;
  const citations = parseCitations(value.citations, issues);

  if (
    !nonEmptyString(id) ||
    !isOneOf(section, REPORT_SECTION_IDS) ||
    !isOneOf(kind, REPORT_CLAIM_KINDS) ||
    !isOneOf(origin, REPORT_CLAIM_ORIGINS) ||
    typeof factual !== "boolean" ||
    !isOneOf(status, REPORT_CLAIM_STATUSES) ||
    !citations.ok
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  const unsafe = Object.keys(value).some(
    (key) => UNSAFE_CLAIM_FIELDS[key] === true,
  );
  const templateParams =
    value.template_params === undefined
      ? undefined
      : parseTemplateParams(value.template_params);
  if (value.template_params !== undefined && !templateParams?.ok) {
    if (!unsafe) addIssue(issues, "SCHEMA_INVALID");
    return unsafe
      ? {
          ok: true,
          value: {
            id,
            section,
            kind,
            origin,
            factual,
            status,
            citations: citations.value,
            unsafe: true,
          },
        }
      : { ok: false };
  }

  if (
    value.question_text !== undefined &&
    typeof value.question_text !== "string"
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  const parsed: ParsedClaim = {
    id,
    section,
    kind,
    origin,
    factual,
    status,
    citations: citations.value,
    ...(value.template_id !== undefined
      ? { template_id: value.template_id as ReportClaim["template_id"] }
      : {}),
    ...(templateParams?.ok ? { template_params: templateParams.value } : {}),
    ...(typeof value.question_text === "string"
      ? { question_text: value.question_text }
      : {}),
    unsafe,
  };

  if (status !== "removed") {
    if (status !== "supported") {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
    if (
      (kind !== "clinician_question" &&
        (factual !== true || origin !== "generated")) ||
      (kind === "clinician_question" &&
        (factual !== false || !nonEmptyString(value.question_text)))
    ) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
    if (!validateTemplateShape(parsed, issues)) return { ok: false };
    if (kind === "clinician_question" && parsed.citations.length > 0) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
  }

  return { ok: true, value: parsed };
}

function parseSource(
  value: unknown,
  issues: Set<ReportCitationIssueCode>,
): ParseResult<ReportSourceReference> {
  if (!isRecord(value) || !hasOnlyKeys(value, SOURCE_KEYS)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  if (
    !nonEmptyString(value.source_id) ||
    !isOneOf(value.kind, REPORT_SOURCE_KINDS) ||
    !nonEmptyString(value.document_id)
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  return {
    ok: true,
    value: {
      source_id: value.source_id,
      kind: value.kind,
      document_id: value.document_id,
    },
  };
}

function expectedItemType(section: ReportSectionId): ReportSectionItem["type"] {
  if (section === "limitations") return "limitation_ref";
  if (section === "source_ledger") return "source_ref";
  return "claim_ref";
}

function parseSection(
  value: unknown,
  expectedId: ReportSectionId,
  issues: Set<ReportCitationIssueCode>,
): ParseResult<ParsedSection> {
  if (!isRecord(value) || !hasOnlyKeys(value, SECTION_KEYS)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  if (value.id !== expectedId || !Array.isArray(value.items)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  const emptyState = value.empty_state;
  if (emptyState !== undefined && !isOneOf(emptyState, REPORT_EMPTY_STATES)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  if (value.items.length === 0 && emptyState === undefined) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  if (value.items.length > 0 && emptyState !== undefined) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  if (
    (expectedId === "limitations" || expectedId === "source_ledger") &&
    emptyState !== undefined &&
    emptyState !== "no_data"
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  const itemType = expectedItemType(expectedId);
  const items: ReportSectionItem[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
    if (item.type !== itemType) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }

    if (itemType === "claim_ref") {
      if (
        !hasOnlyKeys(item, CLAIM_REF_KEYS) ||
        !nonEmptyString(item.claim_id)
      ) {
        addIssue(issues, "SCHEMA_INVALID");
        return { ok: false };
      }
      items.push({ type: "claim_ref", claim_id: item.claim_id });
    } else if (itemType === "limitation_ref") {
      if (
        !hasOnlyKeys(item, LIMITATION_REF_KEYS) ||
        !nonEmptyString(item.limitation_id)
      ) {
        addIssue(issues, "SCHEMA_INVALID");
        return { ok: false };
      }
      items.push({
        type: "limitation_ref",
        limitation_id: item.limitation_id,
      });
    } else {
      if (
        !hasOnlyKeys(item, SOURCE_REF_KEYS) ||
        !nonEmptyString(item.source_id)
      ) {
        addIssue(issues, "SCHEMA_INVALID");
        return { ok: false };
      }
      items.push({ type: "source_ref", source_id: item.source_id });
    }
  }

  return {
    ok: true,
    value: {
      id: expectedId,
      items,
      ...(emptyState !== undefined ? { empty_state: emptyState } : {}),
    },
  };
}

function parseLimitations(
  value: unknown,
  issues: Set<ReportCitationIssueCode>,
): ParseResult<readonly ReportLimitation[]> {
  if (!Array.isArray(value) || value.length > 0) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  return { ok: true, value: [] };
}

function parseTopLevelArrays(
  record: UnknownRecord,
  issues: Set<ReportCitationIssueCode>,
): ParseResult<{
  claims: readonly ParsedClaim[];
  sources: readonly ReportSourceReference[];
  limitations: readonly ReportLimitation[];
  sections: readonly ParsedSection[];
}> {
  if (
    !Array.isArray(record.claims) ||
    !Array.isArray(record.sources) ||
    record.limitations === undefined ||
    !Array.isArray(record.sections)
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  if (record.sections.length !== REPORT_SECTION_IDS.length) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  const claims: ParsedClaim[] = [];
  const claimIds = new Set<string>();
  for (const rawClaim of record.claims) {
    const parsed = parseClaim(rawClaim, issues);
    if (!parsed.ok || claimIds.has(parsed.value.id)) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
    claimIds.add(parsed.value.id);
    claims.push(parsed.value);
  }

  const sources: ReportSourceReference[] = [];
  const sourceIds = new Set<string>();
  for (const rawSource of record.sources) {
    const parsed = parseSource(rawSource, issues);
    if (!parsed.ok || sourceIds.has(parsed.value.source_id)) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
    sourceIds.add(parsed.value.source_id);
    sources.push(parsed.value);
  }

  const limitations = parseLimitations(record.limitations, issues);
  if (!limitations.ok) return { ok: false };

  const sections: ParsedSection[] = [];
  for (const [index, sectionId] of REPORT_SECTION_IDS.entries()) {
    const parsed = parseSection(record.sections[index], sectionId, issues);
    if (!parsed.ok) return { ok: false };
    sections.push(parsed.value);
  }

  return {
    ok: true,
    value: { claims, sources, limitations: limitations.value, sections },
  };
}

function sourceStatus(row: UnknownRecord): SourceAvailability | null {
  const value = row.source_status ?? row.availability ?? row.status;
  if (value === "active" || value === "archived" || value === "removed") {
    return value;
  }
  if (row.is_archived === true) return "archived";
  if (row.is_removed === true) return "removed";
  return value === undefined ? "active" : null;
}

function documentStatus(row: UnknownRecord): SourceDocumentStatus | null {
  const value =
    row.document_status ?? row.document_lifecycle ?? row.documentState;
  if (value === "active" || value === "deleting" || value === "tombstoned") {
    return value;
  }
  if (row.document_tombstoned === true || row.documentTombstoned === true) {
    return "tombstoned";
  }
  return value === undefined ? "active" : null;
}

function resolverRows(value: unknown): readonly UnknownRecord[] | null {
  if (Array.isArray(value)) {
    return value.every(isRecord) ? value : null;
  }
  if (value instanceof Map) {
    const rows = [...value.values()];
    return rows.every(isRecord) ? rows : null;
  }
  return null;
}
function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}
function machineLimitationId(
  code: MachineLimitationCode,
  limitations: readonly ReportLimitation[],
): string {
  const base = `eh150-${code.toLowerCase()}`;
  if (!limitations.some((limitation) => limitation.id === base)) return base;
  let suffix = 2;
  while (
    limitations.some((limitation) => limitation.id === `${base}-${suffix}`)
  ) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function addMachineLimitation(
  limitations: ReportLimitation[],
  code: MachineLimitationCode,
): void {
  if (limitations.some((limitation) => limitation.code === code)) return;
  const machine = MACHINE_LIMITATIONS[code];
  limitations.push({
    id: machineLimitationId(code, limitations),
    code: machine.code,
    message: machine.message,
  });
}

function projectClaim(
  claim: ParsedClaim,
  status: Exclude<ReportClaimStatus, "removed">,
): ReportClaim {
  if (claim.kind === "clinician_question") {
    return {
      id: claim.id,
      section: claim.section,
      kind: claim.kind,
      origin: claim.origin,
      citations: [],
      factual: false,
      status,
      question_text: claim.question_text!.normalize("NFC").trim(),
    };
  }
  return {
    id: claim.id,
    section: claim.section,
    kind: claim.kind,
    origin: "generated",
    citations: claim.citations,
    factual: true,
    status,
    template_id: claim.template_id,
    template_params: claim.template_params,
  };
}

function projectedContent(
  header: ParsedHeader,
  sections: readonly ReportSection[],
  claims: readonly ReportClaim[],
  sources: readonly ReportSource[],
  limitations: readonly ReportLimitation[],
): ReportContent {
  return {
    ...header,
    sections,
    claims,
    sources,
    limitations,
  };
}

function safeQuestionText(value: string): boolean {
  const normalized = value.normalize("NFC").trim();
  if (
    normalized.length === 0 ||
    [...normalized].length > 240 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    return false;
  }
  return true;
}
export {
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
};
