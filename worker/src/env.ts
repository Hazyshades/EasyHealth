import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../.env") });
config({ path: resolve(process.cwd(), ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function optionalBool(name: string, defaultValue: boolean): boolean {
  const raw = optional(name);
  if (raw === undefined) return defaultValue;
  if (raw === "1" || raw.toLowerCase() === "true") return true;
  if (raw === "0" || raw.toLowerCase() === "false") return false;
  throw new Error(`Invalid boolean env: ${name}`);
}

function optionalPositiveInt(name: string, defaultValue: number): number {
  const raw = optional(name);
  if (raw === undefined) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer env: ${name}`);
  }
  return parsed;
}


function mistralRegion(): "eu" | "us" {
  const value = optional("MISTRAL_OCR_REGION") ?? "eu";
  if (value !== "eu" && value !== "us") {
    throw new Error("MISTRAL_OCR_REGION must be eu or us");
  }
  return value;
}

function mistralFailureMode(enabled: boolean): "fail" | "legacy_vision" {
  const value = optional("MISTRAL_OCR_FAILURE_MODE") ?? "fail";
  if (value !== "fail" && value !== "legacy_vision") {
    throw new Error("MISTRAL_OCR_FAILURE_MODE must be fail or legacy_vision");
  }
  if (enabled && process.env.NODE_ENV === "production" && value !== "fail") {
    throw new Error("MISTRAL_OCR_FAILURE_MODE=legacy_vision is not allowed in production");
  }
  return value;
}

const mistralOcrEnabled = optionalBool("MISTRAL_OCR_ENABLED", false);
const mistralOcrRegion = mistralRegion();
const mistralOcrFailureMode = mistralFailureMode(mistralOcrEnabled);
const mistralOcrModel = optional("MISTRAL_OCR_MODEL") ?? "mistral-ocr-latest";
if (mistralOcrEnabled && !optional("MISTRAL_API_KEY")) {
  throw new Error("Missing env: MISTRAL_API_KEY (required when MISTRAL_OCR_ENABLED=true)");
}

export const workerEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiApiKey: required("OPENAI_API_KEY"),
  deepseekApiKey: optional("DEEPSEEK_API_KEY"),
  deepseekBaseUrl: optional("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
  deepseekModel: optional("DEEPSEEK_MODEL") ?? "deepseek-chat",
  owlAlphaApiKey: optional("OWL_ALPHA_API_KEY"),
  openrouterBaseUrl: optional("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
  owlAlphaModel: optional("OWL_ALPHA_MODEL") ?? "tencent/hy3:free",
  nebiusApiKey: optional("NEBIUS_API_KEY"),
  nebiusBaseUrl: optional("NEBIUS_BASE_URL") ?? "https://api.tokenfactory.nebius.com/v1",
  nebiusRegion: optional("NEBIUS_REGION") ?? "eu-north1",
  nebiusFastFlavorSuffix: optional("NEBIUS_FAST_FLAVOR_SUFFIX") ?? "-fast",
  mistralApiKey: optional("MISTRAL_API_KEY"),
  mistralOcrEnabled,
  mistralOcrModel,
  mistralOcrRegion,
  mistralOcrTimeoutMs: optionalPositiveInt("MISTRAL_OCR_TIMEOUT_MS", 45_000),
  mistralOcrMaxBytes: optionalPositiveInt("MISTRAL_OCR_MAX_BYTES", 25 * 1024 * 1024),
  mistralOcrMaxPages: optionalPositiveInt("MISTRAL_OCR_MAX_PAGES", 100),
  mistralOcrFailureMode,
  mistralOcrAdapterVersion: "eh163-1",
  mistralOcrPageCostUsd: 0.004,
  allowCrossProviderFallback: optionalBool("ALLOW_CROSS_PROVIDER_FALLBACK", false),
  instanceId: optional("WORKER_INSTANCE_ID") ?? "document-worker",
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? "5000"),
  staleJobMaxAgeMs: optionalPositiveInt(
    "STALE_JOB_MAX_AGE_MS",
    10 * 60_000,
  ),
};
