import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { HEALTH_PROFILE_FRESHNESS_POLICY } from "@/lib/health-profile-freshness";
import { type HealthProfileAssessment, buildHealthProfileSnapshot } from "@/lib/health-profile-snapshot";
import { getLatestHolisticSynthesis } from "@/lib/holistic-synthesis";
import { suppressOutdatedHealthProfileAssessment } from "@/lib/health-systems";

function hasCanonicalReadinessContract(value: unknown): value is HealthProfileAssessment {
  if (
    !value ||
    typeof value !== "object" ||
    !("assessment_freshness" in value) ||
    !("systems" in value) ||
    !("freshness_policy_version" in value)
  ) {
    return false;
  }
  if (value.freshness_policy_version !== HEALTH_PROFILE_FRESHNESS_POLICY.version) {
    return false;
  }
  if (
    value.assessment_freshness !== "current" &&
    value.assessment_freshness !== "outdated"
  ) {
    return false;
  }
  return Array.isArray(value.systems) && value.systems.every((system) => {
    if (
      !system ||
      typeof system !== "object" ||
      !("score_readiness" in system) ||
      !system.score_readiness ||
      typeof system.score_readiness !== "object" ||
      !("required_groups" in system.score_readiness) ||
      !("reasons" in system.score_readiness)
    ) {
      return false;
    }
    return (
      Array.isArray(system.score_readiness.required_groups) &&
      Array.isArray(system.score_readiness.reasons)
    );
  });
}

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = createAdminClient();
  let labUnitSystem: "us" | "si" = "si";
  try {
    labUnitSystem = (await getProfileById(profileId)).lab_unit_system ?? "si";
  } catch {
    // A profile created before the unit migration safely uses SI.
  }

  const [{ data: version, error: versionError }, { data: job, error: jobError }, synthesis] = await Promise.all([
    supabase.from("health_profile_assessment_versions").select("id, payload, generated_at, input_hash, freshness_policy_version").eq("profile_id", profileId).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("assessment_recalculation_jobs").select("status, attempts, max_attempts, last_error_code, last_error_message, updated_at").eq("profile_id", profileId).eq("output_kind", "health_profile").maybeSingle(),
    getLatestHolisticSynthesis(profileId),
  ]);
  if (versionError) {
    return NextResponse.json(
      { error: versionError.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (jobError) {
    return NextResponse.json(
      { error: jobError.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  const persistedProfile = hasCanonicalReadinessContract(version?.payload)
    ? version.payload
    : null;
  // Rebuild only legacy or malformed payloads so the API never leaks a retired
  // readiness shape; ordinary reads remain persisted-snapshot reads.
  const fallback = persistedProfile
    ? null
    : await buildHealthProfileSnapshot({ profileId, labUnitSystem });
  const profile = persistedProfile ?? fallback?.profile;
  if (!profile) {
    return NextResponse.json(
      { error: "Unable to build Health Profile assessment" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  const persistedVersion = persistedProfile ? version : null;
  const assessmentIsOutdated =
    version != null && job != null && job.status !== "succeeded";
  const responseProfile = assessmentIsOutdated
    ? suppressOutdatedHealthProfileAssessment(profile)
    : profile;
  return NextResponse.json({
    ...responseProfile,
    holistic_synthesis: synthesis.synthesis,
    synthesis_stale: synthesis.stale,
    lab_unit_system: labUnitSystem,
    overall_assessment_dismissal_key: profileId,
    assessment: {
      version_id: persistedVersion?.id ?? null,
      input_hash: persistedVersion?.input_hash ?? fallback?.inputHash ?? null,
      generated_at: persistedVersion?.generated_at ?? fallback?.freshnessEvaluatedAt ?? null,
      freshness_policy_version:
        persistedVersion?.freshness_policy_version ??
        fallback?.freshnessPolicyVersion ??
        profile.freshness_policy_version ??
        null,
      freshness_evaluated_at:
        profile.freshness_evaluated_at ??
        fallback?.freshnessEvaluatedAt ??
        null,
      status: job?.status ?? (persistedProfile ? "succeeded" : "queued"),
      attempts: job?.attempts ?? 0,
      max_attempts: job?.max_attempts ?? 0,
      error_code: job?.last_error_code ?? null,
      error_message: job?.last_error_message ?? null,
      fallback: fallback !== null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}