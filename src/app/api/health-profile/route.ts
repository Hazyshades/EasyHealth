import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildHealthProfileSnapshot } from "@/lib/health-profile-snapshot";
import { getLatestHolisticSynthesis } from "@/lib/holistic-synthesis";
import {
  hasCanonicalReadinessContract,
  projectHealthProfileAssessmentRead,
} from "@/lib/health-profile-assessment-read";


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

  const [{ data: version, error: versionError }, { data: job, error: jobError }, synthesis] =
    await Promise.all([
      supabase
        .from("health_profile_assessment_versions")
        .select("id, payload, generated_at, input_hash, freshness_policy_version")
        .eq("profile_id", profileId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("assessment_recalculation_jobs")
        .select("status, attempts, max_attempts, last_error_code, last_error_message, updated_at")
        .eq("profile_id", profileId)
        .eq("output_kind", "health_profile")
        .maybeSingle(),
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

  const fallback = hasCanonicalReadinessContract(version?.payload)
    ? null
    : await buildHealthProfileSnapshot({ profileId, labUnitSystem });
  const { profile, assessment } = projectHealthProfileAssessmentRead({
    version,
    job,
    fallback,
  });
  if (!profile) {
    return NextResponse.json(
      { error: "Unable to build Health Profile assessment" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ...profile,
      holistic_synthesis: synthesis.synthesis,
      synthesis_stale: synthesis.stale,
      lab_unit_system: labUnitSystem,
      overall_assessment_dismissal_key: profileId,
      assessment,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
