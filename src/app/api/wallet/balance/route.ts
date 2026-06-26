import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { getArcUsdcBalance } from "@/lib/arc-usdc";

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getProfileById(profileId);
    const address = profile.wallet_address as `0x${string}` | null;
    if (!address) {
      return NextResponse.json({ error: "No wallet address" }, { status: 400 });
    }

    const balance = await getArcUsdcBalance(address);
    return NextResponse.json({ balance, address });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Balance lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
