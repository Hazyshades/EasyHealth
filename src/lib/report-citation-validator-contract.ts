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

export type ReportSourceReference = Readonly<{
  source_id: string;
  kind: ReportSourceKind;
  document_id: string;
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
  status: Exclude<ReportClaimStatus, "removed">;
  template_id?: "source_fact_snapshot" | "numeric_observation_snapshot";
  template_params?: ReportTemplateParams;
  question_text?: string;
  text?: string;
}>;

export type ReportCandidateClaim = Readonly<{
  id: string;
  section: ReportSectionId;
  kind: ReportClaimKind;
  origin: ReportClaimOrigin;
  citations: readonly ReportCitation[];
  factual: boolean;
  status: "supported" | "removed";
  template_id?: "source_fact_snapshot" | "numeric_observation_snapshot";
  template_params?: ReportTemplateParams;
  question_text?: string;
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
  code: MachineLimitationCode;
  message: string;
}>;

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
}>;

/** Model-facing input. It contains references only; EH-150 supplies snapshots. */
export type ReportCandidateContent = Readonly<{
  schema_version: string;
  report_kind: string;
  generated_at: string;
  detail_level: ReportDetailLevel;
  source_document_ids: readonly string[];
  sections: readonly ReportSection[];
  claims: readonly ReportCandidateClaim[];
  sources: readonly ReportSourceReference[];
  limitations: readonly [];
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
  snapshot: Readonly<Record<string, unknown>>;
  observed_at?: string | null;
  recorded_at?: string | null;
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
};

const SOURCE_KEYS: KeyTable = {
  source_id: true,
  kind: true,
  document_id: true,
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

const DISPLAY_SAFE_SNAPSHOT_KEYS: KeyTable = {
  label: true,
  value: true,
  unit: true,
  range: true,
  reference_range: true,
  reference_low: true,
  reference_high: true,
  text: true,
  date: true,
  observed_at: true,
  recorded_at: true,
};
const DISPLAY_SAFE_RANGE_KEYS: KeyTable = {
  low: true,
  high: true,
  min: true,
  max: true,
  unit: true,
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

type ParsedClaim = Readonly<{
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
  unsafe: boolean;
}>;
type ParsedSection = Readonly<{
  id: ReportSectionId;
  items: readonly ReportSectionItem[];
  empty_state?: ReportEmptyState;
}>;

type ParsedHeader = Pick<
  ReportCandidateContent,
  | "schema_version"
  | "report_kind"
  | "generated_at"
  | "detail_level"
  | "source_document_ids"
>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isDisplaySafeScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function projectDisplaySafeSnapshot(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  if (!isRecord(value)) return null;
  const projected: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (DISPLAY_SAFE_SNAPSHOT_KEYS[key] === true) {
      if (isDisplaySafeScalar(nested)) {
        projected[key] = nested;
        continue;
      }
      if (
        (key === "range" || key === "reference_range") &&
        isRecord(nested) &&
        Object.keys(nested).every(
          (nestedKey) => DISPLAY_SAFE_RANGE_KEYS[nestedKey] === true,
        ) &&
        Object.values(nested).every(isDisplaySafeScalar)
      ) {
        projected[key] = { ...nested };
        continue;
      }
    }
    return null;
  }
  return Object.keys(projected).length > 0 ? projected : null;
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
export {
  addIssue,
  CLAIM_KEYS,
  CLAIM_REF_KEYS,
  CLAIM_SECTION_RULES,
  CITATION_KEYS,
  CONTENT_KEYS,
  EMPTY_STATE_BY_SECTION,
  FATAL_IDENTITY_CODES,
  getDocumentScope,
  getProfileId,
  getSourceResolver,
  hasOnlyKeys,
  projectDisplaySafeSnapshot,
  invalidResult,
  isOneOf,
  LIMITATION_KEYS,
  LIMITATION_REF_KEYS,
  MACHINE_LIMITATIONS,
  nonEmptyString,
  orderedIssueCodes,
  resultIssues,
  uniqueStrings,
  SOURCE_REF_KEYS,
  SAFE_ISSUE_MESSAGES,
  SECTION_KEYS,
  SOURCE_KEYS,
  UNSAFE_CLAIM_FIELDS,
};

export type {
  KeyTable,
  MachineLimitationCode,
  ParsedClaim,
  ParsedHeader,
  ParsedSection,
  ParseResult,
  UnknownRecord,
};
