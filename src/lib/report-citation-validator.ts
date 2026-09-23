import { z } from "zod";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
export const CURRENT_VALIDATOR_VERSION = "eh150.v1" as const;
export const RECOGNIZED_VALIDATOR_VERSIONS = [
  "eh150.v0",
  CURRENT_VALIDATOR_VERSION,
] as const;
export const CURRENT_REPORT_SCHEMA_VERSION = "eh148.v1" as const;
export const RECOGNIZED_REPORT_SCHEMA_VERSIONS = [
  CURRENT_REPORT_SCHEMA_VERSION,
] as const;

export const REPORT_SECTION_IDS = [
  "document_summary",
  "latest_measurements",
  "changes",
  "clinician_questions",
  "limitations",
  "source_ledger",
] as const;

export const REPORT_SOURCE_KINDS = [
  "observation",
  "finding",
  "clinical_note",
  "prescription",
  "referral",
  "document_summary",
] as const;

export const REPORT_VALIDATION_ISSUE_CODES = [
  "SCHEMA_INVALID",
  "SOURCE_NOT_FOUND",
  "PROFILE_MISMATCH",
  "DOCUMENT_OUT_OF_SCOPE",
  "SOURCE_KIND_NOT_ALLOWED",
  "CLAIM_UNCITED",
  "SOURCE_UNAVAILABLE",
  "UNSAFE_CONTENT",
] as const;

export const REPORT_CITATION_ISSUE_CODES = REPORT_VALIDATION_ISSUE_CODES;
export const REPORT_VALIDATION_STATUSES = [
  "valid",
  "limited",
  "invalid",
] as const;
export const REPORT_PUBLISHABLE_STATUSES = ["valid", "limited"] as const;

export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number];
export type ReportSourceKind = (typeof REPORT_SOURCE_KINDS)[number];
export type ReportValidationIssueCode =
  (typeof REPORT_VALIDATION_ISSUE_CODES)[number];
export type ReportCitationIssueCode = ReportValidationIssueCode;
export type ReportValidationStatus =
  (typeof REPORT_VALIDATION_STATUSES)[number];
export type ReportPublishableStatus =
  (typeof REPORT_PUBLISHABLE_STATUSES)[number];
export type ReportClaimKind =
  | "source_fact"
  | "numeric_observation"
  | "clinician_question";
export type ReportClaimOrigin = "generated" | "user_selected";
export type ReportClaimStatus = "supported" | "limited" | "removed";
export type ReportEmptyState =
  | "no_data"
  | "not_applicable"
  | "insufficient_evidence";
export type ReportTemplateId =
  | "source_fact_snapshot"
  | "numeric_observation_snapshot";
export type ReportLimitationCode =
  | "NO_DATA"
  | "INSUFFICIENT_EVIDENCE"
  | "CLAIM_UNCITED"
  | "SOURCE_UNAVAILABLE"
  | "UNSAFE_CONTENT";
export type ReportSourceAvailability = "available" | "archived" | "removed";
export type ReportDocumentState = "active" | "deleting" | "tombstoned";

export type ReportCitation = {
  source_id: string;
  document_id: string;
};

export type ReportSource = {
  source_id: string;
  kind: ReportSourceKind;
  document_id: string;
  observed_at?: string | null;
  recorded_at?: string | null;
  snapshot?: unknown;
};

export type AuthorizedReportSource = ReportSource & {
  source_row_id: string;
  profile_id: string;
  availability: ReportSourceAvailability;
  document_state: ReportDocumentState;
};

export type ReportClaim = {
  id: string;
  section: ReportSectionId;
  kind: ReportClaimKind;
  origin: ReportClaimOrigin;
  citations: readonly ReportCitation[];
  factual: boolean;
  status: ReportClaimStatus;
  template_id?: ReportTemplateId;
  template_params?: Readonly<Record<string, unknown>>;
  question_text?: string;
};

export type ReportSectionReference =
  | { type: "claim_ref"; claim_id: string }
  | { type: "limitation_ref"; limitation_id: string }
  | { type: "source_ref"; source_id: string };

export type ReportSection = {
  id: ReportSectionId;
  items: readonly ReportSectionReference[];
  empty_state?: ReportEmptyState;
};

export type ReportLimitation = {
  id: string;
  code: ReportLimitationCode;
  message: string;
};

export type ReportValidationEnvelope = {
  status: ReportPublishableStatus;
  version: string;
  issue_codes: readonly ReportValidationIssueCode[];
};

export type ReportContent = {
  schema_version: string;
  report_kind: string;
  generated_at: string;
  detail_level: string;
  source_document_ids: readonly string[];
  overview: string;
  sections: readonly ReportSection[];
  claims: readonly ReportClaim[];
  sources: readonly ReportSource[];
  limitations: readonly ReportLimitation[];
  disclaimer: string;
  extensions?: unknown;
  validation?: ReportValidationEnvelope;
};
export type ReportOverviewInput = Pick<
  ReportContent,
  "report_kind" | "sections" | "claims" | "limitations"
>;

export type ReportOverviewRenderer = (
  input: ReportOverviewInput,
) => string | Promise<string>;

export type ReportValidationIssue = {
  code: ReportValidationIssueCode;
  message: string;
};

export type ReportValidationResult = {
  status: ReportValidationStatus;
  content: ReportContent | null;
  version: typeof CURRENT_VALIDATOR_VERSION;
  issue_codes: readonly ReportValidationIssueCode[];
  issues: readonly ReportValidationIssue[];
  safe_summary: string;
};

export type ReportSourceResolverResult =
  | readonly AuthorizedReportSource[]
  | ReadonlyMap<string, AuthorizedReportSource>
  | Record<string, AuthorizedReportSource>;

export type ReportSourceResolver = (
  sourceIds: readonly string[],
) => ReportSourceResolverResult | Promise<ReportSourceResolverResult>;

export type ReportCitationValidationContext = {
  profileId?: string;
  reportProfileId?: string;
  documentScope?: readonly string[];
  scopeDocumentIds?: readonly string[];
  resolveSources?: ReportSourceResolver;
  sourceResolver?: ReportSourceResolver | { resolve: ReportSourceResolver };
  renderOverview?: ReportOverviewRenderer;
};

