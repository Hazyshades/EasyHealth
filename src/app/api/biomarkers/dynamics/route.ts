import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { getAuthorizedBiomarkerDynamics } from "@/lib/biomarker-dynamics-server";
import { validatePeriod } from "@/lib/biomarker-dynamics";

export const maxDuration = 30;

export async function GET(req: Request) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const periodValidation = validatePeriod(start, end);
  if (!periodValidation.valid) {
    return NextResponse.json(
      { error: periodValidation.error },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const profile = await getProfileById(profileId);
    const report = await getAuthorizedBiomarkerDynamics({
      profileId,
      period: { start, end },
      scope: "profile_current",
    });

    return NextResponse.json(
      {
        ...report,
        labUnitSystem: profile.lab_unit_system ?? "si",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to build dynamics report: ${message}` },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
