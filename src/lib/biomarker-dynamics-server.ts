import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileById } from "@/lib/auth/profile";
import {
  getMeasurementDefinition,
  isCensoredLabValueCell,
  presentObservation,
  type LabUnitSystem,
} from "@/lib/biomarkers";
import { normalizeComparisonUnit } from "@/lib/biomarker-comparison";
import {
  isCurrentDocumentObservation,
  REGISTRY_V2_NORMALIZATION_REVISION_SELECT,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "@/lib/documents/observation-read-boundaries";
import {
  projectLaboratoryOutcome,
  type LaboratoryOutcomeSummary,
} from "@/lib/documents/incomplete-laboratory-outcomes";
import {
  buildBiomarkerDynamicsReport,
  type AuthorizedBiomarkerComparison,
  type AuthorizedBiomarkerComparisonCandidate,
  type AuthorizedBiomarkerComparisonExclusion,
  type AuthorizedBiomarkerComparisonPoint,
  type AuthorizedBiomarkerComparisonSeries,
  type BiomarkerDynamicsIdentity,
  type BiomarkerDynamicsPeriod,
  type BiomarkerDynamicsScopeKind,
} from "@/lib/biomarker-dynamics";

export type BiomarkerDynamicsScope =
  | Readonly<{ kind: "profile_current" }>
  | Readonly<{
      kind: "report_immutable";
      documentIds: readonly string[];
    }>;

export type GetAuthorizedBiomarkerDynamicsOptions = Readonly<{
  profileId: string;
  period?: BiomarkerDynamicsPeriod | null;
  scope?: BiomarkerDynamicsScope;
  unitSystem?: LabUnitSystem;
}>;

export class BiomarkerDynamicsAuthorizationError extends Error {
  readonly code = "dynamics_scope_not_authorized";

  constructor(message = "The requested dynamics scope is not authorized") {
    super(message);
    this.name = "BiomarkerDynamicsAuthorizationError";
  }
}

type DynamicsDocument = {
  id: string;
  original_filename: string;
  lab_name?: string | null;
  archived_at: string | null;
};

type DynamicsLaboratorySource = {
  id: string;
  record_status: "active" | "rejected" | "superseded" | null;
  lifecycle_reason_code?: string | null;
  superseded_at?: string | null;
  superseded_by_processing_attempt_id?: string | null;
  is_current: boolean | null;
  is_published?: boolean | null;
};

export type DynamicsObservation = {
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
  value_kind: string | null;
  value_text: string | null;
  raw_reference_text: string | null;
  specimen: string | null;
  modifier: string | null;
  documents: DynamicsDocument | DynamicsDocument[] | null;
  source_extracted_biomarker:
    | DynamicsLaboratorySource
    | DynamicsLaboratorySource[]
    | null;
  normalization_revision:
    | RegistryV2NormalizationRevisionReadBoundary
    | RegistryV2NormalizationRevisionReadBoundary[]
    | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

function finiteNumber(
  value: number | string | null | undefined,
): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function eligibleDocument(document: {
  status: string | null;
  processing_status?: string | null;
  archived_at: string | null;
}): boolean {
  return (
    document.archived_at == null &&
    (document.status === "completed" ||
      document.processing_status === "ready" ||
      document.processing_status === "needs_review")
  );
}

async function resolveAuthorizedDocumentIds(
  profileId: string,
  scope: BiomarkerDynamicsScope,
): Promise<string[]> {
  const supabase = createAdminClient();
  const requestedIds =
    scope.kind === "report_immutable" ? [...new Set(scope.documentIds)] : null;

  let query = supabase
    .from("documents")
    .select("id, status, processing_status, archived_at")
    .eq("profile_id", profileId)
    .is("archived_at", null);
  if (requestedIds) query = query.in("id", requestedIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const eligibleIds = (data ?? [])
    .filter(eligibleDocument)
    .map((document) => document.id as string);

  if (scope.kind === "profile_current") {
    return eligibleIds.sort();
  }

  const reportDocumentIds = [...new Set(scope.documentIds)];
  if (
    reportDocumentIds.length === 0 ||
    reportDocumentIds.length !== eligibleIds.length ||
    reportDocumentIds.some((id) => !eligibleIds.includes(id))
  ) {
    throw new BiomarkerDynamicsAuthorizationError(
      "One or more report scope documents are not currently authorized",
    );
  }

  return reportDocumentIds.sort();
}

function exclusion(
  observation: DynamicsObservation,
  reason: AuthorizedBiomarkerComparisonExclusion["reason"],
  detail: string,
  identity: Partial<BiomarkerDynamicsIdentity> | null,
): AuthorizedBiomarkerComparisonExclusion {
  const document = firstRelation(observation.documents);
  return {
    observationId: observation.id,
    documentId: observation.document_id ?? document?.id ?? null,
    label: observation.name ?? null,
    reason,
    detail,
    identity,
    unit: observation.unit?.trim() || null,
  };
}

function identityFor(
  observation: DynamicsObservation,
  measurementDefinitionKey: string | null,
  analyteKey: string | null,
): BiomarkerDynamicsIdentity | null {
  if (!measurementDefinitionKey) return null;
  const definition = getMeasurementDefinition(measurementDefinitionKey);
  return {
    measurementDefinitionKey,
    analyteKey: analyteKey ?? definition?.analyteKey ?? null,
    specimen: observation.specimen ?? definition?.specimen ?? null,
    modifier: observation.modifier ?? "none",
    method: definition?.method ?? null,
    scale: definition?.scale ?? null,
  };
}

function unitExclusion(outcome: LaboratoryOutcomeSummary): boolean {
  const reason = outcome.resolutionDetails.eligibility.exclusions.trend;
  return typeof reason === "string" && reason.toLowerCase().includes("unit");
}

function buildPoint(
  observation: DynamicsObservation,
  identity: BiomarkerDynamicsIdentity,
  unitSystem: LabUnitSystem,
  binding: LaboratoryOutcomeSummary["resolvedMeasurementBinding"],
): AuthorizedBiomarkerComparisonPoint | null {
  const document = firstRelation(observation.documents);
  const documentId = observation.document_id ?? document?.id ?? null;
  const nativeValue = finiteNumber(observation.value);
  if (
    !documentId ||
    !document ||
    nativeValue === null ||
    !observation.observed_at
  )
    return null;

  const nativeUnit = observation.unit?.trim() || null;
  const nativeReferenceLow = finiteNumber(observation.ref_low);
  const nativeReferenceHigh = finiteNumber(observation.ref_high);
  const displayed = binding
    ? presentObservation(
        {
          resolved_measurement_binding: binding,
          value: nativeValue,
          unit: nativeUnit ?? "",
          ref_low: nativeReferenceLow,
          ref_high: nativeReferenceHigh,
        },
        unitSystem,
      )
    : {
        value: nativeValue,
        unit: nativeUnit ?? "",
        ref_low: nativeReferenceLow,
        ref_high: nativeReferenceHigh,
        converted: false,
        conversion_note: null,
        original_value: nativeValue,
        original_unit: nativeUnit ?? "",
        original_ref_low: nativeReferenceLow,
        original_ref_high: nativeReferenceHigh,
      };

  if (!Number.isFinite(displayed.value) || !displayed.unit.trim()) return null;
  const sourceFilename =
    document.original_filename?.trim() || "Source document";
  return {
    observationId: observation.id,
    documentId,
    observedAt: observation.observed_at,
    nativeValue,
    nativeUnit,
    nativeReferenceLow,
    nativeReferenceHigh,
    displayValue: displayed.value,
    displayUnit: displayed.unit.trim() || null,
    displayReferenceLow: displayed.ref_low,
    displayReferenceHigh: displayed.ref_high,
    conversion: {
      applied: displayed.converted,
      note: displayed.conversion_note,
      nativeUnit,
      displayUnit: displayed.unit.trim() || null,
    },
    identity,
    source: {
      documentId,
      filename: sourceFilename,
      laboratory: document.lab_name?.trim() || null,
      href: `/app/documents/${documentId}`,
    },
  };
}

export function buildAuthorizedBiomarkerComparison(
  options: Readonly<{
    observations: readonly DynamicsObservation[];
    scopeKind: BiomarkerDynamicsScopeKind;
    scopeDocumentIds: readonly string[];
    unitSystem: LabUnitSystem;
    generatedAt: string;
  }>,
): AuthorizedBiomarkerComparison {
  const excluded: AuthorizedBiomarkerComparisonExclusion[] = [];
  const candidates: AuthorizedBiomarkerComparisonCandidate[] = [];
  const groups = new Map<
    string,
    {
      id: string;
      label: string;
      identity: BiomarkerDynamicsIdentity;
      points: AuthorizedBiomarkerComparisonPoint[];
    }
  >();
  const authorizedDocumentIds = new Set(options.scopeDocumentIds);

  for (const observation of options.observations) {
    const document = firstRelation(observation.documents);
    const observationDocumentId = observation.document_id ?? null;
    const relatedDocumentId = document?.id ?? null;
    if (
      (observationDocumentId !== null &&
        !authorizedDocumentIds.has(observationDocumentId)) ||
      (relatedDocumentId !== null &&
        !authorizedDocumentIds.has(relatedDocumentId)) ||
      (observationDocumentId !== null &&
        relatedDocumentId !== null &&
        observationDocumentId !== relatedDocumentId)
    ) {
      throw new BiomarkerDynamicsAuthorizationError(
        "An observation falls outside the authorized dynamics scope",
      );
    }

    const outcome = projectLaboratoryOutcome({
      observation: {
        ...observation,
        source_extracted_biomarker: firstRelation(
          observation.source_extracted_biomarker,
        ),
      },
      relation: observation.normalization_revision,
    });
    const measurementDefinitionKey = outcome.measurementDefinitionKey;
    const analyteKey = outcome.analyteKey ?? observation.analyte_key;
    const identity = identityFor(
      observation,
      measurementDefinitionKey,
      analyteKey,
    );
    const label =
      observation.name?.trim() || measurementDefinitionKey || "Measurement";
    const valueKind = observation.value_kind ?? "numeric";
    const candidateBase = {
      observationId: observation.id,
      documentId: observation.document_id ?? document?.id ?? null,
      label,
      valueKind,
      identity,
    };

    if (!observation.observed_at) {
      const item = exclusion(
        observation,
        "undated",
        "The observation has no observed date.",
        identity,
      );
      excluded.push(item);
      candidates.push({ ...candidateBase, point: null });
      continue;
    }

    const nativeValue = finiteNumber(observation.value);
    if (
      valueKind !== "numeric" ||
      nativeValue === null ||
      isCensoredLabValueCell(observation.value_text) ||
      isCensoredLabValueCell(observation.value)
    ) {
      const item = exclusion(
        observation,
        "non_numeric",
        "The observation is qualitative, censored, or not a finite numeric value.",
        identity,
      );
      excluded.push(item);
      candidates.push({ ...candidateBase, point: null });
      continue;
    }

    const sourceIsCurrent = isCurrentDocumentObservation({
      observation_kind: observation.observation_kind,
      source_extracted_biomarker: firstRelation(
        observation.source_extracted_biomarker,
      ),
    });
    if (
      !sourceIsCurrent ||
      !outcome.resolutionDetails.eligibility.trendEligible ||
      !measurementDefinitionKey ||
      !identity
    ) {
      const item = exclusion(
        observation,
        unitExclusion(outcome) ? "unsupported_unit" : "ineligible",
        sourceIsCurrent
          ? "The observation is not eligible for numeric dynamics under its persisted Registry decision."
          : "The observation source is not current and cannot enter the authorized dynamics snapshot.",
        identity,
      );
      excluded.push(item);
      candidates.push({ ...candidateBase, point: null });
      continue;
    }

    const conversionEligible =
      outcome.resolutionDetails.eligibility.conversionEligible;
    const point = buildPoint(
      observation,
      identity,
      options.unitSystem,
      outcome.resolvedMeasurementBinding,
    );
    if (!point) {
      const item = exclusion(
        observation,
        "unsupported_unit",
        "The observation has no safe display unit for this dynamics series.",
        identity,
      );
      excluded.push(item);
      candidates.push({ ...candidateBase, point: null });
      continue;
    }

    candidates.push({ ...candidateBase, point });
    if (!conversionEligible) {
      excluded.push(
        exclusion(
          observation,
          "unsupported_unit",
          "The point is retained in its native unit, but no reviewed conversion can combine it with another unit.",
          identity,
        ),
      );
    }

    const displayUnitKey =
      normalizeComparisonUnit(point.displayUnit) || "__unit_not_recorded__";
    const nativeUnitKey = !conversionEligible
      ? normalizeComparisonUnit(point.nativeUnit) ||
        "__native_unit_not_recorded__"
      : "__safe_conversion__";
    const groupKey = [
      identity.measurementDefinitionKey,
      identity.specimen ?? "__specimen_not_recorded__",
      identity.modifier ?? "__modifier_not_recorded__",
      identity.method ?? "__method_not_recorded__",
      identity.scale ?? "__scale_not_recorded__",
      displayUnitKey,
      nativeUnitKey,
    ].join("::");
    const group = groups.get(groupKey) ?? {
      id: groupKey,
      label,
      identity,
      points: [],
    };
    group.points.push(point);
    groups.set(groupKey, group);
  }

  const series: AuthorizedBiomarkerComparisonSeries[] = [...groups.values()]
    .map((group) => {
      const points = [...group.points].sort((left, right) => {
        const byObservedAt = left.observedAt.localeCompare(right.observedAt);
        return byObservedAt !== 0
          ? byObservedAt
          : left.observationId.localeCompare(right.observationId);
      });
      return {
        id: group.id,
        label: group.label,
        measurementDefinitionKey: group.identity.measurementDefinitionKey,
        analyteKey: group.identity.analyteKey,
        displayUnit: points[0]?.displayUnit ?? null,
        nativeUnit: points[0]?.nativeUnit ?? null,
        normalized: points.some((point) => point.conversion.applied),
        identity: group.identity,
        points,
      };
    })
    .sort(
      (left, right) =>
        left.label.localeCompare(right.label) ||
        left.id.localeCompare(right.id),
    );

  return {
    scopeKind: options.scopeKind,
    scopeDocumentIds: [...options.scopeDocumentIds],
    candidates,
    series,
    excluded,
    incompatibilities: [],
    generatedAt: options.generatedAt,
  };
}

async function loadDynamicsObservations(
  profileId: string,
  documentIds: readonly string[],
): Promise<DynamicsObservation[]> {
  if (documentIds.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("observations")
    .select(
      `id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, value_kind, value_text, raw_reference_text, specimen, modifier, documents(id, original_filename, lab_name, archived_at), source_extracted_biomarker:document_extracted_biomarkers!observations_source_extracted_biomarker_fkey(id, record_status, lifecycle_reason_code, superseded_at, superseded_by_processing_attempt_id, is_current, is_published), normalization_revision:observation_normalization_revisions!observations_normalization_revision_same_source_fk(${REGISTRY_V2_NORMALIZATION_REVISION_SELECT})`,
    )
    .eq("profile_id", profileId)
    .in("document_id", [...documentIds])
    .eq("observation_kind", "lab")
    .order("observed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DynamicsObservation[];
}

export async function getAuthorizedBiomarkerDynamics(
  options: GetAuthorizedBiomarkerDynamicsOptions,
) {
  const profile = await getProfileById(options.profileId);
  const scope = options.scope ?? { kind: "profile_current" as const };
  const documentIds = await resolveAuthorizedDocumentIds(
    options.profileId,
    scope,
  );
  const observations = await loadDynamicsObservations(
    options.profileId,
    documentIds,
  );
  const comparison = buildAuthorizedBiomarkerComparison({
    observations,
    scopeKind: scope.kind,
    scopeDocumentIds: documentIds,
    unitSystem: options.unitSystem ?? profile.lab_unit_system,
    generatedAt: new Date().toISOString(),
  });
  return buildBiomarkerDynamicsReport(comparison, options.period ?? null);
}
