import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner } from "@/lib/documents/access";
import {
  assertReviewModeEscalationAllowed,
  assertReviewModeSelectionAllowed,
  effectiveReviewMode,
  ReviewModePolicyError,
  type ReviewMode,
} from "@/lib/documents/review-mode-policy";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

type ReviewModeRequest = {
  mode?: unknown;
  confirm?: unknown;
};

function parseReviewModeRequest(body: ReviewModeRequest): {
  mode: ReviewMode;
  confirm: boolean;
} | null {
  if (body.mode !== "easy" && body.mode !== "pro") return null;
  return { mode: body.mode, confirm: body.confirm === true };
}

export async function PATCH(req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error: ownerError } = await assertDocumentOwner(profileId, id);
  if (ownerError) return ownerError;

  const body = (await req.json().catch(() => null)) as ReviewModeRequest | null;
  const request = body ? parseReviewModeRequest(body) : null;
  if (!request) {
    return NextResponse.json(
      { error: "Choose Easy or Pro mode.", code: "invalid_review_mode" },
      { status: 400 },
    );
  }

  try {
    const currentMode = effectiveReviewMode(doc!);
    if (!currentMode) {
      throw new ReviewModePolicyError(
        "Review modes apply only to laboratory Documents.",
        409,
        "review_mode_not_applicable",
      );
    }

    if (request.mode === currentMode) {
      return NextResponse.json({
        reviewMode: currentMode,
        reviewModeLockedAt: doc!.review_mode_locked_at,
        canSelectMode: doc!.review_mode_locked_at == null,
        canEscalateToPro:
          currentMode === "easy" && doc!.review_mode_locked_at != null,
      });
    }

    const supabase = createAdminClient();
    const isEscalation =
      currentMode === "easy" &&
      request.mode === "pro" &&
      doc!.review_mode_locked_at != null;

    if (isEscalation) {
      assertReviewModeEscalationAllowed(doc!);
      if (!request.confirm) {
        return NextResponse.json(
          {
            error:
              "Confirm that this review will continue in Pro mode. Existing rows and history stay unchanged.",
            code: "review_mode_confirmation_required",
          },
          { status: 400 },
        );
      }
      const { data, error } = await supabase
        .from("documents")
        .update({ review_mode: "pro" })
        .eq("id", id)
        .eq("profile_id", profileId)
        .eq("review_mode", "easy")
        .not("review_mode_locked_at", "is", null)
        .select("review_mode, review_mode_locked_at")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        return NextResponse.json(
          {
            error: "The review mode changed. Reload the Document.",
            code: "review_mode_conflict",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({
        reviewMode: "pro",
        reviewModeLockedAt: data.review_mode_locked_at,
        canSelectMode: false,
        canEscalateToPro: false,
      });
    }

    assertReviewModeSelectionAllowed(doc!);
    const { data, error } = await supabase
      .from("documents")
      .update({ review_mode: request.mode })
      .eq("id", id)
      .eq("profile_id", profileId)
      .eq("review_mode", currentMode)
      .is("review_mode_locked_at", null)
      .select("review_mode, review_mode_locked_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        {
          error: "The review mode changed. Reload the Document.",
          code: "review_mode_conflict",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      reviewMode: request.mode,
      reviewModeLockedAt: data.review_mode_locked_at,
      canSelectMode: true,
      canEscalateToPro: false,
    });
  } catch (error) {
    if (error instanceof ReviewModePolicyError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    throw error;
  }
}
