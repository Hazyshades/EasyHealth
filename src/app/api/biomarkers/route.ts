import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { presentObservation } from "@/lib/biomarkers";
import {
  isCurrentDocumentObservation,
  projectActiveRegistryV2LaboratoryBinding,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "@/lib/documents/observation-read-boundaries";
import { projectLaboratoryOutcome } from "@/lib/documents/incomplete-laboratory-outcomes";
import { createAdminClient } from "@/lib/supabase/admin";

type LaboratoryMeasureSource = {
  record_status: "active" | "rejected" | "superseded" | null;
  lifecycle_reason_code?: string | null;
  superseded_at?: string | null;
  superseded_by_processing_attempt_id?: string | null;
  is_current: boolean | null;
};

type BiomarkerObservation = {
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
  observed_at: string;
  document_id: string | null;
  value_kind: string | null;
  value_text: string | null;
  ordinal: number | null;
  specimen: string | null;
  modifier: string | null;
  raw_name: string | null;
  raw_value_text: string | null;
  raw_unit: string | null;
  raw_reference_text: string | null;
  source_page: number | null;
  source_text: string | null;
  documents: { id: string; original_filename: string } | { id: string; original_filename: string }[] | null;
  normalization_revision:
    | RegistryV2NormalizationRevisionReadBoundary
    | RegistryV2NormalizationRevisionReadBoundary[]
    | null;
  source_extracted_biomarker: LaboratoryMeasureSource | LaboratoryMeasureSource[] | null;
};

function firstDocument(
  relation: BiomarkerObservation["documents"]
): { id: string; original_filename: string } | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const profile = await getProfileById(profileId);
  try {
    const unitSystem = profile.lab_unit_system ?? "si";
    const supabase = createAdminClient();
    const { data: observations, error: observationsError } = await supabase
      .from("observations")
      .select(
        "id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, raw_name, raw_value_text, raw_unit, raw_reference_text, source_page, source_text, ref_low, ref_high, observed_at, document_id, value_kind, value_text, ordinal, specimen, modifier, documents(id, original_filename), source_extracted_biomarker:document_extracted_biomarkers!observations_source_extracted_biomarker_fkey(record_status, lifecycle_reason_code, superseded_at, superseded_by_processing_attempt_id, is_current), normalization_revision:observation_normalization_revisions!observations_normalization_revision_same_source_fk(resolver_result, verification_status, measurement_definition_key, mapping_confidence, mapping_confidence_band, catalog_manifest_version, resolver_version, normalization_version, is_active, resolver_evidence, measurement_override)"
      )
      .eq("profile_id", profileId)
      .eq("observation_kind", "lab")
      .order("observed_at", { ascending: false });

    if (observationsError) {
      return NextResponse.json({ error: observationsError.message }, { status: 500 });
    }
    const presented = ((observations ?? []) as BiomarkerObservation[])
      .filter((observation) =>
        isCurrentDocumentObservation({
          observation_kind: observation.observation_kind,
          source_extracted_biomarker: observation.source_extracted_biomarker,
        }),
      )
      .map(
        ({ normalization_revision, documents, source_extracted_biomarker, ...row }) => {
      const laboratorySource = Array.isArray(source_extracted_biomarker)
        ? source_extracted_biomarker[0] ?? null
        : source_extracted_biomarker;
      const observation = { ...row, source_extracted_biomarker: laboratorySource };
      const outcome = projectLaboratoryOutcome({
        observation,
        relation: normalization_revision,
      });
      const binding = projectActiveRegistryV2LaboratoryBinding(
        observation,
        normalization_revision,
      );
      const { registryBindingReady, resolvedMeasurementBinding } = binding;
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
        registryBindingReady &&
        valueKind === "numeric" &&
        numericValue != null &&
        resolvedMeasurementBinding
      ) {
        display = presentObservation(
          {
            resolved_measurement_binding: resolvedMeasurementBinding,
            value: numericValue,
            unit: row.unit ?? "",
            ref_low: row.ref_low != null ? Number(row.ref_low) : null,
            ref_high: row.ref_high != null ? Number(row.ref_high) : null,
          },
          unitSystem
        );
      }

      return {
        ...row,
        documents: firstDocument(documents),
        observation_kind: "lab" as const,
        record_status: laboratorySource?.record_status ?? null,
        lifecycle_reason_code: laboratorySource?.lifecycle_reason_code ?? null,
        superseded_at: laboratorySource?.superseded_at ?? null,
        superseded_by_processing_attempt_id:
          laboratorySource?.superseded_by_processing_attempt_id ?? null,
        source_is_current: laboratorySource?.is_current ?? null,
        measurement_definition_key: outcome.measurementDefinitionKey,
        analyte_key: outcome.analyteKey,
        resolution_status: outcome.outcome,
        verification_status: outcome.verificationStatus,
        registry_binding_ready: outcome.registryBindingReady,
        resolution_details: outcome.resolutionDetails,
        trend_eligible: outcome.resolutionDetails.eligibility.trendEligible,
        conversion_eligible:
          outcome.resolutionDetails.eligibility.conversionEligible,
        assessment_eligible:
          outcome.resolutionDetails.eligibility.assessmentEligible,
        value: valueKind === "numeric" ? display.value : null,
        value_kind: valueKind,
        value_text:
          row.value_text ?? (numericValue != null ? String(numericValue) : null),
        ordinal: row.ordinal ?? null,
        specimen: row.specimen ?? "unspecified",
        modifier: row.modifier ?? "none",
        unit: display.unit,
        ref_low: display.ref_low,
        ref_high: display.ref_high,
        converted: display.converted,
        conversion_note: display.conversion_note,
        original_value: display.original_value,
        original_unit: display.original_unit,
        original_ref_low: display.original_ref_low,
        original_ref_high: display.original_ref_high,
      };
    });

    return NextResponse.json({
      authenticated: true,
      profile: {
        id: profile.id,
        lab_unit_system: unitSystem,
      },
      lab_unit_system: unitSystem,
      observations: presented,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