export type CreateValidatedReportRpcInput = {
  profile_id: string;
  requested_scope_kind: "explicit" | "all_eligible";
  requested_document_ids: readonly string[];
  document_ids: readonly string[];
  content: ReportContent;
  validation_status: ReportPublishableStatus;
  validation_version: string;
  validation_issue_codes: readonly ReportValidationIssueCode[];
  source_mappings: readonly {
    source_id: string;
    source_kind: ReportSourceKind;
    source_row_id: string;
    document_id: string;
  }[];
};

export type PersistedValidationEnvelopeResult =
  | {
      ok: true;
      envelope: ReportValidationEnvelope;
    }
  | {
      ok: false;
      issue_codes: readonly ["SCHEMA_INVALID"];
      safe_summary: string;
    };

const ISSUE_MESSAGES: Record<ReportValidationIssueCode, string> = {
  SCHEMA_INVALID: "The report structure is not supported.",
  SOURCE_NOT_FOUND: "A cited source could not be verified.",
  PROFILE_MISMATCH: "A cited source could not be verified.",
  DOCUMENT_OUT_OF_SCOPE: "A cited source is outside the report scope.",
  SOURCE_KIND_NOT_ALLOWED: "A cited source kind is not supported.",
  CLAIM_UNCITED:
    "A factual claim was omitted because it had no valid citation.",
  SOURCE_UNAVAILABLE:
    "A cited source is unavailable, so the affected claim is limited.",
  UNSAFE_CONTENT:
    "Some generated content was omitted because it did not meet the safety policy.",
};

const LIMITATION_MESSAGES: Record<ReportLimitationCode, string> = {
  NO_DATA: "No source records were available for this report.",
  INSUFFICIENT_EVIDENCE:
    "There is not enough supported evidence for this section.",
  CLAIM_UNCITED:
    "A factual claim was omitted because it had no valid citation.",
  SOURCE_UNAVAILABLE:
    "A cited source is unavailable, so the affected claim is limited.",
  UNSAFE_CONTENT:
    "Some generated content was omitted because it did not meet the safety policy.",
};

const FATAL_ISSUE_CODES: Record<ReportValidationIssueCode, boolean> = {
  SCHEMA_INVALID: true,
  SOURCE_NOT_FOUND: true,
  PROFILE_MISMATCH: true,
  DOCUMENT_OUT_OF_SCOPE: true,
  SOURCE_KIND_NOT_ALLOWED: true,
  CLAIM_UNCITED: false,
  SOURCE_UNAVAILABLE: false,
  UNSAFE_CONTENT: false,
};

const CLAIM_ALLOWED_KEYS: Record<string, true> = {
  id: true,
  section: true,
  kind: true,
  origin: true,
  citations: true,
  factual: true,
  status: true,
  template_id: true,
  template_params: true,
  question_text: true,
  text: true,
  diagnosis: true,
  diagnoses: true,
  treatment: true,
  treatments: true,
  urgency: true,
  imperative: true,
  instruction: true,
  instructions: true,
  recommendation: true,
  recommendations: true,
  action: true,
  actions: true,
  prescription: true,
  prescriptions: true,
};

const CANDIDATE_ALLOWED_KEYS: Record<string, true> = {
  schema_version: true,
  report_kind: true,
  generated_at: true,
  detail_level: true,
  source_document_ids: true,
  sections: true,
  claims: true,
  sources: true,
  limitations: true,
  disclaimer: true,
};

const UNSAFE_CLAIM_KEYS: Record<string, true> = {
  text: true,
  diagnosis: true,
  diagnoses: true,
  treatment: true,
  treatments: true,
  urgency: true,
  imperative: true,
  instruction: true,
  instructions: true,
  recommendation: true,
  recommendations: true,
  action: true,
  actions: true,
  prescription: true,
  prescriptions: true,
};
const CITATION_KEYS: Record<string, true> = {
  source_id: true,
  document_id: true,
};
const SOURCE_KEYS: Record<string, true> = {
  source_id: true,
  kind: true,
  document_id: true,
  observed_at: true,
  recorded_at: true,
  snapshot: true,
};
const LIMITATION_KEYS: Record<string, true> = {
  id: true,
  code: true,
  message: true,
};
const CLAIM_REF_KEYS: Record<string, true> = {
  type: true,
  claim_id: true,
};
const LIMITATION_REF_KEYS: Record<string, true> = {
  type: true,
  limitation_id: true,
};
const SOURCE_REF_KEYS: Record<string, true> = {
  type: true,
  source_id: true,
};
const SECTION_KEYS: Record<string, true> = {
  id: true,
  items: true,
  empty_state: true,
};

const EMPTY_STATES_BY_SECTION: Record<
  ReportSectionId,
  readonly ReportEmptyState[]
> = {
  document_summary: ["no_data", "not_applicable", "insufficient_evidence"],
  latest_measurements: ["no_data", "not_applicable", "insufficient_evidence"],
  changes: ["no_data", "not_applicable", "insufficient_evidence"],
  clinician_questions: ["no_data", "not_applicable", "insufficient_evidence"],
  limitations: ["no_data"],
  source_ledger: ["no_data"],
};

const ISSUE_CODE_ORDER: Record<ReportValidationIssueCode, number> = {
  SCHEMA_INVALID: 0,
  SOURCE_NOT_FOUND: 1,
  PROFILE_MISMATCH: 2,
  DOCUMENT_OUT_OF_SCOPE: 3,
  SOURCE_KIND_NOT_ALLOWED: 4,
  CLAIM_UNCITED: 5,
  SOURCE_UNAVAILABLE: 6,
  UNSAFE_CONTENT: 7,
};

const jsonRecordSchema = z.record(z.unknown());
type JsonRecord = z.infer<typeof jsonRecordSchema>;
type WorkingSection = {
  id: ReportSectionId;
  items: ReportSectionReference[];
  empty_state?: ReportEmptyState;
};
type ParsedClaim = ReportClaim & { unsafe_fields: boolean };
type ParsedCandidate = {
  schema_version: string;
  report_kind: string;
  generated_at: string;
  detail_level: string;
  source_document_ids: string[];
  sections: WorkingSection[];
  claims: ParsedClaim[];
  sources: ReportSource[];
  limitations: ReportLimitation[];
  disclaimer: string;
};
type ResolvedSourceState = {
  source: AuthorizedReportSource;
  unavailable: boolean;
};

