export const CURRENT_VALIDATOR_VERSION = "eh150.v1" as const;

export const RECOGNIZED_VALIDATOR_VERSIONS = [
  "eh150.v0",
  CURRENT_VALIDATOR_VERSION,
] as const;
export const CURRENT_REPORT_SCHEMA_VERSION = "eh148.v1" as const;
export const RECOGNIZED_REPORT_SCHEMA_VERSIONS = [
  CURRENT_REPORT_SCHEMA_VERSION,
] as const;

/** Retire a readable version only with the EH-154 release decision. */
export const RETIRED_VALIDATOR_VERSIONS = [] as const;

export const VALIDATION_STATUSES = ["valid", "limited", "invalid"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const PUBLISHABLE_VALIDATION_STATUSES = ["valid", "limited"] as const;
export type PublishableValidationStatus =
  (typeof PUBLISHABLE_VALIDATION_STATUSES)[number];

export const REPORT_CITATION_ISSUE_CODES = [
  "SCHEMA_INVALID",
  "SOURCE_NOT_FOUND",
  "PROFILE_MISMATCH",
  "DOCUMENT_OUT_OF_SCOPE",
  "SOURCE_KIND_NOT_ALLOWED",
  "CLAIM_UNCITED",
  "SOURCE_UNAVAILABLE",
  "UNSAFE_CONTENT",
] as const;
export type ReportCitationIssueCode =
  (typeof REPORT_CITATION_ISSUE_CODES)[number];

export const REPORT_SECTION_IDS = [
  "document_summary",
  "latest_measurements",
  "changes",
  "clinician_questions",
  "limitations",
  "source_ledger",
] as const;
export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number];

export const REPORT_SOURCE_KINDS = [
  "observation",
  "finding",
  "clinical_note",
  "prescription",
  "referral",
  "document_summary",
] as const;
export type ReportSourceKind = (typeof REPORT_SOURCE_KINDS)[number];

export const REPORT_EMPTY_STATES = [
  "no_data",
  "not_applicable",
  "insufficient_evidence",
] as const;
export type ReportEmptyState = (typeof REPORT_EMPTY_STATES)[number];

export const REPORT_DETAIL_LEVELS = [
  "compact",
  "standard",
  "detailed",
  "full",
] as const;
export type ReportDetailLevel = (typeof REPORT_DETAIL_LEVELS)[number];

export const REPORT_CLAIM_KINDS = [
  "source_fact",
  "numeric_observation",
  "clinician_question",
] as const;
export type ReportClaimKind = (typeof REPORT_CLAIM_KINDS)[number];

export const REPORT_CLAIM_STATUSES = [
  "supported",
  "limited",
  "removed",
] as const;
export type ReportClaimStatus = (typeof REPORT_CLAIM_STATUSES)[number];

export const REPORT_CLAIM_ORIGINS = ["generated", "user_selected"] as const;
export type ReportClaimOrigin = (typeof REPORT_CLAIM_ORIGINS)[number];

export type ReportCitation = Readonly<{
  source_id: string;
  document_id: string;
}>;

export type ReportSource = Readonly<{
  source_id: string;
  kind: ReportSourceKind;
  document_id: string;
  snapshot: Readonly<Record<string, unknown>>;
  observed_at?: string | null;
  recorded_at?: string | null;
}>;

export type ReportTemplateParams = Readonly<{
  source_id: string;
  include_date?: boolean;
  include_range?: boolean;
}>;

export type ReportClaim = Readonly<{
  id: string;
  section: ReportSectionId;
  kind: ReportClaimKind;
  origin: ReportClaimOrigin;
  citations: readonly ReportCitation[];
  factual: boolean;
  status: ReportClaimStatus;
  template_id?: "source_fact_snapshot" | "numeric_observation_snapshot";
  template_params?: ReportTemplateParams;
  question_text?: string;
  /** Model-authored factual text is rejected by the validator. */
  text?: string;
  [key: string]: unknown;
}>;

export type ReportSectionItem =
  | Readonly<{ type: "claim_ref"; claim_id: string }>
  | Readonly<{ type: "limitation_ref"; limitation_id: string }>
  | Readonly<{ type: "source_ref"; source_id: string }>;

export type ReportSection = Readonly<{
  id: ReportSectionId;
  items: readonly ReportSectionItem[];
  empty_state?: ReportEmptyState;
}>;

