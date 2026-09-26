import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndCompleteStorageIntent } from "@/lib/documents/upload-broker";

function isWorkerAuthorization(req: NextRequest): boolean {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    expected && req.headers.get("authorization") === `Bearer ${expected}`,
  );
}

export async function POST(req: NextRequest) {
  let body: { intent_id?: unknown; ticket?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.intent_id !== "string" || typeof body.ticket !== "string") {
    return NextResponse.json(
      { error: "Invalid storage capability" },
      { status: 400 },
    );
  }
  const workerRequest = isWorkerAuthorization(req);
  const sessionProfileId = workerRequest ? null : await getSessionProfileId();
  if (!workerRequest && !sessionProfileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!workerRequest) {
    const { data: intent, error: intentError } = await admin
      .from("document_storage_write_intents")
      .select("profile_id")
      .eq("id", body.intent_id)
      .maybeSingle();
    if (intentError || intent?.profile_id !== sessionProfileId) {
      return NextResponse.json(
        { error: "Storage object completion failed" },
        { status: 404 },
      );
    }
  }

  try {
    await verifyAndCompleteStorageIntent(admin, body.intent_id, body.ticket);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Storage object completion failed" },
      { status: 409 },
    );
  }
}
