import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner, noStoreJson } from "@/lib/documents/access";
import {
  BatchVerificationError,
  reverseBatchVerification,
} from "@/lib/documents/batch-verification-service";

type RouteContext = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: documentId } = await context.params;
  const { error } = await assertDocumentOwner(profileId, documentId);
  if (error) return error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const operationId = typeof body?.operationId === "string" ? body.operationId : null;
  const reason = typeof body?.reason === "string" ? body.reason : null;
  if (!operationId || !UUID.test(operationId) || !reason) {
    return NextResponse.json({ error: "Invalid batch reversal request" }, { status: 400 });
  }

  try {
    return noStoreJson(
      await reverseBatchVerification({ profileId, documentId, operationId, reason }),
    );
  } catch (caught) {
    if (caught instanceof BatchVerificationError) {
      return NextResponse.json({ error: caught.message }, { status: caught.status });
    }
    throw caught;
  }
}
