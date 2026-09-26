import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import type { ReportEvidenceProjection } from "@/lib/report-evidence";
import {
  assertDoctorVisitBriefCandidate,
  normalizeUserSelectedQuestions,
  REPORT_SECTION_IDS,
  type ClinicianQuestionClaim,
  type DoctorVisitBrief,
  type DoctorVisitBriefCandidate,
  type NumericObservationClaim,
  type ReportClaim,
  type ReportDetailLevel,
  type ReportLimitation,
  type ReportRequestedScope,
  type ReportSource,
  type ReportValidationIssueCode,
  type SourceFactClaim,
} from "@/lib/report-contract";

const LIMITATION_MESSAGES: Record<string, string> = {
  EMPTY_FACTUAL_CLAIM:
    "A source-backed item was omitted because the source snapshot did not contain a renderable value.",
  NO_COMPARABLE_HISTORY:
    "The selected documents do not contain enough dated history for a change comparison.",
  SOURCE_UNAVAILABLE:
    "A source row is no longer available; its retained snapshot is shown as limited evidence.",
  TEMPLATE_INVALID:
    "A generated item was omitted because it did not match an approved report template.",
  UNSAFE_CONTENT:
    "A generated item was omitted because it did not meet the report safety policy.",
  SCOPE_CONFLICT:
    "A generated item was omitted because its source was outside the selected report scope.",
};

const SAFE_LIMITATION_CODES = new Set(Object.keys(LIMITATION_MESSAGES));

const IMPERATIVE_QUESTION_START =
  /^(?:(?:start|stop|take|change|increase|decrease|seek|call|go|contact|continue|discontinue|schedule|book|discuss|ask|request|follow|monitor|check|review|consider|avoid|use|keep|make|please)\b|you\s+(?:need|must|should|have\s+to|ought\s+to)\b)/iu;

type PreparedDoctorVisitBrief = Omit<DoctorVisitBrief, "validation">;

export type ReportSafetyResult = {
  brief: PreparedDoctorVisitBrief;
  issue_codes: ReportValidationIssueCode[];
  status: "valid" | "limited";
};

export type PrepareDoctorVisitBriefInput = {
  candidate: unknown;
  projection: ReportEvidenceProjection;
  requested_scope: ReportRequestedScope;
  detail_level: ReportDetailLevel;
  generated_at: string;
  user_questions?: unknown;
  extensions?: { biomarker_dynamics?: unknown };
};

function fail(code: string): never {
  throw new Error(code);
}

function addIssue(
  issueCodes: ReportValidationIssueCode[],
  code: ReportValidationIssueCode,
): void {
  if (!issueCodes.includes(code)) issueCodes.push(code);
}

function safeLimitation(id: string, code: string): ReportLimitation {
  const message = LIMITATION_MESSAGES[code];
  if (!message) fail("REPORT_LIMITATION_CODE_INVALID");
  return { id, code, message };
}

