import { getProfileById } from "@/lib/auth/profile";
import {
  modelIdForStage,
  resolveModelForProfileStage,
} from "@/lib/ai-provider";
import { getFrozenBiomarkerDynamicsForReport } from "@/lib/biomarker-dynamics-server";
import type { FrozenBiomarkerDynamicsExtension } from "@/lib/biomarker-dynamics";
import {
  buildDocumentStructuredContext,
  getDocumentWriteGenerations,
  type StructuredBiomarkerContext,
} from "@/lib/documents/structured-context";
import { generateReportSelection } from "@/lib/generate-doctor-summary";
import {
  assembleReportCandidate,
  parseReportSelection,
} from "@/lib/report-candidate";
import {
  buildMultiSourceReportContext,
  buildSummaryPreview,
  type ObservationRow,
} from "@/lib/reports";
import {
  buildStructuredReportSystemPrompt,
  type CreateReportBody,
} from "@/lib/report-prompts";
import {
  buildReportEvidenceProjection,
  type ReportEvidenceProjection,
} from "@/lib/report-evidence";
import {
  assertDoctorVisitBrief,
  normalizeUserSelectedQuestions,
  parseReportDateRange,
  type DoctorVisitBrief,
  type ReportDateRange,
  type ReportRequestedScope,
  type ReportSource,
  type ReportValidationIssueCode,
} from "@/lib/report-contract";
import {
  prepareDoctorVisitBrief,
  type ReportSafetyResult,
} from "@/lib/report-safety-policy";
import {
  validateReportContent,
  type AuthorizedReportSource,
  type ReportCitationIssueCode,
  type ReportContent,
} from "@/lib/report-citation-validator";
import { createAdminClient } from "@/lib/supabase/admin";

export class ReportGenerationError extends Error {
  constructor(
    readonly httpStatus: 400 | 409 | 422,
    readonly code: string,
  ) {
    super(code);
    this.name = "ReportGenerationError";
  }
}

type RequestedScope = ReportRequestedScope;

type PersistedReportRow = {
  id: string;
};

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === rightSet.size &&
    [...leftSet].every((id) => rightSet.has(id))
  );
}

function parseDateRangeOrThrow(
  value: unknown,
  code: string,
): ReportDateRange | null {
  try {
    return parseReportDateRange(value ?? null);
  } catch {
    throw new ReportGenerationError(400, code);
  }
}

function requestedScopeFor(input: CreateReportBody): RequestedScope {
  if (input.document_ids === null || input.document_ids === undefined) {
    return { kind: "all_eligible", document_ids: null };
  }

  const documentIds = uniqueIds(input.document_ids);
  if (
    documentIds.length === 0 ||
    documentIds.length !== input.document_ids.length
  ) {
    throw new ReportGenerationError(400, "report_document_scope_invalid");
  }
  return { kind: "explicit", document_ids: documentIds };
}

function observationsFromStructuredContext(
  biomarkers: readonly StructuredBiomarkerContext[],
): ObservationRow[] {
  return biomarkers.map((biomarker) => ({
    id: biomarker.source_row_id,
    document_id: biomarker.document_id,
    name: biomarker.biomarker,
    analyte_key: biomarker.analyte_key,
    measurement_definition_key: biomarker.measurement_definition_key,
    resolution_status: biomarker.resolution_status,
    verification_status: biomarker.verification_status,
    decision_source: biomarker.decision_source,
    decision_quality: biomarker.decision_quality,
    decision_not_persisted: biomarker.decision_not_persisted,
    decision_quality_codes: biomarker.decision_quality_codes,
    registry_binding_ready: biomarker.registry_binding_ready,
    value_kind: biomarker.value_kind,
    value_text: biomarker.value_text,
    value: biomarker.value,
    unit: biomarker.unit,
    ref_low: biomarker.ref_low,
    ref_high: biomarker.ref_high,
    observed_at: biomarker.observed_at,
    documents: {
      original_filename: biomarker.source,
      observed_at: biomarker.observed_at,
    },
  }));
}

function buildGenerationPrompt(options: {
  projection: ReportEvidenceProjection;
  requestedScope: RequestedScope;
  reportDateRange: ReportDateRange | null;
  abnormalOnly: boolean;
  dynamicsPeriod: ReportDateRange | null;
}): string {
  return [
    "Create the Doctor Visit Brief candidate from this server-authorized source catalog.",
    "Return only the candidate JSON envelope described by the system prompt.",
    "The server will append user-selected questions and render all factual text.",
    "Do not answer user questions and do not include factual prose or limitation messages.",
    `Requested scope: ${JSON.stringify(options.requestedScope)}`,
    `Actual source document IDs: ${JSON.stringify(options.projection.source_document_ids)}`,
    `Report date range: ${JSON.stringify(options.reportDateRange)}`,
    `Abnormal observations only: ${String(options.abnormalOnly)}`,
    `Biomarker dynamics period: ${JSON.stringify(options.dynamicsPeriod)}`,
    "Source catalog:",
    JSON.stringify(options.projection.prompt_sources, null, 2),
  ].join("\n\n");
}

