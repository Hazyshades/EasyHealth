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
  return raw === "1" || raw.toLowerCase() === "true";
}

function optionalPositiveInt(name: string, defaultValue: number): number {
  const parsed = Number(optional(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
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
  allowCrossProviderFallback: optionalBool("ALLOW_CROSS_PROVIDER_FALLBACK", false),
  instanceId: optional("WORKER_INSTANCE_ID") ?? "document-worker",
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? "5000"),
  staleJobMaxAgeMs: optionalPositiveInt(
    "STALE_JOB_MAX_AGE_MS",
    10 * 60_000,
  ),
};
