/**
 * EH-149: Biomarker Dynamics Report — server-side authorization adapter.
 *
 * getAuthorizedBiomarkerDynamics resolves the authenticated profile,
 * builds an AuthorizedBiomarkerComparison snapshot, and calls the pure
 * projection. Neither this adapter nor the HTTP route accepts client
 * observations or a client-generated DTO.
 */

import { presentObservation, getMeasurementDefinition } from "@/lib/biomarkers";
import {
  isCurrentDocumentObservation,
  REGISTRY_V2_NORMALIZATION_REVISION_SELECT,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "@/lib/documents/observation-read-boundaries";
import { projectLaboratoryOutcome } from "@/lib/documents/incomplete-laboratory-outcomes";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileById } from "@/lib/auth/profile";
import {
  buildAuthorizedBiomarkerComparison,
  buildBiomarkerDynamicsReport,
  buildFrozenBiomarkerDynamicsExtension,
  validatePeriod,
  type BiomarkerDynamicsPeriod,
  type BiomarkerDynamicsReport,
  type DynamicsPresentedObservation,
  type FrozenBiomarkerDynamicsExtension,
} from "./biomarker-dynamics";

export { buildAuthorizedBiomarkerComparison } from "./biomarker-dynamics";

export type DynamicsScope = "profile_current" | "report_immutable";

export interface GetAuthorizedBiomarkerDynamicsInput {
  profileId: string;
  period: { start: string | null; end: string | null } | null;
  scope: DynamicsScope;
  /** Required when scope is report_immutable. */
  reportScopeDocumentIds?: string[];
}

type LaboratoryMeasureSource = {
  id: string;
  record_status: "active" | "rejected" | "superseded" | null;
  lifecycle_reason_code?: string | null;
  superseded_at?: string | null;
  superseded_by_processing_attempt_id?: string | null;
  is_current: boolean | null;
  is_published?: boolean | null;
};