function validatorSnapshot(source: ReportSource): Record<string, unknown> {
  return {
    label: source.snapshot.label,
    observed_at: source.snapshot.observed_at,
  };
}

function buildAuthorizedSourceResolver(
  profileId: string,
  projection: ReportEvidenceProjection,
): (sourceIds: readonly string[]) => readonly AuthorizedReportSource[] {
  const sourceById = new Map(
    projection.sources.map((source) => [source.source_id, source]),
  );
  const mappingById = new Map(
    projection.mappings.map((mapping) => [mapping.source_id, mapping]),
  );

  return (sourceIds) =>
    sourceIds.flatMap((sourceId) => {
      const source = sourceById.get(sourceId);
      const mapping = mappingById.get(sourceId);
      if (!source || !mapping) return [];
      return [
        {
          source_id: source.source_id,
          source_row_id: mapping.source_row_id,
          profile_id: profileId,
          kind: source.kind,
          document_id: source.document_id,
          snapshot: validatorSnapshot(source),
          observed_at: source.snapshot.observed_at,
          source_status: "active" as const,
          document_status: "active" as const,
          is_archived: false,
          is_removed: false,
        },
      ];
    });
}

function mapValidatorIssue(
  code: ReportCitationIssueCode,
): ReportValidationIssueCode {
  switch (code) {
    case "SOURCE_NOT_FOUND":
      return "SOURCE_NOT_FOUND";
    case "SOURCE_UNAVAILABLE":
      return "SOURCE_UNAVAILABLE";
    case "UNSAFE_CONTENT":
      return "UNSAFE_CONTENT";
    case "CLAIM_UNCITED":
      return "EMPTY_FACTUAL_CLAIM";
    case "DOCUMENT_OUT_OF_SCOPE":
    case "PROFILE_MISMATCH":
    case "SOURCE_KIND_NOT_ALLOWED":
      return "SCOPE_CONFLICT";
    case "SCHEMA_INVALID":
    default:
      return "SCHEMA_INVALID";
  }
}

function mergeValidationCodes(
  validationCodes: readonly ReportCitationIssueCode[],
  prepared: ReportSafetyResult,
): ReportValidationIssueCode[] {
  const codes = new Set<ReportValidationIssueCode>(
    validationCodes.map(mapValidatorIssue),
  );
  for (const code of prepared.issue_codes) codes.add(code);
  return [...codes];
}

function validatedCandidate(options: {
  content: ReportContent;
  generatedAt: string;
  requestedScope: RequestedScope;
  sourceDocumentIds: readonly string[];
  projection: ReportEvidenceProjection;
}): Record<string, unknown> {
  const { content } = options;
  return {
    schema_version: content.schema_version,
    report_kind: content.report_kind,
    generated_at: options.generatedAt,
    detail_level: content.detail_level,
    requested_scope: options.requestedScope,
    source_document_ids: [...options.sourceDocumentIds],
    sections: content.sections,
    claims: content.claims,
    sources: options.projection.sources,
    limitations: content.limitations.map(({ id, code }) => ({ id, code })),
  };
}

function briefCandidateFromValidatedContent(options: {
  content: ReportContent;
  generatedAt: string;
  requestedScope: RequestedScope;
  sourceDocumentIds: readonly string[];
  projection: ReportEvidenceProjection;
}): Record<string, unknown> {
  const { content } = options;
  return {
    ...validatedCandidate(options),
    sections: content.sections,
    claims: content.claims,
    limitations: content.limitations.map(({ id, code }) => ({ id, code })),
  };
}

function finalReportContent(options: {
  prepared: ReportSafetyResult;
  validationCodes: readonly ReportCitationIssueCode[];
  validationVersion: string;
  dynamicsExtension: FrozenBiomarkerDynamicsExtension | null;
}): DoctorVisitBrief {
  const issueCodes = mergeValidationCodes(
    options.validationCodes,
    options.prepared,
  );
  const status =
    options.prepared.status === "limited" || issueCodes.length > 0
      ? "limited"
      : "valid";
  return assertDoctorVisitBrief({
    ...options.prepared.brief,
    ...(options.dynamicsExtension
      ? { extensions: { biomarker_dynamics: options.dynamicsExtension } }
      : {}),
    validation: {
      status,
      version: options.validationVersion,
      issue_codes: issueCodes,
    },
  });
}

function isSourceGenerationConflict(message: string): boolean {
  return /(?:report_source_(?:generation_conflict|generation_invalid|not_found|unavailable)|report_(?:source_scope|requested_scope_conflict)|document_(?:not_found|unavailable))/u.test(
    message,
  );
}

