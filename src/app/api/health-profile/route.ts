import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { getMeasurementDefinition, presentObservation } from "@/lib/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildHealthProfile, type HealthProfileSource } from "@/lib/health-systems";
import {
  buildDocumentStructuredContext,
  hashStructuredContext,
} from "@/lib/documents/structured-context";
import { isLaboratoryObservation } from "@/lib/documents/observation-read-boundaries";
import { getOrCreateHolisticSynthesis } from "@/lib/holistic-synthesis";

type LinkedRevision = {
  resolver_result: string | null;
  measurement_definition_key: string | null;
  is_active: boolean;
};

function activeRevision(
  relation: LinkedRevision | LinkedRevision[] | null | undefined
): LinkedRevision | null {
  const revisions = Array.isArray(relation)
    ? relation
    : relation
      ? [relation]
      : [];
  return revisions.find((revision) => revision.is_active) ?? null;
}

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  let labUnitSystem: "us" | "si" = "si";
  try {
    const userProfile = await getProfileById(profileId);
    labUnitSystem = userProfile.lab_unit_system ?? "si";
  } catch {
    // fall back to SI if profile column not yet migrated
  }

  const [{ data: observations, error: obsError }, { data: documents, error: docError }] =
    await Promise.all([
      supabase
        .from("observations")
        .select(
          "measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, observation_kind, value_kind, value_text, ordinal, specimen, modifier, normalization_revision:observation_normalization_revisions!observations_normalization_revision_fk(resolver_result, measurement_definition_key, is_active)"
        )
        .eq("profile_id", profileId)
        // EH-105: Health Profile remains a laboratory-only assessment boundary.
        // EH-106 owns typed instrumental presentation and consumer migration.
        .eq("observation_kind", "lab"),
      supabase
        .from("documents")
        .select("id, original_filename, observed_at, lab_name, document_type, document_summary, processing_status, status")
        .eq("profile_id", profileId)
        .order("observed_at", { ascending: false }),
    ]);

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }
  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  const processedDocs = (documents ?? []).filter(
    (doc) =>
      doc.status === "completed" ||
      doc.processing_status === "ready" ||
      doc.processing_status === "needs_review"
  );

  const sources: HealthProfileSource[] = processedDocs.map((doc) => ({
    id: doc.id,
    original_filename: doc.original_filename,
    observed_at: doc.observed_at,
    lab_name: doc.lab_name,
    document_type: doc.document_type,
  }));

  const completedDocumentIds = new Set(sources.map((source) => source.id));
  const scopedObservations = (observations ?? []).filter(
    (observation) =>
      isLaboratoryObservation(observation) &&
      (observation.document_id == null || completedDocumentIds.has(observation.document_id))
  );

  const profile = buildHealthProfile(
    scopedObservations.flatMap<Parameters<typeof buildHealthProfile>[0][number]>((o) => {
      const revision = activeRevision(
        o.normalization_revision as LinkedRevision | LinkedRevision[] | null
      );
      const measurementDefinitionKey = revision?.measurement_definition_key ?? null;
      if (
        revision?.is_active !== true ||
        revision.resolver_result !== "resolved" ||
        !measurementDefinitionKey
      ) {
        return [];
      }
      const definition = getMeasurementDefinition(measurementDefinitionKey);
      if (definition?.maturity !== "reviewed") return [];
      const key = definition?.assessmentBindings.find((binding) => binding.status === "reviewed" && binding.compatibility === "compatible")?.assessmentInputKey;
      if (!key) return [];
      const valueKind =
        o.value_kind === "qualitative" ||
        o.value_kind === "ordinal" ||
        o.value_kind === "text" ||
        o.value_kind === "numeric"
          ? o.value_kind
          : "numeric";
      const numericValue = o.value != null ? Number(o.value) : null;

      if (valueKind !== "numeric" || numericValue == null) {
        return [{
          biomarker_key: key,
          measurement_definition_key: measurementDefinitionKey,
          name: o.name,
          value: null,
          unit: o.unit ?? "",
          ref_low: o.ref_low != null ? Number(o.ref_low) : null,
          ref_high: o.ref_high != null ? Number(o.ref_high) : null,
          observed_at: o.observed_at,
          document_id: o.document_id,
          observation_kind: "lab",
          value_kind: valueKind,
          value_text: o.value_text ?? null,
          ordinal: o.ordinal != null ? Number(o.ordinal) : null,
          specimen: o.specimen ?? "unspecified",
          modifier: o.modifier ?? "none",
        }];
      }

      const display = presentObservation(
        {
          measurement_definition_key: measurementDefinitionKey,
          value: numericValue,
          unit: o.unit ?? "",
          ref_low: o.ref_low != null ? Number(o.ref_low) : null,
          ref_high: o.ref_high != null ? Number(o.ref_high) : null,
        },
        labUnitSystem
      );
      return [{
        biomarker_key: key,
        measurement_definition_key: measurementDefinitionKey,
        name: o.name,
        value: display.value,
        unit: display.unit,
        ref_low: display.ref_low,
        ref_high: display.ref_high,
        observed_at: o.observed_at,
        document_id: o.document_id,
        observation_kind: "lab",
        value_kind: "numeric" as const,
        value_text: o.value_text ?? String(display.value),
        ordinal: null,
        specimen: o.specimen ?? "unspecified",
        modifier: o.modifier ?? "none",
        converted: display.converted,
        conversion_note: display.conversion_note,
        original_value: display.original_value,
        original_unit: display.original_unit,
      }];
    }),
    sources
  );

  let holistic_synthesis = null;
  let synthesis_stale = false;

  try {
    const context = await buildDocumentStructuredContext(profileId);
    const currentHash = hashStructuredContext(context);

    const { data: cached } = await supabase
      .from("profile_health_synthesis")
      .select("input_hash")
      .eq("profile_id", profileId)
      .maybeSingle();

    synthesis_stale = Boolean(cached?.input_hash && cached.input_hash !== currentHash);
    holistic_synthesis = await getOrCreateHolisticSynthesis(profileId);
  } catch (error) {
    console.error("[health-profile] synthesis failed:", error);
  }

  const recordsUsedCount = Math.max(profile.records_used_count, holistic_synthesis?.source_document_ids.length ?? 0);

  return NextResponse.json({
    ...profile,
    records_used_count: recordsUsedCount,
    holistic_synthesis,
    synthesis_stale,
    lab_unit_system: labUnitSystem,
    overall_assessment_dismissal_key: profileId,
  });
}
