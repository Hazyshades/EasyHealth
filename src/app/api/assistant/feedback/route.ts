import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assistantFeedbackRequestSchema } from "@/lib/assistant/contract";
import { recordAssistantFeedback } from "@/lib/assistant/operations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = assistantFeedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid feedback" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await recordAssistantFeedback({
      profileId,
      requestId: parsed.data.request_id,
      rating: parsed.data.rating,
      category: parsed.data.category,
      comment: parsed.data.comment,
    });
    return NextResponse.json(
      { accepted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to record feedback" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
