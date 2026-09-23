import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import {
  BiomarkerDynamicsPeriodError,
  parseBiomarkerDynamicsPeriod,
} from "@/lib/biomarker-dynamics";
import { getAuthorizedBiomarkerDynamics } from "@/lib/biomarker-dynamics-server";

export async function GET(request: NextRequest) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const hasStart = request.nextUrl.searchParams.has("start");
  const hasEnd = request.nextUrl.searchParams.has("end");
  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");
  if (hasStart !== hasEnd) {
    return NextResponse.json(
      { error: "Both dynamics period dates are required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let period = null;
  try {
    period = parseBiomarkerDynamicsPeriod(
      hasStart && hasEnd ? { start: start ?? "", end: end ?? "" } : null,
    );
  } catch (error) {
    if (error instanceof BiomarkerDynamicsPeriodError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }

  try {
    const report = await getAuthorizedBiomarkerDynamics({
      profileId,
      period,
      scope: { kind: "profile_current" },
    });
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[biomarker-dynamics] GET failed:", error);
    return NextResponse.json(
      { error: "Biomarker dynamics are unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
