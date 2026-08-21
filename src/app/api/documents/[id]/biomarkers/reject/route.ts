import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner } from "@/lib/documents/access";
import {
  buildLifecycleRequestHash,
  ObservationLifecycleError,
  rejectExtractedBiomarker,
} from "@/lib/documents/observation-lifecycle";
import { getActiveNormalizationRevision } from "@/lib/documents/normalization-revisions";
import {
  isRejectionReasonCode,
  type RejectionReasonCode,
} from "@/lib/documents/observation-verification-workflow";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

type RejectBody = Readonly<{
  extractedBiomarkerId?: unknown;
  reasonCode?: unknown;
  expectedSourceSnapshot?: unknown;
  expectedActiveRevisionId?: unknown;
  confirm?: unknown;
}>;

function confirmationPayload(source: {
  id: string;
  created_at: string;
}, activeRevisionId: string | null) {
  return {
    extractedBiomarkerId: source.id,
    expectedSourceSnapshot: source.created_at,
    expectedActiveRevisionId: activeRevisionId,
  };
}

export async function POST(req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: documentId } = await context.params;
  const { error: ownerError } = await assertDocumentOwner(profileId, documentId);
  if (ownerError) return ownerError;

  const body = (await req.json().catch(() => null)) as RejectBody | null;
  const extractedBiomarkerId =
    typeof body?.extractedBiomarkerId === "string" ? body.extractedBiomarkerId : null;
  const reasonCode =
    typeof body?.reasonCode === "string" && isRejectionReasonCode(body.reasonCode)
      ? body.reasonCode
      : null;
  if (!extractedBiomarkerId || !reasonCode) {
    return NextResponse.json(
      { error: "Choose a valid reason before rejecting this result.", code: "invalid_lifecycle_reason_code" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: source, error: sourceError } = await supabase
    .from("document_extracted_biomarkers")
    .select("id, created_at, profile_id, document_id, record_status, is_current, is_published")
    .eq("id", extractedBiomarkerId)
    .eq("document_id", documentId)
    .eq("profile_id", profileId)
    .eq("is_published", true)
    .maybeSingle();
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
  if (!source) return NextResponse.json({ error: "Extracted biomarker not found" }, { status: 404 });
  const sourceRecord = source as unknown as {
    id: string;
    created_at: string;
  };

  const activeRevision = await getActiveNormalizationRevision(extractedBiomarkerId);
  const rawExpectedActiveRevisionId = body?.expectedActiveRevisionId;
  const expectedSourceSnapshot =
    typeof body?.expectedSourceSnapshot === "string" ? body.expectedSourceSnapshot : null;
  const expectedActiveRevisionId =
    rawExpectedActiveRevisionId === null || typeof rawExpectedActiveRevisionId === "string"
      ? rawExpectedActiveRevisionId ?? null
      : undefined;
  const confirmation = confirmationPayload(sourceRecord, activeRevision?.id ?? null);

  if (expectedSourceSnapshot === null || expectedActiveRevisionId === undefined) {
    return NextResponse.json(
      {
        error: "Reload this result to receive the current rejection confirmation.",
        code: "confirmation_payload_required",
        confirmation,
      },
      { status: 400 },
    );
  }
  if (body?.confirm !== true) {
    return NextResponse.json(
      {
        error: "Confirm that this extracted result should be rejected.",
        code: "confirmation_required",
        confirmation,
      },
      { status: 400 },
    );
  }
  if (
    expectedSourceSnapshot !== sourceRecord.created_at ||
    expectedActiveRevisionId !== (activeRevision?.id ?? null)
  ) {
    return NextResponse.json(
      {
        error: "This result changed while you were reviewing it. Reload and confirm again.",
        code:
          expectedSourceSnapshot !== sourceRecord.created_at
            ? "stale_source_snapshot"
            : "stale_revision_snapshot",
        confirmation,
      },
      { status: 409 },
    );
  }

  try {
    const requestHash = buildLifecycleRequestHash({
      profileId,
      extractedBiomarkerId,
      expectedSourceSnapshot,
      expectedActiveRevisionId,
      reasonCode: reasonCode as RejectionReasonCode,
    });
    const transition = await rejectExtractedBiomarker({
      profileId,
      extractedBiomarkerId,
      expectedSourceSnapshot,
      expectedActiveRevisionId,
      reasonCode: reasonCode as RejectionReasonCode,
      requestHash,
    });
    return NextResponse.json({ transition, confirmation });
  } catch (error) {
    if (error instanceof ObservationLifecycleError) {
      return NextResponse.json(
        { error: error.message, code: error.code ?? "lifecycle_transition_failed", confirmation },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lifecycle transition failed" },
      { status: 500 },
    );
  }
}