function parseRecord(value: unknown): JsonRecord | null {
  const parsed = jsonRecordSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAllowedValue<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function hasOnlyKeys(
  value: JsonRecord,
  allowed: Readonly<Record<string, true>>,
): boolean {
  return Object.keys(value).every((key) => allowed[key] === true);
}

function uniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function stringsFromArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => isNonEmptyString(item)))
    return null;
  const strings = value.map((item) => item as string);
  return uniqueStrings(strings) ? strings : null;
}

function issueCodesInStableOrder(
  codes: Iterable<ReportValidationIssueCode>,
): ReportValidationIssueCode[] {
  return [...new Set(codes)].sort(
    (left, right) => ISSUE_CODE_ORDER[left] - ISSUE_CODE_ORDER[right],
  );
}

function buildIssues(
  codes: readonly ReportValidationIssueCode[],
): ReportValidationIssue[] {
  return codes.map((code) => ({ code, message: ISSUE_MESSAGES[code] }));
}

function invalidResult(
  codes: Iterable<ReportValidationIssueCode>,
): ReportValidationResult {
  const issue_codes = issueCodesInStableOrder(codes);
  return {
    status: "invalid",
    content: null,
    version: CURRENT_VALIDATOR_VERSION,
    issue_codes,
    issues: buildIssues(issue_codes),
    safe_summary: "The report could not be validated.",
  };
}

function validResult(
  status: "valid" | "limited",
  content: ReportContent,
  codes: Iterable<ReportValidationIssueCode>,
): ReportValidationResult {
  const issue_codes = issueCodesInStableOrder(codes);
  return {
    status,
    content,
    version: CURRENT_VALIDATOR_VERSION,
    issue_codes,
    issues: buildIssues(issue_codes),
    safe_summary:
      status === "valid"
        ? "The report content was validated."
        : "The report content was validated with visible limitations.",
  };
}