export async function createValidatedReport(
  profileId: string,
  input: CreateReportBody,
): Promise<PersistedReportRow> {
  const requestedScope = requestedScopeFor(input);
  const reportDateRange = parseDateRangeOrThrow(
    input.report_date_range,
    "report_date_range_invalid",
  );
  const dynamicsPeriod = parseDateRangeOrThrow(
    input.biomarker_dynamics_period,
    "biomarker_dynamics_period_invalid",
  );

  let normalizedQuestions: string[];
  try {
    normalizedQuestions = normalizeUserSelectedQuestions(input.questions ?? []);
  } catch {
    throw new ReportGenerationError(400, "report_questions_invalid");
  }

  const structured = await buildDocumentStructuredContext(
    profileId,
    requestedScope.kind === "explicit" ? requestedScope.document_ids : null,
  );
  const context = buildMultiSourceReportContext(
    structured,
    observationsFromStructuredContext(structured.biomarkers),
    input.abnormal_only,
    reportDateRange,
  );
  const projection = buildReportEvidenceProjection(context);
  const actualSourceDocumentIds = uniqueIds(projection.source_document_ids);

  if (actualSourceDocumentIds.length === 0) {
    throw new ReportGenerationError(422, "report_source_scope_empty");
  }
  if (
    requestedScope.kind === "explicit" &&
    !sameIdSet(requestedScope.document_ids, actualSourceDocumentIds)
  ) {
    throw new ReportGenerationError(422, "report_requested_scope_conflict");
  }

  const sourceWriteGenerations = await getDocumentWriteGenerations(
    profileId,
    actualSourceDocumentIds,
  );
  if (
    actualSourceDocumentIds.some(
      (documentId) => sourceWriteGenerations[documentId] === undefined,
    )
  ) {
    throw new ReportGenerationError(409, "report_source_changed");
  }

  const dynamicsExtension = dynamicsPeriod
    ? await getFrozenBiomarkerDynamicsForReport({
        profileId,
        period: dynamicsPeriod,
        reportScopeDocumentIds: actualSourceDocumentIds,
      })
    : null;
  const generatedAt = new Date().toISOString();
  const profile = await getProfileById(profileId);
  const model = await resolveModelForProfileStage(profileId, "report");
  const modelId = modelIdForStage(profile.ai_provider, "report");
  const rawSelection = await generateReportSelection({
    model,
    system: buildStructuredReportSystemPrompt(
      input.report_type,
      input.detail_level,
    ),
    prompt: buildGenerationPrompt({
      projection,
      requestedScope,
      reportDateRange,
      abnormalOnly: input.abnormal_only,
      dynamicsPeriod,
    }),
    trace: {
      modelId,
      provider: profile.ai_provider,
      stage: "report",
      profileId,
      documentId: null,
      supabase: createAdminClient(),
    },
  });
  const candidate = assembleReportCandidate({
    selection: parseReportSelection(rawSelection),
    projection,
    detailLevel: input.detail_level,
    generatedAt,
  });
  const validation = await validateReportContent(candidate, {
    profile_id: profileId,
    document_scope: actualSourceDocumentIds,
    resolve_sources: buildAuthorizedSourceResolver(profileId, projection),
  });
  if (validation.status === "invalid" || validation.content === null) {
    throw new ReportGenerationError(422, "report_validation_failed");
  }
  if (
    validation.content.detail_level !== input.detail_level ||
    !sameIdSet(validation.content.source_document_ids, actualSourceDocumentIds)
  ) {
    throw new ReportGenerationError(422, "report_validation_scope_conflict");
  }

  let prepared: ReportSafetyResult;
  try {
    prepared = prepareDoctorVisitBrief({
      candidate: briefCandidateFromValidatedContent({
        content: validation.content,
        generatedAt,
        requestedScope,
        sourceDocumentIds: actualSourceDocumentIds,
        projection,
      }),
      projection,
      requested_scope: requestedScope,
      detail_level: input.detail_level,
      generated_at: generatedAt,
      user_questions: normalizedQuestions,
      ...(dynamicsExtension
        ? { extensions: { biomarker_dynamics: dynamicsExtension } }
        : {}),
    });
  } catch {
    throw new ReportGenerationError(422, "report_safety_validation_failed");
  }

  const content = finalReportContent({
    prepared,
    validationCodes: validation.issue_codes,
    validationVersion: validation.version,
    dynamicsExtension,
  });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_validated_report", {
    p_profile_id: profileId,
    p_title: input.title,
    p_report_type: input.report_type,
    p_detail_level: input.detail_level,
    p_requested_scope_kind: requestedScope.kind,
    p_requested_document_ids:
      requestedScope.kind === "explicit" ? requestedScope.document_ids : null,
    p_actual_source_document_ids: actualSourceDocumentIds,
    p_source_write_generations: sourceWriteGenerations,
    p_abnormal_only: input.abnormal_only,
    p_content: content,
    p_summary_preview: buildSummaryPreview(content.overview),
    p_validation_status: content.validation.status,
    p_validation_version: content.validation.version,
    p_validation_issue_codes: content.validation.issue_codes,
    p_evidence_sources: projection.mappings,
  });

  if (error) {
    if (isSourceGenerationConflict(error.message)) {
      throw new ReportGenerationError(409, "report_source_changed");
    }
    throw new Error("report_persistence_failed");
  }
  const persisted = Array.isArray(data) ? data[0] : data;
  if (
    typeof persisted !== "object" ||
    persisted === null ||
    typeof Reflect.get(persisted, "id") !== "string"
  ) {
    throw new Error("report_persistence_failed");
  }
  return { id: Reflect.get(persisted, "id") as string };
}
