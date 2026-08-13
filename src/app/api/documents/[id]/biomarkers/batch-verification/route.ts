import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner, noStoreJson } from "@/lib/documents/access";
import {
  BatchVerificationError,
  executeBatchVerification,
  type BatchVerificationSnapshot,
} from "@/lib/documents/batch-verification-service";

type RouteContext = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseSnapshots(value: unknown): BatchVerificationSnapshot[] | null {
  if (!Array.isArray(value)) return null;
  const snapshots: BatchVerificationSnapshot[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (
      typeof row.extractedBiomarkerId !== "string" ||
      (row.sourceSnapshot !== null && typeof row.sourceSnapshot !== "string") ||
      (row.activeRevisionId !== null && typeof row.activeRevisionId !== "string")
    ) return null;
    snapshots.push({
      extractedBiomarkerId: row.extractedBiomarkerId,
      sourceSnapshot: (row.sourceSnapshot as string | null | undefined) ?? null,
      activeRevisionId: (row.activeRevisionId as string | null | undefined) ?? null,
    });
  }
  return snapshots;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: documentId } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, documentId);
  if (error) return error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const operationId = typeof body?.operationId === "string" ? body.operationId : null;
  const snapshots = parseSnapshots(body?.snapshots);
  if (!operationId || !UUID.test(operationId) || !snapshots) {
    return NextResponse.json({ error: "Invalid batch verification request" }, { status: 400 });
  }

  try {
    return noStoreJson(
      await executeBatchVerification({
        profileId,
        documentId,
        observedAt: doc!.observed_at ?? new Date().toISOString().slice(0, 10),
        operationId,
        snapshots,
      }),
    );
  } catch (caught) {
    if (caught instanceof BatchVerificationError) {
      return NextResponse.json({ error: caught.message }, { status: caught.status });
    }
    throw caught;
  }
}