export type ReportLimitation = Readonly<{
  id: string;
  code: string;
  message: string;
}>;

/** The EH-148 candidate/normalized payload accepted at the EH-150 seam. */
export type ReportContent = Readonly<{
  schema_version: string;
  report_kind: string;
  generated_at: string;
  detail_level: ReportDetailLevel;
  source_document_ids: readonly string[];
  sections: readonly ReportSection[];
  claims: readonly ReportClaim[];
  sources: readonly ReportSource[];
  limitations: readonly ReportLimitation[];
  disclaimer: string;
  overview?: string;
  extensions?: unknown;
}>;

export type SourceAvailability = "active" | "archived" | "removed";
export type SourceDocumentStatus = "active" | "deleting" | "tombstoned";

/**
 * Returned by EH-148's server-authorized batch adapter. The optional profile
 * field lets an adapter omit a redundant value when authorization is already
 * enforced by its query; when present, it is checked by this module.
 */
export type AuthorizedReportSource = Readonly<{
  source_id: string;
  source_row_id?: string | null;
  profile_id?: string | null;
  kind: ReportSourceKind;
  document_id: string;
  source_status?: SourceAvailability;
  document_status?: SourceDocumentStatus;
  is_archived?: boolean;
  is_removed?: boolean;
}>;

type MaybePromise<T> = T | PromiseLike<T>;
export type ReportSourceResolver = (
  source_ids: readonly string[],
) => MaybePromise<readonly AuthorizedReportSource[]>;

/**
 * Canonical fields are snake_case. Camel-case aliases are accepted only to
 * keep the seam easy to consume from TypeScript adapters.
 */
export type ReportCitationValidationContext = Readonly<{
  profile_id?: string;
  profileId?: string;
  document_scope?: readonly string[] | null;
  documentScope?: readonly string[] | null;
  resolve_sources?: ReportSourceResolver;
  resolveSources?: ReportSourceResolver;
  resolveAuthorizedSources?: ReportSourceResolver;
}>;

export type ReportValidationIssue = Readonly<{
  code: ReportCitationIssueCode;
  message: string;
}>;

export type ReportValidationResult = Readonly<{
  status: ValidationStatus;
  content: ReportContent | null;
  version: typeof CURRENT_VALIDATOR_VERSION;
  issue_codes: readonly ReportCitationIssueCode[];
  issues: readonly ReportValidationIssue[];
  safe_summary: string;
}>;

export type ReportValidationEnvelope = Readonly<{
  status: PublishableValidationStatus;
  version: string;
  issue_codes: readonly ReportCitationIssueCode[];
}>;

export type ReportValidationEnvelopeResult = Readonly<{
  valid: boolean;
  envelope: ReportValidationEnvelope | null;
  safe_summary: string;
}>;

const ISSUE_CODE_ORDER: Readonly<Record<ReportCitationIssueCode, number>> = {
  SCHEMA_INVALID: 0,
  SOURCE_NOT_FOUND: 1,
  PROFILE_MISMATCH: 2,
  DOCUMENT_OUT_OF_SCOPE: 3,
  SOURCE_KIND_NOT_ALLOWED: 4,
  CLAIM_UNCITED: 5,
  SOURCE_UNAVAILABLE: 6,
  UNSAFE_CONTENT: 7,
};

const SAFE_ISSUE_MESSAGES: Readonly<Record<ReportCitationIssueCode, string>> = {
  SCHEMA_INVALID: "The report did not match the required report contract.",
  SOURCE_NOT_FOUND: "A cited source could not be verified.",
  PROFILE_MISMATCH: "A cited source could not be verified for this profile.",
  DOCUMENT_OUT_OF_SCOPE: "A cited source is outside the report scope.",
  SOURCE_KIND_NOT_ALLOWED:
    "A cited source kind is not allowed for this report.",
  CLAIM_UNCITED: "Some report content was omitted because it had no citation.",
  SOURCE_UNAVAILABLE:
    "A cited source is unavailable; its saved evidence is shown without a live source link.",
  UNSAFE_CONTENT:
    "Some report content was omitted because it did not meet the safety contract.",
};

const EMPTY_STATE_BY_SECTION: Readonly<
  Record<
    Exclude<ReportSectionId, "limitations" | "source_ledger">,
    ReportEmptyState
  >
