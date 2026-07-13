import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiInvocationRow } from "@/lib/ai/types";

export async function logAiInvocation(
  supabase: SupabaseClient,
  row: AiInvocationRow
): Promise<void> {
  const { error } = await supabase.from("ai_invocations").insert({
    profile_id: row.profile_id,
    document_id: row.document_id,
    stage: row.stage,
    provider: row.provider,
    model_id: row.model_id,
    latency_ms: row.latency_ms,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    success: row.success,
    error_code: row.error_code,
    provider_switch: row.provider_switch,
  });

  if (error) {
    console.error("[ai_invocations] insert failed:", error.message);
  }
}