type RawObservation = {
  id: string;
  observation_kind: "lab" | "instrumental";
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  name: string;
  value: number | string | null;
  unit: string | null;
  ref_low: number | string | null;
  ref_high: number | string | null;
  observed_at: string | null;
  document_id: string | null;
  source_extracted_biomarker_id: string | null;
  value_kind: string | null;
  value_text: string | null;
  ordinal: number | null;
  specimen: string | null;
  modifier: string | null;
  documents:
    | {
        id: string;
        original_filename: string;
        lab_name?: string | null;
        archived_at: string | null;
        status?: string | null;
        processing_status?: string | null;
      }
    | {
        id: string;
        original_filename: string;
        lab_name?: string | null;
        archived_at: string | null;
        status?: string | null;
        processing_status?: string | null;
      }[]
    | null;
  normalization_revision:
    | RegistryV2NormalizationRevisionReadBoundary
    | RegistryV2NormalizationRevisionReadBoundary[]
    | null;
  source_extracted_biomarker:
    | LaboratoryMeasureSource
    | LaboratoryMeasureSource[]
    | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

function isEligibleDocument(doc: {
  archived_at: string | null;
  status?: string | null;
  processing_status?: string | null;
} | null): boolean {
  if (!doc || doc.archived_at != null) return false;
  if (doc.status == null && doc.processing_status == null) return true;
  return (
    doc.status === "completed" ||
    doc.processing_status === "ready" ||
    doc.processing_status === "needs_review"
  );
}

async function loadPresentedObservations(
  profileId: string,
  documentIds: string[],
): Promise<DynamicsPresentedObservation[]> {
  if (documentIds.length === 0) return [];

  const profile = await getProfileById(profileId);
  const unitSystem = profile.lab_unit_system ?? "si";
  const supabase = createAdminClient();

  const { data: observations, error } = await supabase
    .from("observations")
    .select(
      `id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, source_extracted_biomarker_id, value_kind, value_text, ordinal, specimen, modifier, documents(id, original_filename, lab_name, archived_at, status, processing_status), source_extracted_biomarker:document_extracted_biomarkers!observations_source_extracted_biomarker_fkey(id, record_status, lifecycle_reason_code, superseded_at, superseded_by_processing_attempt_id, is_current, is_published), normalization_revision:observation_normalization_revisions!observations_normalization_revision_same_source_fk(${REGISTRY_V2_NORMALIZATION_REVISION_SELECT})`,
    )
    .eq("profile_id", profileId)
    .in("document_id", documentIds)
    .eq("observation_kind", "lab")
    .order("observed_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to query observations: ${error.message}`);
  }

  return ((observations ?? []) as RawObservation[]).flatMap((row) => {
    const laboratorySource = firstRelation(row.source_extracted_biomarker);
    if (
      !isCurrentDocumentObservation({
        observation_kind: row.observation_kind,
        source_extracted_biomarker: laboratorySource,
      })
    ) {
      return [];
    }

    const document = firstRelation(row.documents);
    if (!isEligibleDocument(document)) return [];

    const outcome = projectLaboratoryOutcome({
      observation: {
        ...row,
        source_extracted_biomarker: laboratorySource,
      },
      relation: row.normalization_revision,
    });

    const valueKind = row.value_kind ?? "numeric";
    const numericValue = row.value != null ? Number(row.value) : null;
    let display = {
      value: numericValue as number,
      unit: row.unit ?? "",
      ref_low: row.ref_low != null ? Number(row.ref_low) : null,
      ref_high: row.ref_high != null ? Number(row.ref_high) : null,
      converted: false,
      conversion_note: null as string | null,
      original_value: numericValue as number,
      original_unit: row.unit ?? "",
      original_ref_low: row.ref_low != null ? Number(row.ref_low) : null,
      original_ref_high: row.ref_high != null ? Number(row.ref_high) : null,
    };

    if (
      outcome.registryBindingReady &&
      valueKind === "numeric" &&
      numericValue != null &&
      outcome.resolvedMeasurementBinding
    ) {
      display = presentObservation(
        {
          resolved_measurement_binding: outcome.resolvedMeasurementBinding,
          value: numericValue,
          unit: row.unit ?? "",
          ref_low: row.ref_low != null ? Number(row.ref_low) : null,
          ref_high: row.ref_high != null ? Number(row.ref_high) : null,
        },
        unitSystem,
      );
    }

    const definition = outcome.measurementDefinitionKey
      ? getMeasurementDefinition(outcome.measurementDefinitionKey)
      : null;

    return [
      {
        id: row.id,
        name: row.name,
        measurement_definition_key: outcome.measurementDefinitionKey,
        value: valueKind === "numeric" ? display.value : null,
        unit: display.unit,
        ref_low: display.ref_low,
        ref_high: display.ref_high,
        observed_at: row.observed_at,
        document_id: row.document_id,
        documents: document
          ? {
              id: document.id,
              original_filename: document.original_filename,
              lab_name: document.lab_name,
            }
          : null,
        value_kind: valueKind,
        value_text: row.value_text,
        converted: display.converted,
        original_value: display.original_value,
        original_unit: display.original_unit,
        original_ref_low: display.original_ref_low,
        original_ref_high: display.original_ref_high,
        trend_eligible: outcome.resolutionDetails.eligibility.trendEligible,
        conversion_eligible:
          outcome.resolutionDetails.eligibility.conversionEligible,
        registry_binding_ready: outcome.registryBindingReady,
        specimen: row.specimen ?? definition?.specimen ?? "unspecified",
        modifier: row.modifier ?? "none",
        method: definition?.method ?? null,
        scale: definition?.scale ?? null,
      },
    ];
  });
}

async function getEligibleDocumentIdsForProfile(
  profileId: string,
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data: observations } = await supabase
    .from("observations")
    .select("document_id")
    .eq("profile_id", profileId)
    .not("document_id", "is", null);

  const candidateIds = [
    ...new Set(
      (observations ?? [])
        .map((o) => o.document_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  if (candidateIds.length === 0) return [];

  const { data: documents } = await supabase
    .from("documents")
    .select("id, status, processing_status, archived_at")
    .eq("profile_id", profileId)
    .is("archived_at", null)
    .in("id", candidateIds);

  return (documents ?? [])
    .filter(
      (doc) =>
        doc.status === "completed" ||
        doc.processing_status === "ready" ||
        doc.processing_status === "needs_review",
    )
    .map((d) => d.id);
}

export async function getAuthorizedBiomarkerDynamics(
  input: GetAuthorizedBiomarkerDynamicsInput,
): Promise<BiomarkerDynamicsReport> {
  const periodValidation = validatePeriod(
    input.period?.start ?? null,
    input.period?.end ?? null,
  );
  if (!periodValidation.valid) {
    throw new Error(periodValidation.error);
  }

  let authorizedDocumentIds: string[];
  if (input.scope === "report_immutable") {
    if (
      !input.reportScopeDocumentIds ||
      input.reportScopeDocumentIds.length === 0
    ) {
      throw new Error(
        "report_immutable scope requires exact report_scope_document_ids",
      );
    }
    const eligible = new Set(
      await getEligibleDocumentIdsForProfile(input.profileId),
    );
    authorizedDocumentIds = input.reportScopeDocumentIds.filter((id) =>
      eligible.has(id),
    );
  } else {
    authorizedDocumentIds = await getEligibleDocumentIdsForProfile(
      input.profileId,
    );
  }

  const presented = await loadPresentedObservations(
    input.profileId,
    authorizedDocumentIds,
  );
  const comparison = buildAuthorizedBiomarkerComparison(
    presented,
    input.scope,
    authorizedDocumentIds,
  );
  return buildBiomarkerDynamicsReport(comparison, input.period);
}

/**
 * EH-148 handoff: build the frozen extension for a report-immutable period.
 * Omitted period means no extension (caller should skip).
 */
export async function getFrozenBiomarkerDynamicsForReport(input: {
  profileId: string;
  period: BiomarkerDynamicsPeriod;
  reportScopeDocumentIds: readonly string[];
}): Promise<FrozenBiomarkerDynamicsExtension> {
  const report = await getAuthorizedBiomarkerDynamics({
    profileId: input.profileId,
    period: input.period,
    scope: "report_immutable",
    reportScopeDocumentIds: [...input.reportScopeDocumentIds],
  });
  return buildFrozenBiomarkerDynamicsExtension(
    report,
    input.period,
    input.reportScopeDocumentIds,
  );
}