> = {
  document_summary: "insufficient_evidence",
  latest_measurements: "insufficient_evidence",
  changes: "insufficient_evidence",
  clinician_questions: "no_data",
};

const CLAIM_SECTION_RULES: Readonly<
  Record<ReportClaimKind, readonly ReportSectionId[]>
> = {
  source_fact: ["document_summary", "latest_measurements", "changes"],
  numeric_observation: ["latest_measurements", "changes"],
  clinician_question: ["clinician_questions"],
};

type KeyTable = Readonly<Record<string, true>>;

const UNSAFE_CLAIM_FIELDS: KeyTable = {
  text: true,
  factual_text: true,
  free_text: true,
  diagnosis: true,
  diagnoses: true,
  treatment: true,
  treatment_plan: true,
  urgency: true,
  imperative: true,
  instruction: true,
  instructions: true,
  recommendation: true,
  recommendations: true,
  advice: true,
  answer: true,
  diagnostic_conclusion: true,
  medical_advice: true,
  care_instruction: true,
  care_instructions: true,
  directive: true,
  plan: true,
  plans: true,
};

const CONTENT_KEYS: KeyTable = {
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
  overview: true,
  extensions: true,
  validation: true,
};

const SOURCE_KEYS: KeyTable = {
  source_id: true,
  kind: true,
  document_id: true,
  snapshot: true,
  observed_at: true,
  recorded_at: true,
};

const LIMITATION_KEYS: KeyTable = { id: true, code: true, message: true };
const CITATION_KEYS: KeyTable = { source_id: true, document_id: true };
const SECTION_KEYS: KeyTable = { id: true, items: true, empty_state: true };
const CLAIM_KEYS: KeyTable = {
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
  ...UNSAFE_CLAIM_FIELDS,
};
const VALIDATION_ENVELOPE_KEYS: KeyTable = {
  status: true,
  version: true,
  issue_codes: true,
};

const SENSITIVE_SNAPSHOT_FIELDS: KeyTable = {
  profile_id: true,
  profileId: true,
  source_row_id: true,
  sourceRowId: true,
  storage_path: true,
  original_storage_path: true,
  token: true,
  access_token: true,
  refresh_token: true,
  authorization: true,
  bearer: true,
  pin: true,
  secret: true,
  private_key: true,
  raw_document: true,
  raw_text: true,
};

const CLAIM_REF_KEYS: KeyTable = { type: true, claim_id: true };
const LIMITATION_REF_KEYS: KeyTable = { type: true, limitation_id: true };
const SOURCE_REF_KEYS: KeyTable = { type: true, source_id: true };

const PUBLISHABLE_LIMITATION_CODES: Readonly<
  Partial<Record<ReportCitationIssueCode, true>>
> = {
  CLAIM_UNCITED: true,
  SOURCE_UNAVAILABLE: true,
  UNSAFE_CONTENT: true,
};

const FATAL_IDENTITY_CODES: Readonly<
  Partial<Record<ReportCitationIssueCode, true>>
> = {
  SOURCE_NOT_FOUND: true,
  PROFILE_MISMATCH: true,
  DOCUMENT_OUT_OF_SCOPE: true,
  SOURCE_KIND_NOT_ALLOWED: true,
};

type MachineLimitationCode =
  | "CLAIM_UNCITED"
  | "SOURCE_UNAVAILABLE"
  | "UNSAFE_CONTENT"
  | "NO_DATA";

const MACHINE_LIMITATIONS: Readonly<
  Record<MachineLimitationCode, Omit<ReportLimitation, "id">>
> = {
  CLAIM_UNCITED: {
    code: "CLAIM_UNCITED",
    message:
      "Some generated content was omitted because it had no source citation.",
  },
  SOURCE_UNAVAILABLE: {
    code: "SOURCE_UNAVAILABLE",
    message:
      "A cited source is no longer available for a live link; saved report evidence remains visible.",
  },
  UNSAFE_CONTENT: {
    code: "UNSAFE_CONTENT",
    message:
      "Some generated content was omitted because it did not meet the educational safety contract.",
  },
  NO_DATA: {
    code: "NO_DATA",
    message:
      "No source-grounded content was available for part of this report.",
  },
};

type UnknownRecord = Record<string, unknown>;
type ParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false }>;