function renderDate(value: string | null, includeDate: boolean): string {
  if (!includeDate || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return ` (date: ${date.toISOString().slice(0, 10)})`;
}

function renderSourceFact(
  source: ReportSource,
  includeDate: boolean,
): string | null {
  const snapshot = source.snapshot;
  switch (snapshot.kind) {
    case "observation": {
      const value =
        snapshot.value_text?.trim() ||
        (snapshot.value === null ? "" : String(snapshot.value));
      if (!value) return null;
      const unit = snapshot.unit.trim();
      return `${snapshot.label}: ${value}${unit ? ` ${unit}` : ""}${renderDate(snapshot.observed_at, includeDate)}`;
    }
    case "finding":
      return `Imaging finding source available${renderDate(snapshot.observed_at, includeDate)}`;
    case "clinical_note":
      return `Clinical note source available${renderDate(snapshot.observed_at, includeDate)}`;
    case "prescription":
      return `Prescription source available${renderDate(snapshot.observed_at, includeDate)}`;
    case "referral":
      return `Referral source available${renderDate(snapshot.observed_at, includeDate)}`;
    case "document_summary": {
      const documentType = snapshot.document_type.trim();
      return `Document summary source available${documentType ? ` (${documentType})` : ""}${renderDate(snapshot.observed_at, includeDate)}`;
    }
  }
}

function renderNumericObservation(
  source: ReportSource,
  includeRange: boolean,
): string | null {
  if (source.kind !== "observation" || source.snapshot.kind !== "observation") {
    return null;
  }
  const snapshot = source.snapshot;
  const value =
    snapshot.value_text?.trim() ||
    (snapshot.value === null ? "" : String(snapshot.value));
  if (!value) return null;
  const unit = snapshot.unit.trim();
  let text = `${snapshot.label}: ${value}${unit ? ` ${unit}` : ""}`;
  if (includeRange && snapshot.ref_low !== null && snapshot.ref_high !== null) {
    text += ` (reference range: ${snapshot.ref_low}–${snapshot.ref_high})`;
  }
  return text;
}
function hasComparableChanges(
  candidate: DoctorVisitBriefCandidate,
  sourceById: Map<string, ReportSource>,
): boolean {
  const groups = new Map<
    string,
    { sourceIds: Set<string>; observedDates: Set<string> }
  >();
  for (const claim of candidate.claims) {
    if (claim.status === "removed" || claim.section !== "changes") {
      continue;
    }
    const source = sourceById.get(claim.template_params.source_id);
    if (source?.kind !== "observation") continue;
    const snapshot = source.snapshot;
    if (snapshot.kind !== "observation" || !snapshot.observed_at) continue;
    const unit = snapshot.unit;
    if (!unit.trim()) continue;
    const observedAt = new Date(snapshot.observed_at);
    if (Number.isNaN(observedAt.getTime())) continue;
    const identity = `${snapshot.label.trim().toLocaleLowerCase()}::${unit}`;
    const group = groups.get(identity) ?? {
      sourceIds: new Set<string>(),
      observedDates: new Set<string>(),
    };
    group.sourceIds.add(source.source_id);
    group.observedDates.add(observedAt.toISOString().slice(0, 10));
    groups.set(identity, group);
  }
  return [...groups.values()].some(
    (group) => group.sourceIds.size >= 2 && group.observedDates.size >= 2,
  );
}

function assertCandidateScope(
  candidate: DoctorVisitBriefCandidate,
  input: PrepareDoctorVisitBriefInput,
): void {
  if (candidate.detail_level !== input.detail_level) {
    fail("REPORT_CANDIDATE_DETAIL_LEVEL_INVALID");
  }
  if (
    candidate.requested_scope.kind !== input.requested_scope.kind ||
    (candidate.requested_scope.kind === "explicit" &&
      input.requested_scope.kind === "explicit" &&
      [...candidate.requested_scope.document_ids].sort().join(",") !==
        [...input.requested_scope.document_ids].sort().join(","))
  ) {
    fail("REPORT_CANDIDATE_SCOPE_CONFLICT");
  }

  const projectionDocumentIds = [
    ...input.projection.source_document_ids,
  ].sort();
  const candidateDocumentIds = [...candidate.source_document_ids].sort();
  if (projectionDocumentIds.join(",") !== candidateDocumentIds.join(",")) {
    fail("REPORT_CANDIDATE_SOURCE_SCOPE_INVALID");
  }

  const projectionSources = new Map(
    input.projection.sources.map((source) => [source.source_id, source]),
  );
  if (projectionSources.size !== candidate.sources.length) {
    fail("REPORT_CANDIDATE_SOURCE_CATALOG_INVALID");
  }
  for (const source of candidate.sources) {
    const expected = projectionSources.get(source.source_id);
    if (
      !expected ||
      expected.kind !== source.kind ||
      expected.document_id !== source.document_id ||
      expected.snapshot.kind !== source.snapshot.kind
    ) {
      fail("REPORT_CANDIDATE_SOURCE_CATALOG_INVALID");
    }
  }
}
function assertQuestionForm(
  normalized: string,
  invalidCode: string,
  imperativeCode: string,
): void {
  if (!normalized.endsWith("?")) fail(invalidCode);
  if (IMPERATIVE_QUESTION_START.test(normalized)) fail(imperativeCode);
}

function normalizeModelQuestion(question: string, seen: Set<string>): string {
  const [normalized] = normalizeUserSelectedQuestions([question]);
  assertQuestionForm(
    normalized,
    "REPORT_CANDIDATE_QUESTION_INVALID",
    "REPORT_CANDIDATE_IMPERATIVE_TEXT",
  );
  if (seen.has(normalized)) fail("REPORT_CANDIDATE_QUESTIONS_DUPLICATED");
  seen.add(normalized);
  return normalized;
}

function buildOverview(claims: ReportClaim[], sourceCount: number): string {
  const factualCount = claims.filter((claim) => claim.factual).length;
  const questionCount = claims.filter(
    (claim): claim is ClinicianQuestionClaim =>
      claim.kind === "clinician_question",
  ).length;
  if (factualCount === 0) {
    return `No source-grounded factual items were available from ${sourceCount} source document${sourceCount === 1 ? "" : "s"}.`;
  }
  return `This brief contains ${factualCount} source-backed item${factualCount === 1 ? "" : "s"} from ${sourceCount} source document${sourceCount === 1 ? "" : "s"}, plus ${questionCount} question${questionCount === 1 ? "" : "s"} for discussion with a healthcare professional.`;
}

export function prepareDoctorVisitBrief(
  input: PrepareDoctorVisitBriefInput,
): ReportSafetyResult {
  const candidate = assertDoctorVisitBriefCandidate(input.candidate);

  assertCandidateScope(candidate, input);
  const userQuestions = normalizeUserSelectedQuestions(
    input.user_questions ?? [],
  );
  for (const question of userQuestions) {
    assertQuestionForm(
      question,
      "REPORT_USER_QUESTION_INVALID",
      "REPORT_USER_QUESTION_IMPERATIVE_TEXT",
    );
  }
  const issueCodes: ReportValidationIssueCode[] = [];
  const limitations = new Map<string, ReportLimitation>();
  let limitationNumber = 1;

  for (const limitation of candidate.limitations) {
    if (!SAFE_LIMITATION_CODES.has(limitation.code)) {
      addIssue(issueCodes, "UNSAFE_CONTENT");
      continue;
    }
    const id = `limitation-${limitationNumber++}`;
    limitations.set(id, safeLimitation(id, limitation.code));
    if (limitation.code === "UNSAFE_CONTENT")
      addIssue(issueCodes, "UNSAFE_CONTENT");
  }

  const sourceById = new Map(
    input.projection.sources.map((source) => [source.source_id, source]),
  );
  const comparableChanges = hasComparableChanges(candidate, sourceById);

  const claims: ReportClaim[] = [];
  const seenQuestions = new Set<string>();

  for (const candidateClaim of candidate.claims) {
    if (candidateClaim.status === "removed") {
      addIssue(issueCodes, "UNSAFE_CONTENT");
      const id = `limitation-${limitationNumber++}`;
      limitations.set(id, safeLimitation(id, "UNSAFE_CONTENT"));
      continue;
    }

    if (
      candidateClaim.kind === "clinician_question" &&
      candidateClaim.origin !== "generated"
    ) {
      fail("REPORT_MODEL_USER_QUESTION_FORBIDDEN");
    }

    if (candidateClaim.kind === "clinician_question") {
      const question = normalizeModelQuestion(
        candidateClaim.question_text,
        seenQuestions,
      );
      claims.push({
        id: candidateClaim.id,
        section: "clinician_questions",
        kind: "clinician_question",
        origin: "generated",
        factual: false,
        citations: [],
        status: candidateClaim.status,
        question_text: question,
      });
      continue;
    }
    if (candidateClaim.section === "changes" && !comparableChanges) {
      addIssue(issueCodes, "EMPTY_FACTUAL_CLAIM");
      continue;
    }

    const source = sourceById.get(candidateClaim.template_params.source_id);
    if (!source) {
      addIssue(issueCodes, "SOURCE_NOT_FOUND");
      const id = `limitation-${limitationNumber++}`;
      limitations.set(id, safeLimitation(id, "SCOPE_CONFLICT"));
      continue;
    }

    const text =
      candidateClaim.kind === "source_fact"
        ? renderSourceFact(source, candidateClaim.template_params.include_date)
        : renderNumericObservation(
            source,
            candidateClaim.template_params.include_range,
          );
    if (!text) {
      addIssue(issueCodes, "EMPTY_FACTUAL_CLAIM");
      const id = `limitation-${limitationNumber++}`;
      limitations.set(id, safeLimitation(id, "EMPTY_FACTUAL_CLAIM"));
      continue;
    }

    if (candidateClaim.kind === "source_fact") {
      const claim: SourceFactClaim = {
        ...candidateClaim,
        text,
        status: candidateClaim.status,
      };
      claims.push(claim);
    } else {
      const claim: NumericObservationClaim = {
        ...candidateClaim,
        text,
        status: candidateClaim.status,
      };
      claims.push(claim);
    }
  }

  for (const question of userQuestions) {
    const id = `question-user-${claims.length + 1}`;
    if (claims.some((claim) => claim.id === id)) {
      fail("REPORT_CLAIM_ID_COLLISION");
    }
    claims.push({
      id,
      section: "clinician_questions",
      kind: "clinician_question",
      origin: "user_selected",
      factual: false,
      citations: [],
      status: "supported",
      question_text: question,
    });
  }

  const activeClaimsBySection = new Map(
    REPORT_SECTION_IDS.map((section) => [
      section,
      claims.filter((claim) => claim.section === section),
    ]),
  );
  if ((activeClaimsBySection.get("changes")?.length ?? 0) === 0) {
    const id = `limitation-${limitationNumber++}`;
    limitations.set(id, safeLimitation(id, "NO_COMPARABLE_HISTORY"));
    addIssue(issueCodes, "EMPTY_FACTUAL_CLAIM");
  }

  const limitationValues = [...limitations.values()];
  const sections = REPORT_SECTION_IDS.map((id) => {
    if (id === "limitations") {
      return limitationValues.length > 0
        ? {
            id,
            items: limitationValues.map((limitation) => ({
              type: "limitation_ref" as const,
              limitation_id: limitation.id,
            })),
          }
        : { id, items: [], empty_state: "no_data" as const };
    }
    if (id === "source_ledger") {
      return input.projection.sources.length > 0
        ? {
            id,
            items: input.projection.sources.map((source) => ({
              type: "source_ref" as const,
              source_id: source.source_id,
            })),
          }
        : { id, items: [], empty_state: "no_data" as const };
    }
    const sectionClaims = activeClaimsBySection.get(id) ?? [];
    return sectionClaims.length > 0
      ? {
          id,
          items: sectionClaims.map((claim) => ({
            type: "claim_ref" as const,
            claim_id: claim.id,
          })),
        }
      : { id, items: [], empty_state: "insufficient_evidence" as const };
  });

  const brief: PreparedDoctorVisitBrief = {
    schema_version: "eh148.v1",
    report_kind: "doctor_visit_brief",
    generated_at: input.generated_at,
    detail_level: input.detail_level,
    requested_scope: input.requested_scope,
    source_document_ids: [...input.projection.source_document_ids],
    sections,
    claims,
    sources: [...input.projection.sources],
    limitations: limitationValues,
    disclaimer: MEDICAL_DISCLAIMER,
    overview: buildOverview(
      claims,
      input.projection.source_document_ids.length,
    ),
    ...(input.extensions ? { extensions: input.extensions } : {}),
  };

  return {
    brief,
    issue_codes: issueCodes,
    status: issueCodes.length === 0 ? "valid" : "limited",
  };
}
