import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildHealthProfile, type HealthProfileSource } from "@/lib/health-systems";
import { projectHealthProfileLaboratoryInput } from "@/lib/health-profile-input";
import { isLaboratoryObservation } from "@/lib/documents/observation-read-boundaries";
import {
  buildDocumentStructuredContext,
  hashStructuredContext,
} from "@/lib/documents/structured-context";
import { getOrCreateHolisticSynthesis } from "@/lib/holistic-synthesis";

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
          "measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, observation_kind, value_kind, value_text, ordinal, specimen, modifier, normalization_revision:observation_normalization_revisions!observations_normalization_revision_same_source_fk(resolver_result, verification_status, measurement_definition_key, mapping_confidence, mapping_confidence_band, catalog_manifest_version, resolver_version, normalization_version, is_active, resolver_evidence)"
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
    scopedObservations.flatMap((observation) => {
      const input = projectHealthProfileLaboratoryInput({
        observation,
        relation: observation.normalization_revision,
        labUnitSystem,
      });
      return input ? [input] : [];
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
