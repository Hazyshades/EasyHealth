import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type {
  AssistantFeedbackCategory,
  AssistantFeedbackRating,
  AssistantMode,
  AssistantLimitationCode,
} from "@/lib/assistant/contract";

export type AssistantReservation = Readonly<{
  allowed: boolean;
  requestId: string;
  dailyRemaining: number;
  monthlyCostRemaining: number;
  resetAt: string;
  denialCode: string | null;
  reservedCostUsd: number;
}>;

function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object"
    ? (row as Record<string, unknown>)
    : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

export async function reserveAssistantRequest(input: {
  profileId: string;
  requestId: string;
  mode: AssistantMode;
}): Promise<AssistantReservation> {
  const { data, error } = await createAdminClient().rpc(
    "reserve_assistant_request",
    {
      p_profile_id: input.profileId,
      p_request_id: input.requestId,
      p_mode: input.mode,
      p_reserved_cost: env.ASSISTANT_RESERVED_COST_USD,
    },
  );
  if (error)
    throw new Error(`assistant_quota_reservation_failed:${error.message}`);
  const row = firstRow(data);
  if (!row) throw new Error("assistant_quota_reservation_empty");
  return {
    allowed: row.allowed === true,
    requestId: String(row.request_id ?? input.requestId),
    dailyRemaining: numberValue(row.daily_remaining),
    monthlyCostRemaining: numberValue(row.monthly_cost_remaining),
    resetAt: String(row.reset_at ?? new Date().toISOString()),
    denialCode: row.denial_code ? String(row.denial_code) : null,
    reservedCostUsd: env.ASSISTANT_RESERVED_COST_USD,
  };
}

export async function completeAssistantRequest(input: {
  requestId: string;
  status: "completed" | "failed";
  provider?: string | null;
  modelId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  latencyMs?: number | null;
  structuredSourceCount?: number;
  semanticSourceCount?: number;
  limitationCodes?: readonly AssistantLimitationCode[];
  errorCode?: string | null;
}): Promise<void> {
  const { error } = await createAdminClient().rpc(
    "complete_assistant_request",
    {
      p_request_id: input.requestId,
      p_status: input.status,
      p_provider: input.provider ?? null,
      p_model_id: input.modelId ?? null,
      p_input_tokens: input.inputTokens ?? null,
      p_output_tokens: input.outputTokens ?? null,
      p_estimated_cost_usd: input.estimatedCostUsd ?? null,
      p_latency_ms: input.latencyMs ?? null,
      p_structured_source_count: input.structuredSourceCount ?? 0,
      p_semantic_source_count: input.semanticSourceCount ?? 0,
      p_limitation_codes: [...(input.limitationCodes ?? [])],
      p_error_code: input.errorCode ?? null,
    },
  );
  if (error)
    throw new Error(`assistant_event_completion_failed:${error.message}`);
}

export type AssistantInvocationSummary = Readonly<{
  provider: string | null;
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
}>;

export async function summarizeAssistantInvocations(
  requestId: string,
): Promise<AssistantInvocationSummary> {
  const { data, error } = await createAdminClient()
    .from("ai_invocations")
    .select(
      "provider, model_id, input_tokens, output_tokens, latency_ms, estimated_cost_usd",
    )
    .eq("request_id", requestId)
    .eq("stage", "assistant");
  if (error)
    throw new Error(`assistant_invocation_summary_failed:${error.message}`);
  const rows = Array.isArray(data) ? data : [];
  const estimatedCosts = rows.flatMap((row) =>
    row.estimated_cost_usd == null ? [] : [numberValue(row.estimated_cost_usd)],
  );
  return {
    provider: rows.length > 0 ? String(rows[0].provider ?? "") || null : null,
    modelId: rows.length > 0 ? String(rows[0].model_id ?? "") || null : null,
    inputTokens:
      rows.length > 0
        ? rows.reduce((sum, row) => sum + numberValue(row.input_tokens), 0)
        : null,
    outputTokens:
      rows.length > 0
        ? rows.reduce((sum, row) => sum + numberValue(row.output_tokens), 0)
        : null,
    estimatedCostUsd:
      estimatedCosts.length > 0
        ? estimatedCosts.reduce((sum, value) => sum + value, 0)
        : null,
    latencyMs:
      rows.length > 0
        ? rows.reduce((sum, row) => sum + numberValue(row.latency_ms), 0)
        : null,
  };
}

export async function recordAssistantFeedback(input: {
  profileId: string;
  requestId: string;
  rating: AssistantFeedbackRating;
  category?: AssistantFeedbackCategory | null;
  comment?: string | null;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_assistant_feedback", {
    p_profile_id: input.profileId,
    p_request_id: input.requestId,
    p_rating: input.rating,
    p_category: input.category ?? null,
    p_comment: input.comment ?? null,
  });
  if (error) throw new Error(`assistant_feedback_failed:${error.message}`);
}
