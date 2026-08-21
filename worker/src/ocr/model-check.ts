import { supabase } from "../supabase.js";
import { workerEnv } from "../env.js";
import type { OcrErrorCode } from "./types.js";

export type MistralModelCheckErrorCode =
  | "ocr_provider_unavailable"
  | "ocr_timeout"
  | "ocr_input_rejected";

export type MistralModelCheckEvidence = {
  provider: "mistral";
  region: "eu" | "us";
  requestedModel: string;
  modelPresent: boolean;
  success: boolean;
  errorCode: MistralModelCheckErrorCode | null;
  latencyMs: number;
  workerInstanceId: string;
  adapterVersion: string;
  checkedAt: string;
};

export type MistralModelCheckRecorder = (
  evidence: MistralModelCheckEvidence,
) => Promise<void>;

export function toMistralModelCheckErrorCode(
  errorCode: OcrErrorCode,
): MistralModelCheckErrorCode {
  if (errorCode === "ocr_timeout") return "ocr_timeout";
  if (errorCode === "ocr_input_rejected") return "ocr_input_rejected";
  return "ocr_provider_unavailable";
}

export async function recordMistralModelCheck(
  evidence: MistralModelCheckEvidence,
): Promise<void> {
  const { error } = await supabase.from("ai_provider_model_checks").insert({
    provider: evidence.provider,
    region: evidence.region,
    requested_model: evidence.requestedModel,
    model_present: evidence.modelPresent,
    success: evidence.success,
    error_code: evidence.errorCode,
    latency_ms: evidence.latencyMs,
    worker_instance_id: evidence.workerInstanceId,
    adapter_version: evidence.adapterVersion,
    checked_at: evidence.checkedAt,
  });
  if (error) throw new Error("mistral_model_check_evidence_unavailable");
}

export function formatMistralModelCheckEvidence(
  evidence: MistralModelCheckEvidence,
): string {
  return JSON.stringify({
    event: "mistral_models_list_check",
    provider: evidence.provider,
    region: evidence.region,
    requested_model: evidence.requestedModel,
    model_present: evidence.modelPresent,
    success: evidence.success,
    error_code: evidence.errorCode,
    latency_ms: evidence.latencyMs,
    worker_instance_id: evidence.workerInstanceId,
    adapter_version: evidence.adapterVersion,
    checked_at_utc: evidence.checkedAt,
  });
}

export function createMistralModelCheckEvidence(input: {
  modelPresent: boolean;
  errorCode: MistralModelCheckErrorCode | null;
  startedAt: number;
  checkedAt?: string;
}): MistralModelCheckEvidence {
  return {
    provider: "mistral",
    region: workerEnv.mistralOcrRegion,
    requestedModel: workerEnv.mistralOcrModel,
    modelPresent: input.modelPresent,
    success: input.modelPresent && input.errorCode === null,
    errorCode: input.errorCode,
    latencyMs: Math.max(0, Date.now() - input.startedAt),
    workerInstanceId: workerEnv.instanceId,
    adapterVersion: workerEnv.mistralOcrAdapterVersion,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
  };
}
