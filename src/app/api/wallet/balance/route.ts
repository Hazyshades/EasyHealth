import { NextResponse } from "next/server";

/** Frozen: human app no longer uses wallet balances. */
export async function GET() {
  return NextResponse.json(
    { error: "Wallet balance is unavailable. Circle wallet auth is frozen." },
    { status: 410 }
  );
}