type ParsedClaim = ReportClaim & Readonly<{ unsafe: boolean }>;
type ParsedSection = Readonly<{
  id: ReportSectionId;
  items: readonly ReportSectionItem[];
  empty_state?: ReportEmptyState;
}>;

type ParsedHeader = Pick<
  ReportContent,
  | "schema_version"
  | "report_kind"
  | "generated_at"
  | "detail_level"
  | "source_document_ids"
  | "disclaimer"
> &
  Readonly<{
    overview?: string;
    extensions?: unknown;
  }>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasSensitiveSnapshotField(
  value: unknown,
  seen = new Set<unknown>(),
): boolean {
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    return value.some((item) => hasSensitiveSnapshotField(item, seen));
  }
  if (!isRecord(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(
    ([key, nested]) =>
      SENSITIVE_SNAPSHOT_FIELDS[key] === true ||
      hasSensitiveSnapshotField(nested, seen),
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(record: UnknownRecord, keys: KeyTable): boolean {
  return Object.keys(record).every((key) => keys[key] === true);
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function uniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function addIssue(
  issues: Set<ReportCitationIssueCode>,
  code: ReportCitationIssueCode,
): void {
  issues.add(code);
}

function orderedIssueCodes(
  issues: ReadonlySet<ReportCitationIssueCode>,
): ReportCitationIssueCode[] {
  return [...issues].sort(
    (left, right) => ISSUE_CODE_ORDER[left] - ISSUE_CODE_ORDER[right],
  );
}

function resultIssues(
  issueCodes: readonly ReportCitationIssueCode[],
): ReportValidationIssue[] {
  return issueCodes.map((code) => ({
    code,
    message: SAFE_ISSUE_MESSAGES[code],
  }));
}

function invalidResult(
  issueCodes:
    | ReadonlySet<ReportCitationIssueCode>
    | readonly ReportCitationIssueCode[],
): ReportValidationResult {
  const ordered = Array.isArray(issueCodes)
    ? [...issueCodes]
    : orderedIssueCodes(issueCodes as ReadonlySet<ReportCitationIssueCode>);
  return {
    status: "invalid",
    content: null,
    version: CURRENT_VALIDATOR_VERSION,
    issue_codes: ordered,
    issues: resultIssues(ordered),
    safe_summary: "The report could not be validated.",
  };
}

function isRecognizedValidatorVersionValue(
  value: unknown,
): value is (typeof RECOGNIZED_VALIDATOR_VERSIONS)[number] {
  return (
    typeof value === "string" &&
    (RECOGNIZED_VALIDATOR_VERSIONS as readonly string[]).includes(value) &&
    !(RETIRED_VALIDATOR_VERSIONS as readonly string[]).includes(value)
  );
}

export function isRecognizedValidatorVersion(
  version: unknown,
): version is (typeof RECOGNIZED_VALIDATOR_VERSIONS)[number] {
  return isRecognizedValidatorVersionValue(version);
}

export function isReportCitationIssueCode(
  value: unknown,
): value is ReportCitationIssueCode {
  return isOneOf(value, REPORT_CITATION_ISSUE_CODES);
}

export function isPublishableValidationStatus(
  value: unknown,
): value is PublishableValidationStatus {
  return isOneOf(value, PUBLISHABLE_VALIDATION_STATUSES);
}

/**
 * Read/share/export adapters use this check for the immutable validation
 * envelope. It accepts historical versions only while the compatibility list
 * recognizes them, and never exposes input details in its failure summary.
 */
export function validateReportValidationEnvelope(
  value: unknown,
): ReportValidationEnvelopeResult {
  if (!isRecord(value)) {
    return {
      valid: false,
      envelope: null,
      safe_summary: "The report validation envelope is unavailable.",
    };
  }

  if (
    !hasOnlyKeys(value, VALIDATION_ENVELOPE_KEYS) ||
    !isPublishableValidationStatus(value.status) ||
    !isRecognizedValidatorVersionValue(value.version) ||
    !Array.isArray(value.issue_codes) ||
    !value.issue_codes.every(isReportCitationIssueCode) ||
    !uniqueStrings(value.issue_codes)
  ) {
    return {
      valid: false,
      envelope: null,
      safe_summary: "The report validation envelope is unavailable.",
    };
  }

  const issueCodes = value.issue_codes as ReportCitationIssueCode[];
  if (
    (value.status === "valid" && issueCodes.length > 0) ||
    (value.status === "limited" &&
      (issueCodes.length === 0 ||
        issueCodes.some((code) => PUBLISHABLE_LIMITATION_CODES[code] !== true)))
  ) {
    return {
      valid: false,
      envelope: null,
      safe_summary: "The report validation envelope is unavailable.",
    };
  }

  return {
    valid: true,
    envelope: {
      status: value.status,
      version: value.version,
      issue_codes: issueCodes,
    },
    safe_summary: "The report validation envelope is recognized.",
  };
}

function getProfileId(context: ReportCitationValidationContext): string | null {
  const candidates = [context.profile_id, context.profileId];
  return candidates.find(nonEmptyString)?.trim() ?? null;
}

function getDocumentScope(
  context: ReportCitationValidationContext,
): readonly string[] | null {
  const value =
    context.document_scope !== undefined
      ? context.document_scope
      : context.documentScope;
  if (!Array.isArray(value)) return null;
  if (!value.every(nonEmptyString) || !uniqueStrings(value)) return null;
  return value;
}

function getSourceResolver(
  context: ReportCitationValidationContext,
): ReportSourceResolver | null {
  return (
    context.resolve_sources ??
    context.resolveSources ??
    context.resolveAuthorizedSources ??
    null
  );
}

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

  if (record.overview !== undefined) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  if (record.validation !== undefined) {
    const envelope = validateReportValidationEnvelope(record.validation);
    if (!envelope.valid) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
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
      ...(record.overview !== undefined ? { overview: record.overview } : {}),
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
): ParseResult<ReportSource> {
  if (!isRecord(value) || !hasOnlyKeys(value, SOURCE_KEYS)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  if (
    !nonEmptyString(value.source_id) ||
    !isOneOf(value.kind, REPORT_SOURCE_KINDS) ||
    !nonEmptyString(value.document_id) ||
    !isRecord(value.snapshot)
  ) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  if (hasSensitiveSnapshotField(value.snapshot)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }

  for (const key of ["observed_at", "recorded_at"] as const) {
    if (
      value[key] !== undefined &&
      value[key] !== null &&
      typeof value[key] !== "string"
    ) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
  }

  return {
    ok: true,
    value: {
      source_id: value.source_id,
      kind: value.kind,
      document_id: value.document_id,
      snapshot: value.snapshot,
      ...(value.observed_at !== undefined
        ? { observed_at: value.observed_at as string | null }
        : {}),
      ...(value.recorded_at !== undefined
        ? { recorded_at: value.recorded_at as string | null }
        : {}),
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
  if (!Array.isArray(value)) {
    addIssue(issues, "SCHEMA_INVALID");
    return { ok: false };
  }
  const limitations: ReportLimitation[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, LIMITATION_KEYS) ||
      !nonEmptyString(item.id) ||
      !nonEmptyString(item.code) ||
      !nonEmptyString(item.message) ||
      ids.has(item.id)
    ) {
      addIssue(issues, "SCHEMA_INVALID");
      return { ok: false };
    }
    ids.add(item.id);
    limitations.push({
      id: item.id,
      code: item.code,
      message: item.message,
    });
  }
  return { ok: true, value: limitations };
}

function parseTopLevelArrays(
  record: UnknownRecord,
  issues: Set<ReportCitationIssueCode>,
): ParseResult<{
  claims: readonly ParsedClaim[];
  sources: readonly ReportSource[];
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

  const sources: ReportSource[] = [];
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
  status: ReportClaimStatus,
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
    const rowSourceStatus = sourceStatus(row);
    const rowDocumentStatus = documentStatus(row);

    if (!isOneOf(rowKind, REPORT_SOURCE_KINDS)) {
      addIssue(issues, "SOURCE_KIND_NOT_ALLOWED");
    }
    if (rowProfileId !== undefined && rowProfileId !== null) {
      if (!nonEmptyString(rowProfileId) || rowProfileId !== profileId) {
        addIssue(issues, "PROFILE_MISMATCH");
      }
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
    if (claim.status === "removed") {
      removedClaimIds.add(claim.id);
      continue;
    }

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
      projectClaim(claim, unavailable ? "limited" : claim.status),
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
    parsed.value.sources,
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