function parseCitation(value: unknown): ReportCitation | null {
  const record = parseRecord(value);
  if (!record || !hasOnlyKeys(record, CITATION_KEYS)) {
    return null;
  }
  if (
    !isNonEmptyString(record.source_id) ||
    !isNonEmptyString(record.document_id)
  )
    return null;
  return { source_id: record.source_id, document_id: record.document_id };
}
function parseSource(value: unknown): ReportSource | null {
  const record = parseRecord(value);
  if (!record) return null;
  if (!hasOnlyKeys(record, SOURCE_KEYS)) return null;
  if (
    !isNonEmptyString(record.source_id) ||
    !isNonEmptyString(record.document_id)
  )
    return null;
  if (!isAllowedValue(record.kind, REPORT_SOURCE_KINDS)) return null;
  if (
    (record.observed_at !== undefined &&
      record.observed_at !== null &&
      typeof record.observed_at !== "string") ||
    (record.recorded_at !== undefined &&
      record.recorded_at !== null &&
      typeof record.recorded_at !== "string")
  ) {
    return null;
  }
  return {
    source_id: record.source_id,
    kind: record.kind,
    document_id: record.document_id,
    ...(record.observed_at !== undefined
      ? { observed_at: record.observed_at as string | null }
      : {}),
    ...(record.recorded_at !== undefined
      ? { recorded_at: record.recorded_at as string | null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(record, "snapshot")
      ? { snapshot: record.snapshot }
      : {}),
  };
}
function parseClaim(value: unknown): ParsedClaim | null {
  const record = parseRecord(value);
  if (!record || !hasOnlyKeys(record, CLAIM_ALLOWED_KEYS)) return null;
  if (
    !isNonEmptyString(record.id) ||
    !isAllowedValue(record.section, REPORT_SECTION_IDS) ||
    !isAllowedValue(record.kind, [
      "source_fact",
      "numeric_observation",
      "clinician_question",
    ] as const) ||
    !isAllowedValue(record.origin, ["generated", "user_selected"] as const) ||
    typeof record.factual !== "boolean" ||
    !isAllowedValue(record.status, ["supported", "limited", "removed"] as const)
  ) {
    return null;
  }
  if (!Array.isArray(record.citations)) return null;
  const citations = record.citations.map(parseCitation);
  if (citations.some((citation) => citation === null)) return null;
  if (
    !uniqueStrings(
      (citations as ReportCitation[]).map((citation) => citation.source_id),
    )
  )
    return null;
  if (
    record.template_id !== undefined &&
    !isAllowedValue(record.template_id, [
      "source_fact_snapshot",
      "numeric_observation_snapshot",
    ] as const)
  ) {
    return null;
  }
  let templateParams: JsonRecord | undefined;
  if (record.template_params !== undefined) {
    templateParams = parseRecord(record.template_params) ?? undefined;
    if (!templateParams) return null;
  }
  let questionText: string | undefined;
  if (record.question_text !== undefined) {
    if (record.kind !== "clinician_question") return null;
    questionText = normalizeQuestionText(record.question_text) ?? undefined;
    if (questionText === undefined) return null;
  }
  return {
    id: record.id,
    section: record.section,
    kind: record.kind,
    origin: record.origin,
    citations: citations as ReportCitation[],
    factual: record.factual,
    status: record.status,
    unsafe_fields: Object.keys(record).some(
      (key) => UNSAFE_CLAIM_KEYS[key] === true,
    ),
    ...(record.template_id !== undefined
      ? { template_id: record.template_id }
      : {}),
    ...(templateParams !== undefined
      ? { template_params: templateParams }
      : {}),
    ...(questionText !== undefined ? { question_text: questionText } : {}),
  };
}

function parseLimitation(value: unknown): ReportLimitation | null {
  const record = parseRecord(value);
  if (!record || !hasOnlyKeys(record, LIMITATION_KEYS)) return null;
  if (
    !isNonEmptyString(record.id) ||
    !isAllowedValue(record.code, [
      "NO_DATA",
      "INSUFFICIENT_EVIDENCE",
      "CLAIM_UNCITED",
      "SOURCE_UNAVAILABLE",
      "UNSAFE_CONTENT",
    ] as const) ||
    typeof record.message !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    code: record.code,
    message: LIMITATION_MESSAGES[record.code],
  };
}
function parseSection(
  value: unknown,
  expectedId: ReportSectionId,
): WorkingSection | null {
  const record = parseRecord(value);
  if (!record) return null;
  if (!hasOnlyKeys(record, SECTION_KEYS)) return null;
  if (
    !isAllowedValue(record.id, REPORT_SECTION_IDS) ||
    record.id !== expectedId
  )
    return null;
  if (!Array.isArray(record.items)) return null;
  const items: ReportSectionReference[] = [];
  for (const item of record.items) {
    const itemRecord = parseRecord(item);
    if (!itemRecord || typeof itemRecord.type !== "string") return null;
    if (itemRecord.type === "claim_ref") {
      if (
        !hasOnlyKeys(itemRecord, CLAIM_REF_KEYS) ||
        !isNonEmptyString(itemRecord.claim_id)
      )
        return null;
      items.push({ type: "claim_ref", claim_id: itemRecord.claim_id });
    } else if (itemRecord.type === "limitation_ref") {
      if (
        !hasOnlyKeys(itemRecord, LIMITATION_REF_KEYS) ||
        !isNonEmptyString(itemRecord.limitation_id)
      )
        return null;
      items.push({
        type: "limitation_ref",
        limitation_id: itemRecord.limitation_id,
      });
    } else if (itemRecord.type === "source_ref") {
      if (
        !hasOnlyKeys(itemRecord, SOURCE_REF_KEYS) ||
        !isNonEmptyString(itemRecord.source_id)
      )
        return null;
      items.push({ type: "source_ref", source_id: itemRecord.source_id });
    } else {
      return null;
    }
  }
  const emptyState = record.empty_state;
  if (
    emptyState !== undefined &&
    !isAllowedValue(emptyState, EMPTY_STATES_BY_SECTION[expectedId])
  ) {
    return null;
  }
  if (items.length === 0 && emptyState === undefined) return null;
  if (items.length > 0 && emptyState !== undefined) return null;
  return {
    id: expectedId,
    items,
    ...(emptyState !== undefined ? { empty_state: emptyState } : {}),
  };
}

function parseCandidate(value: unknown): ParsedCandidate | null {
  const record = parseRecord(value);
  if (!record) return null;
  const sourceDocumentIds = stringsFromArray(record.source_document_ids);
  if (
    !hasOnlyKeys(record, CANDIDATE_ALLOWED_KEYS) ||
    !isAllowedValue(record.schema_version, RECOGNIZED_REPORT_SCHEMA_VERSIONS) ||
    record.report_kind !== "doctor_visit_brief" ||
    !isNonEmptyString(record.generated_at) ||
    !isNonEmptyString(record.detail_level) ||
    sourceDocumentIds === null ||
    record.overview !== undefined ||
    Object.prototype.hasOwnProperty.call(record, "extensions") ||
    record.disclaimer !== MEDICAL_DISCLAIMER ||
    !Array.isArray(record.sections) ||
    record.sections.length !== REPORT_SECTION_IDS.length ||
    !Array.isArray(record.claims) ||
    !Array.isArray(record.sources) ||
    !Array.isArray(record.limitations)
  ) {
    return null;
  }

  const sections = record.sections.map((section, index) =>
    parseSection(section, REPORT_SECTION_IDS[index]),
  );
  if (sections.some((section) => section === null)) return null;
  const claims = record.claims.map(parseClaim);
  const sources = record.sources.map(parseSource);
  const limitations = record.limitations.map(parseLimitation);
  if (
    claims.some((claim) => claim === null) ||
    sources.some((source) => source === null) ||
    limitations.some((limitation) => limitation === null)
  ) {
    return null;
  }

  const parsedClaims = claims as ParsedClaim[];
  const parsedSources = sources as ReportSource[];
  const parsedLimitations = limitations as ReportLimitation[];
  if (
    !uniqueStrings(parsedClaims.map((claim) => claim.id)) ||
    !uniqueStrings(parsedSources.map((source) => source.source_id)) ||
    !uniqueStrings(parsedLimitations.map((limitation) => limitation.id))
  ) {
    return null;
  }

  return {
    schema_version: record.schema_version,
    report_kind: record.report_kind,
    generated_at: record.generated_at,
    detail_level: record.detail_level,
    source_document_ids: sourceDocumentIds,
    sections: sections as WorkingSection[],
    claims: parsedClaims,
    sources: parsedSources,
    limitations: parsedLimitations,
    disclaimer: record.disclaimer,
  };
}

function contextParts(context: ReportCitationValidationContext): {
  profileId: string;
  documentScope: string[];
  resolver: ReportSourceResolver;
  renderOverview: ReportOverviewRenderer;
} | null {
  const profileId = context.profileId ?? context.reportProfileId;
  const documentScope = context.documentScope ?? context.scopeDocumentIds;
  const configuredResolver = context.resolveSources ?? context.sourceResolver;
  const renderOverview = context.renderOverview;
  if (
    !isNonEmptyString(profileId) ||
    !Array.isArray(documentScope) ||
    typeof renderOverview !== "function"
  )
    return null;
  if (
    !documentScope.every((id) => isNonEmptyString(id)) ||
    !uniqueStrings(documentScope)
  )
    return null;
  if (!configuredResolver) return null;
  const resolver: ReportSourceResolver =
    typeof configuredResolver === "function"
      ? configuredResolver
      : configuredResolver.resolve;
  return {
    profileId,
    documentScope: [...documentScope],
    resolver,
    renderOverview,
  };
}

function normalizeResolvedSource(
  value: unknown,
  mapKey?: string,
): AuthorizedReportSource | null {
  const record = parseRecord(value);
  if (!record) return null;
  const sourceId =
    (isNonEmptyString(record.source_id) && record.source_id) ||
    (isNonEmptyString(record.id) && record.id) ||
    mapKey;
  const kind = record.kind ?? record.source_kind;
  const documentId = record.document_id ?? record.documentId;
  const profileId = record.profile_id ?? record.profileId;
  const availability = record.availability ?? record.source_availability;
  const documentState =
    record.document_state ?? record.documentState ?? record.lifecycle;
  const normalizedDocumentState = isAllowedValue(documentState, [
    "active",
    "deleting",
    "tombstoned",
  ] as const)
    ? documentState
    : null;
  const normalizedAvailability = isAllowedValue(availability, [
    "available",
    "archived",
    "removed",
  ] as const)
    ? availability
    : null;
  if (
    !isNonEmptyString(sourceId) ||
    !isAllowedValue(kind, REPORT_SOURCE_KINDS) ||
    !isNonEmptyString(documentId) ||
    !isNonEmptyString(profileId) ||
    !isNonEmptyString(record.source_row_id) ||
    normalizedDocumentState === null ||
    normalizedAvailability === null ||
    (record.observed_at !== undefined &&
      record.observed_at !== null &&
      typeof record.observed_at !== "string") ||
    (record.recorded_at !== undefined &&
      record.recorded_at !== null &&
      typeof record.recorded_at !== "string")
  ) {
    return null;
  }
  return {
    source_id: sourceId,
    kind,
    document_id: documentId,
    ...(record.observed_at !== undefined
      ? { observed_at: record.observed_at as string | null }
      : {}),
    ...(record.recorded_at !== undefined
      ? { recorded_at: record.recorded_at as string | null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(record, "snapshot")
      ? { snapshot: record.snapshot }
      : {}),
    profile_id: profileId,
    source_row_id: record.source_row_id as string,
    availability: normalizedAvailability,
    document_state: normalizedDocumentState,
  };
}

function normalizeResolverResult(
  result: ReportSourceResolverResult,
): Map<string, AuthorizedReportSource> {
  const normalized = new Map<string, AuthorizedReportSource>();
  if (result instanceof Map) {
    for (const [key, value] of result.entries()) {
      const source = normalizeResolvedSource(value, key);
      if (source) normalized.set(source.source_id, source);
    }
    return normalized;
  }
  if (Array.isArray(result)) {
    for (const value of result) {
      const source = normalizeResolvedSource(value);
      if (source) normalized.set(source.source_id, source);
    }
    return normalized;
  }
  for (const [key, value] of Object.entries(result)) {
    const source = normalizeResolvedSource(value, key);
    if (source) normalized.set(source.source_id, source);
  }
  return normalized;
}

function sourceIsUnavailable(source: AuthorizedReportSource): boolean {
  return (
    source.availability === "archived" || source.availability === "removed"
  );
}

function sourceDocumentIsTombstoned(source: AuthorizedReportSource): boolean {
  return (
    source.document_state === "deleting" ||
    source.document_state === "tombstoned"
  );
}

function claimTemplateIsValid(claim: ReportClaim): boolean {
  if (!claim.template_id || !claim.template_params) return false;
  const params = claim.template_params;
  if (
    claim.kind === "source_fact" &&
    claim.template_id === "source_fact_snapshot"
  ) {
    return (
      Object.keys(params).length === 2 &&
      isNonEmptyString(params.source_id) &&
      typeof params.include_date === "boolean"
    );
  }
  if (
    claim.kind === "numeric_observation" &&
    claim.template_id === "numeric_observation_snapshot"
  ) {
    return (
      Object.keys(params).length === 2 &&
      isNonEmptyString(params.source_id) &&
      typeof params.include_range === "boolean"
    );
  }
  return false;
}

function claimSectionIsCompatible(claim: ReportClaim): boolean {
  if (claim.kind === "clinician_question")
    return claim.section === "clinician_questions";
  if (claim.kind === "source_fact") {
    return (
      claim.section === "document_summary" ||
      claim.section === "latest_measurements" ||
      claim.section === "changes"
    );
  }
  return (
    claim.kind === "numeric_observation" &&
    (claim.section === "latest_measurements" || claim.section === "changes")
  );
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function hasUnsafeText(value: string): boolean {
  return (
    hasUnpairedSurrogate(value) || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)
  );
}

function normalizeQuestionText(value: unknown): string | null {
  if (typeof value !== "string" || hasUnsafeText(value)) return null;
  const normalized = value.trim().normalize("NFC");
  if (
    normalized.length === 0 ||
    [...normalized].length > 240 ||
    hasUnsafeText(normalized)
  ) {
    return null;
  }
  return normalized;
}

function claimHasValidQuestionText(claim: ReportClaim): boolean {
  return (
    claim.kind === "clinician_question" &&
    typeof claim.question_text === "string" &&
    normalizeQuestionText(claim.question_text) === claim.question_text
  );
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

function addLimitation(
  limitations: ReportLimitation[],
  code: ReportLimitationCode,
  suffix: string,
): string {
  const existing = limitations.find(
    (limitation) =>
      limitation.code === code &&
      limitation.id.startsWith(`eh150-${code.toLowerCase()}`),
  );
  if (existing) return existing.id;
  const baseId = `eh150-${code.toLowerCase()}${suffix ? `-${suffix}` : ""}`;
  let id = baseId;
  let counter = 2;
  while (limitations.some((limitation) => limitation.id === id)) {
    id = `${baseId}-${counter}`;
    counter += 1;
  }
  limitations.push({ id, code, message: LIMITATION_MESSAGES[code] });
  return id;
}

function projectClaim(claim: ReportClaim, unavailable: boolean): ReportClaim {
  const status: ReportClaimStatus = unavailable ? "limited" : "supported";
  if (claim.kind === "clinician_question") {
    return {
      id: claim.id,
      section: claim.section,
      kind: claim.kind,
      origin: claim.origin,
      citations: [],
      factual: false,
      status,
      question_text: claim.question_text?.trim(),
    };
  }
  return {
    id: claim.id,
    section: claim.section,
    kind: claim.kind,
    origin: claim.origin,
    citations: claim.citations.map((citation) => ({ ...citation })),
    factual: true,
    status,
    template_id: claim.template_id,
    template_params: claim.template_params
      ? { ...claim.template_params }
      : undefined,
  };
}

function rebuildClaimSection(
  section: WorkingSection,
  claimsById: ReadonlyMap<string, ReportClaim>,
  removedClaimIds: ReadonlySet<string>,
  issueCodes: Set<ReportValidationIssueCode>,
): void {
  const nextItems: ReportSectionReference[] = [];
  const seen = new Set<string>();
  for (const item of section.items) {
    if (item.type !== "claim_ref") {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    if (removedClaimIds.has(item.claim_id)) continue;
    const claim = claimsById.get(item.claim_id);
    if (
      !claim ||
      seen.has(item.claim_id) ||
      claim.section !== section.id ||
      !claimSectionIsCompatible(claim)
    ) {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    seen.add(item.claim_id);
    nextItems.push(item);
  }
  section.items = nextItems;
  if (section.items.length === 0) {
    section.empty_state = section.empty_state ?? "insufficient_evidence";
  } else {
    delete section.empty_state;
  }
}

function validateReferences(
  candidate: ParsedCandidate,
  claimsById: ReadonlyMap<string, ReportClaim>,
  keptClaimIds: ReadonlySet<string>,
  issueCodes: Set<ReportValidationIssueCode>,
): { removedClaimIds: Set<string>; sourceIds: Set<string> } {
  const removedClaimIds = new Set(
    candidate.claims
      .filter(
        (claim) => claim.status === "removed" || !keptClaimIds.has(claim.id),
      )
      .map((claim) => claim.id),
  );
  const limitationIds = new Set(
    candidate.limitations.map((limitation) => limitation.id),
  );
  const sourceIds = new Set(
    candidate.sources.map((source) => source.source_id),
  );
  const seenClaims = new Set<string>();
  const seenLimitations = new Set<string>();
  const seenSources = new Set<string>();

  for (const section of candidate.sections) {
    if (section.id === "limitations") {
      for (const item of section.items) {
        if (
          item.type !== "limitation_ref" ||
          !limitationIds.has(item.limitation_id) ||
          seenLimitations.has(item.limitation_id)
        ) {
          issueCodes.add("SCHEMA_INVALID");
          continue;
        }
        seenLimitations.add(item.limitation_id);
      }
      continue;
    }
    if (section.id === "source_ledger") {
      for (const item of section.items) {
        if (
          item.type !== "source_ref" ||
          !sourceIds.has(item.source_id) ||
          seenSources.has(item.source_id)
        ) {
          issueCodes.add("SCHEMA_INVALID");
          continue;
        }
        seenSources.add(item.source_id);
      }
      continue;
    }
    for (const item of section.items) {
      if (item.type !== "claim_ref") {
        issueCodes.add("SCHEMA_INVALID");
        continue;
      }
      if (removedClaimIds.has(item.claim_id)) continue;
      if (!claimsById.has(item.claim_id) || seenClaims.has(item.claim_id)) {
        issueCodes.add("SCHEMA_INVALID");
        continue;
      }
      seenClaims.add(item.claim_id);
    }
  }

  for (const claim of candidate.claims) {
    if (
      claim.status !== "removed" &&
      keptClaimIds.has(claim.id) &&
      !seenClaims.has(claim.id)
    ) {
      issueCodes.add("SCHEMA_INVALID");
    }
  }
  for (const limitation of candidate.limitations) {
    if (!seenLimitations.has(limitation.id)) issueCodes.add("SCHEMA_INVALID");
  }
  for (const source of candidate.sources) {
    if (!seenSources.has(source.source_id)) issueCodes.add("SCHEMA_INVALID");
  }

  return { removedClaimIds, sourceIds };
}

type ClaimProjection = {
  keptClaims: ReportClaim[];
  removedClaimIds: Set<string>;
  unavailableClaimIds: Set<string>;
};

function validateUserSelectedQuestionSet(
  candidate: ParsedCandidate,
  issueCodes: Set<ReportValidationIssueCode>,
): void {
  const questions = new Set<string>();
  for (const claim of candidate.claims) {
    if (
      claim.kind !== "clinician_question" ||
      claim.origin !== "user_selected"
    ) {
      continue;
    }
    const questionText = claim.question_text;
    if (
      typeof questionText !== "string" ||
      questions.size >= 5 ||
      questions.has(questionText)
    ) {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    questions.add(questionText);
  }
}

function projectCandidateClaims(
  candidate: ParsedCandidate,
  sourceStates: ReadonlyMap<string, ResolvedSourceState>,
  issueCodes: Set<ReportValidationIssueCode>,
): ClaimProjection {
  const keptClaims: ReportClaim[] = [];
  const removedClaimIds = new Set<string>(
    candidate.claims
      .filter((claim) => claim.status === "removed")
      .map((claim) => claim.id),
  );
  const unavailableClaimIds = new Set<string>();

  for (const claim of candidate.claims) {
    if (claim.status === "removed") continue;
    if (claim.status === "limited") {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    if (!claimSectionIsCompatible(claim)) {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    if (claim.unsafe_fields) {
      issueCodes.add("UNSAFE_CONTENT");
      removedClaimIds.add(claim.id);
      continue;
    }
    if (claim.kind === "clinician_question") {
      if (
        claim.factual ||
        (claim.origin === "user_selected" &&
          claim.section !== "clinician_questions") ||
        claim.citations.length > 0 ||
        claim.template_id !== undefined ||
        claim.template_params !== undefined ||
        !claimHasValidQuestionText(claim)
      ) {
        issueCodes.add("SCHEMA_INVALID");
        continue;
      }
      keptClaims.push(projectClaim(claim, false));
      continue;
    }
    if (claim.factual !== true || claim.origin !== "generated") {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    if (claim.citations.length === 0) {
      issueCodes.add("CLAIM_UNCITED");
      removedClaimIds.add(claim.id);
      continue;
    }
    if (!claimTemplateIsValid(claim)) {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    const templateSourceId = claim.template_params?.source_id;
    if (
      !isNonEmptyString(templateSourceId) ||
      !claim.citations.some(
        (citation) => citation.source_id === templateSourceId,
      )
    ) {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    const unavailable = claim.citations.some(
      (citation) => sourceStates.get(citation.source_id)?.unavailable === true,
    );
    if (unavailable) {
      issueCodes.add("SOURCE_UNAVAILABLE");
      unavailableClaimIds.add(claim.id);
    }
    keptClaims.push(projectClaim(claim, unavailable));
  }

  return { keptClaims, removedClaimIds, unavailableClaimIds };
}

function buildValidatedLimitations(
  candidate: ParsedCandidate,
  claimsByKeptId: ReadonlyMap<string, ReportClaim>,
  removedClaimIds: ReadonlySet<string>,
  keptClaims: readonly ReportClaim[],
  issueCodes: Set<ReportValidationIssueCode>,
): ReportLimitation[] | null {
  const limitations = [...candidate.limitations];
  const limitationSection = candidate.sections.find(
    (section) => section.id === "limitations",
  );
  if (!limitationSection) return null;

  if (issueCodes.has("CLAIM_UNCITED")) {
    addLimitation(limitations, "CLAIM_UNCITED", "");
  }
  if (issueCodes.has("UNSAFE_CONTENT")) {
    addLimitation(limitations, "UNSAFE_CONTENT", "");
  }
  if (issueCodes.has("SOURCE_UNAVAILABLE")) {
    addLimitation(limitations, "SOURCE_UNAVAILABLE", "");
  }

  for (const section of candidate.sections) {
    if (section.id === "limitations" || section.id === "source_ledger")
      continue;
    const hadRemovedClaim =
      section.items.some(
        (item) =>
          item.type === "claim_ref" && removedClaimIds.has(item.claim_id),
      ) ||
      candidate.claims.some(
        (claim) =>
          claim.section === section.id && removedClaimIds.has(claim.id),
      );
    rebuildClaimSection(section, claimsByKeptId, removedClaimIds, issueCodes);
    if (hadRemovedClaim && section.items.length === 0) {
      issueCodes.add("SCHEMA_INVALID");
      continue;
    }
    if (section.items.length === 0) {
      addLimitation(limitations, "INSUFFICIENT_EVIDENCE", section.id);
    }
  }
  if (
    candidate.sections.find((section) => section.id === "source_ledger")?.items
      .length === 0
  ) {
    addLimitation(limitations, "NO_DATA", "source-ledger");
  }
  if (issueCodes.has("SCHEMA_INVALID")) return null;

  const existingLimitationIds = new Set(
    limitationSection.items.map((item) =>
      item.type === "limitation_ref" ? item.limitation_id : "",
    ),
  );
  for (const limitation of limitations) {
    if (!existingLimitationIds.has(limitation.id)) {
      limitationSection.items.push({
        type: "limitation_ref",
        limitation_id: limitation.id,
      });
    }
  }
  if (limitationSection.items.length > 0) delete limitationSection.empty_state;
  else limitationSection.empty_state = "no_data";

  if (
    keptClaims.some((claim) => claim.status === "limited") &&
    limitationSection.items.length === 0
  ) {
    issueCodes.add("SCHEMA_INVALID");
    return null;
  }
  return limitations;
}

function projectAuthorizedSource(source: AuthorizedReportSource): ReportSource {
  return {
    source_id: source.source_id,
    kind: source.kind,
    document_id: source.document_id,
    ...(source.observed_at !== undefined
      ? { observed_at: source.observed_at }
      : {}),
    ...(source.recorded_at !== undefined
      ? { recorded_at: source.recorded_at }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(
      source as unknown as JsonRecord,
      "snapshot",
    )
      ? { snapshot: source.snapshot }
      : {}),
  };
}

function buildOutputContent(
  candidate: ParsedCandidate,
  sourceStates: ReadonlyMap<string, ResolvedSourceState>,
  sections: readonly WorkingSection[],
  claims: readonly ReportClaim[],
  limitations: readonly ReportLimitation[],
  overview: string,
  status: ReportPublishableStatus,
  issueCodes: readonly ReportValidationIssueCode[],
): ReportContent {
  const content: ReportContent = {
    schema_version: candidate.schema_version,
    report_kind: candidate.report_kind,
    generated_at: candidate.generated_at,
    detail_level: candidate.detail_level,
    source_document_ids: [...candidate.source_document_ids],
    overview,
    sections: sections.map((section) => ({
      id: section.id,
      items: section.items.map((item) => ({ ...item })),
      ...(section.empty_state !== undefined
        ? { empty_state: section.empty_state }
        : {}),
    })),
    claims: claims.map((claim) => ({
      ...claim,
      citations: claim.citations.map((citation) => ({ ...citation })),
      ...(claim.template_params
        ? { template_params: { ...claim.template_params } }
        : {}),
    })),
    sources: candidate.sources.map((source) => {
      const authorized = sourceStates.get(source.source_id)?.source;
      if (!authorized) throw new Error("Authorized source projection missing");
      return projectAuthorizedSource(authorized);
    }),
    limitations: limitations.map((limitation) => ({ ...limitation })),
    disclaimer: MEDICAL_DISCLAIMER,
    validation: {
      status,
      version: CURRENT_VALIDATOR_VERSION,
      issue_codes: [...issueCodes],
    },
  };
  return content;
}

async function resolveSources(
  resolver: ReportSourceResolver,
  sourceIds: readonly string[],
): Promise<Map<string, AuthorizedReportSource>> {
  const resolved = await resolver(sourceIds);
  return normalizeResolverResult(resolved);
}

export async function validateReportContent(
  content: unknown,
  context: ReportCitationValidationContext,
): Promise<ReportValidationResult> {
  try {
    const parts = contextParts(context);
    const candidate = parseCandidate(content);
    if (!parts || !candidate) return invalidResult(["SCHEMA_INVALID"]);
    if (!sameIdSet(candidate.source_document_ids, parts.documentScope)) {
      return invalidResult(["DOCUMENT_OUT_OF_SCOPE"]);
    }

    const sourceIds = candidate.sources.map((source) => source.source_id);
    let resolvedSources: Map<string, AuthorizedReportSource>;
    try {
      resolvedSources = await resolveSources(parts.resolver, sourceIds);
    } catch {
      return invalidResult(["SOURCE_NOT_FOUND"]);
    }

    const issueCodes = new Set<ReportValidationIssueCode>();
    const sourceStates = new Map<string, ResolvedSourceState>();
    for (const source of candidate.sources) {
      const resolved = resolvedSources.get(source.source_id);
      if (!resolved) {
        issueCodes.add("SOURCE_NOT_FOUND");
        continue;
      }
      if (resolved.profile_id !== parts.profileId) {
        issueCodes.add("PROFILE_MISMATCH");
      }
      if (resolved.document_id !== source.document_id) {
        issueCodes.add("SOURCE_NOT_FOUND");
      }
      if (resolved.kind !== source.kind) {
        issueCodes.add("SOURCE_KIND_NOT_ALLOWED");
      }
      if (!parts.documentScope.includes(source.document_id)) {
        issueCodes.add("DOCUMENT_OUT_OF_SCOPE");
      }
      if (sourceDocumentIsTombstoned(resolved)) {
        issueCodes.add("SOURCE_UNAVAILABLE");
      }
      sourceStates.set(source.source_id, {
        source: resolved,
        unavailable: sourceIsUnavailable(resolved),
      });
    }

    for (const claim of candidate.claims) {
      if (claim.status === "removed") continue;
      for (const citation of claim.citations) {
        const state = sourceStates.get(citation.source_id);
        if (!state || citation.document_id !== state.source.document_id) {
          issueCodes.add("SOURCE_NOT_FOUND");
        }
        if (
          claim.kind === "numeric_observation" &&
          state &&
          state.source.kind !== "observation"
        ) {
          issueCodes.add("SOURCE_KIND_NOT_ALLOWED");
        }
      }
    }
    if (
      [...issueCodes].some(
        (code) =>
          FATAL_ISSUE_CODES[code] === true || code === "SOURCE_UNAVAILABLE",
      )
    ) {
      return invalidResult(issueCodes);
    }
    validateUserSelectedQuestionSet(candidate, issueCodes);

    const { keptClaims, removedClaimIds, unavailableClaimIds } =
      projectCandidateClaims(candidate, sourceStates, issueCodes);

    if (issueCodes.has("SCHEMA_INVALID")) return invalidResult(issueCodes);

    const keptClaimIds = new Set(keptClaims.map((claim) => claim.id));
    const claimsByKeptId = new Map(
      keptClaims.map((claim) => [claim.id, claim]),
    );
    const referenceValidation = validateReferences(
      candidate,
      claimsByKeptId,
      keptClaimIds,
      issueCodes,
    );
    for (const claimId of unavailableClaimIds) {
      if (!keptClaimIds.has(claimId)) issueCodes.add("SCHEMA_INVALID");
    }
    if (issueCodes.has("SCHEMA_INVALID")) return invalidResult(issueCodes);

    const limitations = buildValidatedLimitations(
      candidate,
      claimsByKeptId,
      referenceValidation.removedClaimIds,
      keptClaims,
      issueCodes,
    );
    if (!limitations || issueCodes.has("SCHEMA_INVALID")) {
      return invalidResult(issueCodes);
    }

    const finalStatus: ReportPublishableStatus =
      issueCodes.size > 0 ||
      keptClaims.some((claim) => claim.status === "limited") ||
      limitations.length > 0
        ? "limited"
        : "valid";
    const finalIssueCodes = issueCodesInStableOrder(issueCodes);
    let overview: string;
    try {
      const renderedOverview = await parts.renderOverview({
        report_kind: candidate.report_kind,
        sections: candidate.sections,
        claims: keptClaims,
        limitations,
      });
      if (
        typeof renderedOverview !== "string" ||
        hasUnsafeText(renderedOverview)
      ) {
        return invalidResult(["SCHEMA_INVALID"]);
      }
      overview = renderedOverview.trim();
    } catch {
      return invalidResult(["SCHEMA_INVALID"]);
    }
    if (!isNonEmptyString(overview) || hasUnsafeText(overview)) {
      return invalidResult(["SCHEMA_INVALID"]);
    }
    const output = buildOutputContent(
      candidate,
      sourceStates,
      candidate.sections,
      keptClaims,
      limitations,
      overview,
      finalStatus,
      finalIssueCodes,
    );
    return validResult(finalStatus, output, finalIssueCodes);
  } catch {
    return invalidResult(["SCHEMA_INVALID"]);
  }
}

export function isRecognizedValidatorVersion(
  version: unknown,
): version is (typeof RECOGNIZED_VALIDATOR_VERSIONS)[number] {
  return (
    typeof version === "string" &&
    RECOGNIZED_VALIDATOR_VERSIONS.includes(
      version as (typeof RECOGNIZED_VALIDATOR_VERSIONS)[number],
    )
  );
}

export function validatePersistedValidationEnvelope(
  value: unknown,
): PersistedValidationEnvelopeResult {
  const record = parseRecord(value);
  if (!record) {
    return {
      ok: false,
      issue_codes: ["SCHEMA_INVALID"],
      safe_summary: "The validation envelope is unavailable.",
    };
  }
  if (
    !isAllowedValue(record.status, REPORT_PUBLISHABLE_STATUSES) ||
    !isRecognizedValidatorVersion(record.version)
  ) {
    return {
      ok: false,
      issue_codes: ["SCHEMA_INVALID"],
      safe_summary: "The validation envelope is unavailable.",
    };
  }
  if (!Array.isArray(record.issue_codes)) {
    return {
      ok: false,
      issue_codes: ["SCHEMA_INVALID"],
      safe_summary: "The validation envelope is unavailable.",
    };
  }
  const issueCodes = record.issue_codes;
  if (
    !issueCodes.every((code) =>
      isAllowedValue(code, REPORT_VALIDATION_ISSUE_CODES),
    ) ||
    issueCodes.some((code) => FATAL_ISSUE_CODES[code] === true) ||
    (record.status === "valid" && issueCodes.length > 0)
  ) {
    return {
      ok: false,
      issue_codes: ["SCHEMA_INVALID"],
      safe_summary: "The validation envelope is unavailable.",
    };
  }
  return {
    ok: true,
    envelope: {
      status: record.status,
      version: record.version,
      issue_codes: issueCodesInStableOrder(issueCodes),
    },
  };
}
export function isPublishableValidationEnvelope(
  value: unknown,
): value is ReportValidationEnvelope {
  return validatePersistedValidationEnvelope(value).ok;
}

export function isPublishableReportValidationResult(
  result: ReportValidationResult,
): result is ReportValidationResult & {
  status: ReportPublishableStatus;
  content: ReportContent;
} {
  return result.status !== "invalid" && result.content !== null;
}
