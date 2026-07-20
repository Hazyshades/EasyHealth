import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { getMeasurementDefinition, presentObservation } from "@/lib/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";

type LinkedRevision = {
  resolver_result: string | null;
  verification_status: string | null;
  measurement_definition_key: string | null;
  is_active: boolean;
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
  documents: { id: string; original_filename: string } | { id: string; original_filename: string }[] | null;
  normalization_revision: LinkedRevision | LinkedRevision[] | null;
};

function activeRevision(
  relation: BiomarkerObservation["normalization_revision"]
): LinkedRevision | null {
  const revisions = Array.isArray(relation)
    ? relation
    : relation
      ? [relation]
      : [];
  return revisions.find((revision) => revision.is_active) ?? null;
}

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

  try {
    const profile = await getProfileById(profileId);
    const unitSystem = profile.lab_unit_system ?? "si";
    const supabase = createAdminClient();
    const { data: observations, error: observationsError } = await supabase
      .from("observations")
      .select(
        "id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, value_kind, value_text, ordinal, specimen, modifier, documents(id, original_filename), normalization_revision:observation_normalization_revisions!observations_normalization_revision_fk(resolver_result, verification_status, measurement_definition_key, is_active)"
      )
      .eq("profile_id", profileId)
      .eq("observation_kind", "lab")
      .order("observed_at", { ascending: false });

    if (observationsError) {
      return NextResponse.json({ error: observationsError.message }, { status: 500 });
    }

    const presented = ((observations ?? []) as BiomarkerObservation[]).map(
      ({ normalization_revision, documents, ...row }) => {
      const revision = activeRevision(normalization_revision);
      const definitionKey =
        revision?.measurement_definition_key ?? row.measurement_definition_key ?? null;
      const resolutionStatus =
        revision?.resolver_result ?? row.resolution_status ?? null;
      const definition = definitionKey
        ? getMeasurementDefinition(definitionKey)
        : undefined;
      const registryBindingReady =
        revision?.is_active === true &&
        resolutionStatus === "resolved" &&
        definition?.maturity === "reviewed";
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
        definitionKey
      ) {
        display = presentObservation(
          {
            measurement_definition_key: definitionKey,
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
        measurement_definition_key: definitionKey,
        analyte_key: row.analyte_key ?? null,
        resolution_status: resolutionStatus,
        verification_status: revision?.verification_status ?? null,
        registry_binding_ready: registryBindingReady,
        value: valueKind === "numeric" ? display.value : null,
        value_kind: valueKind,
        value_text: row.value_text ?? (numericValue != null ? String(numericValue) : null),
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
