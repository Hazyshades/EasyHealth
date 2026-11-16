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
  const parsed = raw === undefined ? defaultValue : Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer env: ${name}`);
  }
  return parsed;
}

function optionalRangedInt(
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const value = optionalPositiveInt(name, defaultValue);
  if (value < minimum || value > maximum) {
    throw new Error(`Invalid ranged integer env: ${name}`);
  }
  return value;
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
    throw new Error(
      "MISTRAL_OCR_FAILURE_MODE=legacy_vision is not allowed in production",
    );
  }
  return value;
}

const mistralOcrEnabled = optionalBool("MISTRAL_OCR_ENABLED", false);
const mistralOcrRegion = mistralRegion();
const mistralOcrFailureMode = mistralFailureMode(mistralOcrEnabled);
const mistralOcrModel = optional("MISTRAL_OCR_MODEL") ?? "mistral-ocr-latest";
if (mistralOcrEnabled && !optional("MISTRAL_API_KEY")) {
  throw new Error(
    "Missing env: MISTRAL_API_KEY (required when MISTRAL_OCR_ENABLED=true)",
  );
}

const eh170ClinicWorkspaceEnabled = optionalBool(
  "EH170_CLINIC_WORKSPACE_ENABLED",
  false,
);
const eh170DictaphoneEnabled = optionalBool("EH170_DICTAPHONE_ENABLED", false);
const eh170TranscriptionDpaApproved = optionalBool(
  "EH170_TRANSCRIPTION_DPA_APPROVED",
  false,
);
const eh170TranscriptionRegionApproved = optionalBool(
  "EH170_TRANSCRIPTION_REGION_APPROVED",
  false,
);
const eh170RecordingRetentionDays = optionalPositiveInt(
  "EH170_RECORDING_RETENTION_DAYS",
  0,
);
const eh170TranscriptRetentionDays = optionalPositiveInt(
  "EH170_TRANSCRIPT_RETENTION_DAYS",
  0,
);
const eh170NoteRetentionDays = optionalPositiveInt(
  "EH170_NOTE_RETENTION_DAYS",
  0,
);
const eh170RetentionDeleteActor = optional("EH170_RETENTION_DELETE_ACTOR");
const eh170TranscriptionPolicyApproved =
  eh170TranscriptionDpaApproved &&
  eh170TranscriptionRegionApproved &&
  eh170RecordingRetentionDays > 0 &&
  eh170TranscriptRetentionDays > 0 &&
  eh170NoteRetentionDays > 0 &&
  Boolean(eh170RetentionDeleteActor);

function eh170CohortAllows(profileId: string): boolean {
  const configured = optional("EH170_ROLLOUT_PROFILE_IDS");
  if (!configured) return process.env.NODE_ENV !== "production";
  return configured
    .split(",")
    .map((value) => value.trim())
    .includes(profileId);
}

function eh170TranscriptionLaunchAllowed(): boolean {
  return (
    eh170ClinicWorkspaceEnabled &&
    eh170DictaphoneEnabled &&
    eh170TranscriptionPolicyApproved &&
    isUuid(eh170RetentionDeleteActor)
  );
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function eh170RetentionLaunchAllowed(): boolean {
  return eh170TranscriptionPolicyApproved && isUuid(eh170RetentionDeleteActor);
}

export const workerEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiApiKey: required("OPENAI_API_KEY"),
  openaiEmbeddingModel:
    optional("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small",
  eh170ClinicWorkspaceEnabled,
  eh170DictaphoneEnabled,
  eh170TranscriptionPolicyApproved,
  eh170TranscriptionModel:
    optional("EH170_TRANSCRIPTION_MODEL") ?? "gpt-4o-mini-transcribe",
  eh170TranscriptionProvider:
    optional("EH170_TRANSCRIPTION_PROVIDER") ?? "openai",
  eh170RetentionLaunchAllowed,
  eh170TranscriptionLaunchAllowed,
  eh170CohortAllows,
  eh170RecordingRetentionDays,
  eh170TranscriptRetentionDays,
  eh170NoteRetentionDays,
  eh170RetentionDeleteActor,
  owlAlphaApiKey: optional("OWL_ALPHA_API_KEY"),
  openrouterBaseUrl:
    optional("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
  owlAlphaModel: optional("OWL_ALPHA_MODEL") ?? "tencent/hy3:free",
  nebiusApiKey: optional("NEBIUS_API_KEY"),
  nebiusBaseUrl:
    optional("NEBIUS_BASE_URL") ?? "https://api.tokenfactory.nebius.com/v1",
  nebiusRegion: optional("NEBIUS_REGION") ?? "eu-north1",
  nebiusFastFlavorSuffix: optional("NEBIUS_FAST_FLAVOR_SUFFIX") ?? "-fast",
  mistralApiKey: optional("MISTRAL_API_KEY"),
  mistralOcrEnabled,
  mistralOcrModel,
  mistralOcrRegion,
  mistralOcrTimeoutMs: optionalPositiveInt("MISTRAL_OCR_TIMEOUT_MS", 45_000),
  mistralOcrMaxBytes: optionalPositiveInt(
    "MISTRAL_OCR_MAX_BYTES",
    25 * 1024 * 1024,
  ),
  mistralOcrMaxPages: optionalPositiveInt("MISTRAL_OCR_MAX_PAGES", 100),
  mistralOcrFailureMode,
  mistralOcrAdapterVersion: "eh163-1",
  mistralOcrPageCostUsd: 0.004,
  allowCrossProviderFallback: optionalBool(
    "ALLOW_CROSS_PROVIDER_FALLBACK",
    false,
  ),
  instanceId: optional("WORKER_INSTANCE_ID") ?? "document-worker",
  documentUploadBrokerUrl:
    optional("DOCUMENT_UPLOAD_BROKER_URL") ??
    optional("APP_URL") ??
    "http://localhost:3000",
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? "5000"),
  staleJobMaxAgeMs: optionalPositiveInt("STALE_JOB_MAX_AGE_MS", 10 * 60_000),
  shareAccessEventRetentionDays: optionalRangedInt(
    "SHARE_ACCESS_EVENT_RETENTION_DAYS",
    30,
    1,
    90,
  ),
  shareAccessEventCleanupIntervalMs: optionalRangedInt(
    "SHARE_ACCESS_EVENT_CLEANUP_INTERVAL_MS",
    3_600_000,
    1_000,
    86_400_000,
  ),
  shareAccessEventCleanupRetryIntervalMs: optionalRangedInt(
    "SHARE_ACCESS_EVENT_CLEANUP_RETRY_INTERVAL_MS",
    60_000,
    1_000,
    86_400_000,
  ),
  shareRateLimitCleanupIntervalMs: optionalRangedInt(
    "SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS",
    900_000,
    1_000,
    86_400_000,
  ),
  shareRateLimitCleanupRetryIntervalMs: optionalRangedInt(
    "SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS",
    60_000,
    1_000,
    86_400_000,
  ),
  sharePinProofTtlSeconds: optionalRangedInt(
    "SHARE_PIN_PROOF_TTL_SECONDS",
    900,
    60,
    3_600,
  ),
};
