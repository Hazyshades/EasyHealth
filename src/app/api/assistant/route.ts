import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { assistantAccessFromProfile } from "@/lib/assistant/access";
import {
  answerAssistantRequest,
  AssistantServiceError,
  parseAssistantRequest,
} from "@/lib/assistant/service";
import { classifyAssistantRequest } from "@/lib/assistant/safety";
import {
  completeAssistantRequest,
  reserveAssistantRequest,
  summarizeAssistantInvocations,
} from "@/lib/assistant/operations";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

function errorCodeFor(error: unknown): string {
  if (error instanceof AssistantServiceError) {
    if (error.code === "provider_unavailable") return "assistant_provider_unavailable";
    if (error.code === "invalid_request") return "assistant_invalid_response";
  }
  return "assistant_provider_unavailable";
}

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }
  try {
    const profile = await getProfileById(profileId);
    const access = assistantAccessFromProfile(profile);
    return NextResponse.json(
      {
        enabled: access.allowed,
        reason: access.reason,
        limitation_code: access.limitationCode,
      },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to read assistant access" },
      { status: 500, headers: noStore },
    );
  }
}

export async function POST(request: Request) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request" }, { status: 400, headers: noStore });
  }

  try {
    const requestData = parseAssistantRequest(body);
    const profile = await getProfileById(profileId);
    const access = assistantAccessFromProfile(profile);
    if (!access.allowed) {
      return NextResponse.json(
        { error: "Assistant access is not enabled", code: access.limitationCode },
        { status: 403, headers: noStore },
      );
    }

    const classification = classifyAssistantRequest(requestData);
    const requestId = crypto.randomUUID();
    const reservation = await reserveAssistantRequest({
      profileId,
      requestId,
      mode: classification.mode,
    });
    if (!reservation.allowed) {
      return NextResponse.json(
        {
          error: "Assistant request limit reached",
          code: reservation.denialCode ?? "assistant_quota_daily_exceeded",
          reset_at: reservation.resetAt,
          daily_remaining: reservation.dailyRemaining,
          monthly_cost_remaining: reservation.monthlyCostRemaining,
        },
        { status: 429, headers: noStore },
      );
    }

    const started = Date.now();
    try {
      const response = await answerAssistantRequest({
        profileId,
        requestId,
        request: requestData,
      });
      const summary = await summarizeAssistantInvocations(requestId);
      await completeAssistantRequest({
        requestId,
        status: "completed",
        provider: summary.provider,
        modelId: summary.modelId,
        inputTokens: summary.inputTokens,
        outputTokens: summary.outputTokens,
        latencyMs: Math.max(summary.latencyMs ?? 0, Date.now() - started),
        structuredSourceCount: response.coverage.structured_sources,
        semanticSourceCount: response.coverage.semantic_sources,
        limitationCodes: response.limitations,
      });
      return NextResponse.json(response, { headers: noStore });
    } catch (error) {
      try {
        const summary = await summarizeAssistantInvocations(requestId);
        await completeAssistantRequest({
          requestId,
          status: "failed",
          provider: summary.provider,
          modelId: summary.modelId,
          inputTokens: summary.inputTokens,
          outputTokens: summary.outputTokens,
          latencyMs: Math.max(summary.latencyMs ?? 0, Date.now() - started),
          errorCode: errorCodeFor(error),
        });
      } catch {
        console.error("[assistant] telemetry completion failed");
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AssistantServiceError) {
      const status =
        error.code === "invalid_request"
          ? 400
          : error.code === "provider_unavailable"
            ? 503
            : 500;
      return NextResponse.json(
        {
          error:
            error.code === "provider_unavailable"
              ? "Assistant is temporarily unavailable"
              : "Unable to answer assistant request",
        },
        { status, headers: noStore },
      );
    }
    if (error instanceof Error && error.message.startsWith("assistant_quota_")) {
      return NextResponse.json(
        { error: "Assistant quota is temporarily unavailable" },
        { status: 503, headers: noStore },
      );
    }
    return NextResponse.json(
      { error: "Unable to answer assistant request" },
      { status: 500, headers: noStore },
    );
  }
}
