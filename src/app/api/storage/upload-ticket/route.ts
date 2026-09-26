import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueStorageUploadTicket } from "@/lib/documents/upload-broker";

function isWorkerAuthorization(req: NextRequest): boolean {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    expected && req.headers.get("authorization") === `Bearer ${expected}`,
  );
}

export async function POST(req: NextRequest) {
  let body: {
    intent_id?: unknown;
    profile_id?: unknown;
    processing_attempt_id?: unknown;
    lease_token?: unknown;
    write_generation?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.intent_id !== "string") {
    return NextResponse.json(
      { error: "Invalid storage intent" },
      { status: 400 },
    );
  }

  const workerRequest = isWorkerAuthorization(req);
  const sessionProfileId = workerRequest ? null : await getSessionProfileId();
  const profileId = workerRequest ? body.profile_id : sessionProfileId;
  if (typeof profileId !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processingAttemptId = workerRequest
    ? typeof body.processing_attempt_id === "string"
      ? body.processing_attempt_id
      : null
    : null;
  const leaseToken = workerRequest
    ? typeof body.lease_token === "string"
      ? body.lease_token
      : null
    : null;
  const writeGeneration =
    typeof body.write_generation === "number" &&
    Number.isSafeInteger(body.write_generation) &&
    body.write_generation >= 0
      ? body.write_generation
      : 0;

  try {
    const result = await issueStorageUploadTicket(createAdminClient(), {
      intentId: body.intent_id,
      profileId,
      processingAttemptId,
      leaseToken,
      writeGeneration,
    });
    return NextResponse.json({
      intentId: result.intent.intent_id,
      bucket: result.intent.bucket,
      objectPath: result.intent.object_path,
      contentType: result.intent.content_type,
      writeGeneration: result.intent.write_generation,
      deadlineAt: result.intent.deadline_at,
      ticket: result.ticket,
      ticketExpiresAt: result.expiresAt,
    });
  } catch {
    return NextResponse.json(
      { error: "Storage upload ticket unavailable" },
      { status: 409 },
    );
  }
}
