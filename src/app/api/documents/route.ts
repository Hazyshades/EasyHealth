import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { listDocumentsForProfile } from "@/lib/documents/list";

export async function GET(req: NextRequest) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listDocumentsForProfile(profileId, {
    type: req.nextUrl.searchParams.get("type"),
    eligibleOnly: req.nextUrl.searchParams.get("eligible_for_report") === "1",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ documents: result.documents });
}
