import { NextResponse } from "next/server";
import { upsertProfileByWallet } from "@/lib/auth/profile";
import { setSessionProfileId } from "@/lib/auth/session";
import { z } from "zod";

const bodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  circleWalletId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const profileId = await upsertProfileByWallet(body.walletAddress, body.circleWalletId);
    await setSessionProfileId(profileId);
    return NextResponse.json({ profileId, walletAddress: body.walletAddress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const { clearSession } = await import("@/lib/auth/session");
  await clearSession();
  return NextResponse.json({ ok: true });
}
