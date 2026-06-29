import { NextResponse } from "next/server";
import { upsertProfileByWallet } from "@/lib/auth/profile";
import { setSessionProfileId } from "@/lib/auth/session";
import { z } from "zod";

const bodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  circleWalletId: z.string().optional(),
  displayName: z.string().trim().min(1).max(120).nullish(),
  email: z.string().email().max(320).nullish(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const profileId = await upsertProfileByWallet(body.walletAddress, {
      circleWalletId: body.circleWalletId,
      displayName: body.displayName,
      email: body.email,
    });
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
