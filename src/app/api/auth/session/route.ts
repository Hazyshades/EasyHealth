import { NextResponse } from "next/server";
import { clearSession, getSessionProfileId } from "@/lib/auth/session";

/** Session is established via Supabase Auth (OAuth / magic link). This route only supports sign-out. */
export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ profileId });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
