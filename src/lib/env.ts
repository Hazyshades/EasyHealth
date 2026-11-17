import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    GUEST_MODE_ENABLED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
    GUEST_LEGAL_APPROVED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
    GUEST_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
    GUEST_CREATION_LIMIT: z.coerce.number().int().positive().default(5),
    GUEST_CREATION_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
    GUEST_UPLOAD_COUNT_PER_DAY: z.coerce.number().int().positive().default(10),
    GUEST_UPLOAD_BYTES_PER_DAY: z.coerce.number().int().positive().default(100 * 1024 * 1024),
    GUEST_PROCESSING_COUNT_PER_DAY: z.coerce.number().int().positive().default(10),
    GUEST_RATE_LIMIT_PEPPER: z.string().min(16).optional(),
    GUEST_ABUSE_CHALLENGE_ENABLED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
    GUEST_ABUSE_CHALLENGE_REQUIRED: z
      .enum(["true", "false", "1", "0"])
      .default("true")
      .transform((value) => value === "true" || value === "1"),
    EH120_AUTOMATIC_VERIFICATION_RELEASE_DIGEST: z.string().min(1).optional(),
    EH170_CLINIC_WORKSPACE_ENABLED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
    EH170_DICTAPHONE_ENABLED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
    EH170_ROLLOUT_PROFILE_IDS: z.string().default(""),
    EH170_TRANSCRIPTION_DPA_APPROVED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
    EH170_TRANSCRIPTION_REGION_APPROVED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
    EH170_RECORDING_RETENTION_DAYS: z.coerce.number().int().nonnegative().default(0),
    EH170_TRANSCRIPT_RETENTION_DAYS: z.coerce.number().int().nonnegative().default(0),
    EH170_NOTE_RETENTION_DAYS: z.coerce.number().int().nonnegative().default(0),
    EH170_RETENTION_DELETE_ACTOR: z.string().min(1).optional(),
    EH170_TRANSCRIPTION_PROVIDER: z.enum(["openai"]).default("openai"),
    EH170_TRANSCRIPTION_MODEL: z.string().min(1).default("gpt-4o-mini-transcribe"),
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
    ASSISTANT_RESERVED_COST_USD: z.coerce
      .number()
      .positive()
      .max(100)
      .default(0.1),
    DEEPSEEK_API_KEY: z.string().min(1).optional(),
    DEEPSEEK_BASE_URL: z.string().url().optional(),
    DEEPSEEK_MODEL: z.string().min(1).optional(),
    OPENROUTER_BASE_URL: z.string().url().optional(),
    OWL_ALPHA_API_KEY: z.string().min(1).optional(),
    OWL_ALPHA_MODEL: z.string().min(1).optional(),
    NEBIUS_API_KEY: z.string().min(1).optional(),
    NEBIUS_BASE_URL: z
      .string()
      .url()
      .default("https://api.tokenfactory.nebius.com/v1"),
    NEBIUS_REGION: z.string().min(1).default("eu-north1"),
    NEBIUS_FAST_FLAVOR_SUFFIX: z.string().default("-fast"),
    ALLOW_CROSS_PROVIDER_FALLBACK: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((v) => v === "true" || v === "1"),
    NEBIUS_FAST_CLASSIFY_MODEL: z.string().min(1).default("Qwen/Qwen3-32B"),
    NEBIUS_FAST_EXTRACT_TEXT_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/Llama-3.3-70B-Instruct"),
    NEBIUS_FAST_EXTRACT_VISION_MODEL: z
      .string()
      .min(1)
      .default("Qwen/Qwen2-VL-7B-Instruct"),
    NEBIUS_FAST_SUMMARIZE_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/Llama-3.3-70B-Instruct"),
    NEBIUS_FAST_REPORT_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/Llama-3.3-70B-Instruct"),
    NEBIUS_FAST_SYNTHESIS_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/Llama-3.3-70B-Instruct"),
    NEBIUS_FAST_ASSISTANT_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/Llama-3.3-70B-Instruct"),
    NEBIUS_QUALITY_CLASSIFY_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/Llama-3.3-70B-Instruct"),
    NEBIUS_QUALITY_EXTRACT_TEXT_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/Llama-3.3-70B-Instruct"),
    NEBIUS_QUALITY_EXTRACT_VISION_MODEL: z
      .string()
      .min(1)
      .default("Qwen/Qwen2-VL-72B-Instruct"),
    NEBIUS_QUALITY_SUMMARIZE_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/Llama-3.3-70B-Instruct"),
    NEBIUS_QUALITY_REPORT_MODEL: z
      .string()
      .min(1)
      .default("deepseek-ai/DeepSeek-V3.2"),
    NEBIUS_QUALITY_SYNTHESIS_MODEL: z
      .string()
      .min(1)
      .default("deepseek-ai/DeepSeek-V3.2"),
    NEBIUS_QUALITY_ASSISTANT_MODEL: z
      .string()
      .min(1)
      .default("deepseek-ai/DeepSeek-V3.2"),
    URL: z.string().url().default("http://localhost:3000"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_GUEST_MODE_ENABLED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
    NEXT_PUBLIC_GUEST_LEGAL_APPROVED: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GUEST_MODE_ENABLED: process.env.GUEST_MODE_ENABLED,
    GUEST_LEGAL_APPROVED: process.env.GUEST_LEGAL_APPROVED,
    GUEST_RETENTION_DAYS: process.env.GUEST_RETENTION_DAYS,
    GUEST_CREATION_LIMIT: process.env.GUEST_CREATION_LIMIT,
    GUEST_CREATION_WINDOW_SECONDS: process.env.GUEST_CREATION_WINDOW_SECONDS,
    GUEST_UPLOAD_COUNT_PER_DAY: process.env.GUEST_UPLOAD_COUNT_PER_DAY,
    GUEST_UPLOAD_BYTES_PER_DAY: process.env.GUEST_UPLOAD_BYTES_PER_DAY,
    GUEST_PROCESSING_COUNT_PER_DAY: process.env.GUEST_PROCESSING_COUNT_PER_DAY,
    GUEST_RATE_LIMIT_PEPPER: process.env.GUEST_RATE_LIMIT_PEPPER,
    GUEST_ABUSE_CHALLENGE_ENABLED: process.env.GUEST_ABUSE_CHALLENGE_ENABLED,
    GUEST_ABUSE_CHALLENGE_REQUIRED: process.env.GUEST_ABUSE_CHALLENGE_REQUIRED,
    EH120_AUTOMATIC_VERIFICATION_RELEASE_DIGEST:
      process.env.EH120_AUTOMATIC_VERIFICATION_RELEASE_DIGEST,
    EH170_CLINIC_WORKSPACE_ENABLED: process.env.EH170_CLINIC_WORKSPACE_ENABLED,
    EH170_DICTAPHONE_ENABLED: process.env.EH170_DICTAPHONE_ENABLED,
    EH170_ROLLOUT_PROFILE_IDS: process.env.EH170_ROLLOUT_PROFILE_IDS,
    EH170_TRANSCRIPTION_DPA_APPROVED: process.env.EH170_TRANSCRIPTION_DPA_APPROVED,
    EH170_TRANSCRIPTION_REGION_APPROVED:
      process.env.EH170_TRANSCRIPTION_REGION_APPROVED,
    EH170_RECORDING_RETENTION_DAYS: process.env.EH170_RECORDING_RETENTION_DAYS,
    EH170_TRANSCRIPT_RETENTION_DAYS: process.env.EH170_TRANSCRIPT_RETENTION_DAYS,
    EH170_NOTE_RETENTION_DAYS: process.env.EH170_NOTE_RETENTION_DAYS,
    EH170_RETENTION_DELETE_ACTOR: process.env.EH170_RETENTION_DELETE_ACTOR,
    EH170_TRANSCRIPTION_PROVIDER: process.env.EH170_TRANSCRIPTION_PROVIDER,
    EH170_TRANSCRIPTION_MODEL: process.env.EH170_TRANSCRIPTION_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
    ASSISTANT_RESERVED_COST_USD: process.env.ASSISTANT_RESERVED_COST_USD,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    OWL_ALPHA_API_KEY: process.env.OWL_ALPHA_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    OWL_ALPHA_MODEL: process.env.OWL_ALPHA_MODEL,
    NEBIUS_API_KEY: process.env.NEBIUS_API_KEY,
    NEBIUS_BASE_URL: process.env.NEBIUS_BASE_URL,
    NEBIUS_REGION: process.env.NEBIUS_REGION,
    NEBIUS_FAST_FLAVOR_SUFFIX: process.env.NEBIUS_FAST_FLAVOR_SUFFIX,
    ALLOW_CROSS_PROVIDER_FALLBACK: process.env.ALLOW_CROSS_PROVIDER_FALLBACK,
    NEBIUS_FAST_CLASSIFY_MODEL: process.env.NEBIUS_FAST_CLASSIFY_MODEL,
    NEBIUS_FAST_EXTRACT_TEXT_MODEL: process.env.NEBIUS_FAST_EXTRACT_TEXT_MODEL,
    NEBIUS_FAST_EXTRACT_VISION_MODEL:
      process.env.NEBIUS_FAST_EXTRACT_VISION_MODEL,
    NEBIUS_FAST_SUMMARIZE_MODEL: process.env.NEBIUS_FAST_SUMMARIZE_MODEL,
    NEBIUS_FAST_REPORT_MODEL: process.env.NEBIUS_FAST_REPORT_MODEL,
    NEBIUS_FAST_SYNTHESIS_MODEL: process.env.NEBIUS_FAST_SYNTHESIS_MODEL,
    NEBIUS_FAST_ASSISTANT_MODEL: process.env.NEBIUS_FAST_ASSISTANT_MODEL,
    NEBIUS_QUALITY_CLASSIFY_MODEL: process.env.NEBIUS_QUALITY_CLASSIFY_MODEL,
    NEBIUS_QUALITY_EXTRACT_TEXT_MODEL:
      process.env.NEBIUS_QUALITY_EXTRACT_TEXT_MODEL,
    NEBIUS_QUALITY_EXTRACT_VISION_MODEL:
      process.env.NEBIUS_QUALITY_EXTRACT_VISION_MODEL,
    NEBIUS_QUALITY_SUMMARIZE_MODEL: process.env.NEBIUS_QUALITY_SUMMARIZE_MODEL,
    NEBIUS_QUALITY_REPORT_MODEL: process.env.NEBIUS_QUALITY_REPORT_MODEL,
    NEBIUS_QUALITY_SYNTHESIS_MODEL: process.env.NEBIUS_QUALITY_SYNTHESIS_MODEL,
    NEBIUS_QUALITY_ASSISTANT_MODEL: process.env.NEBIUS_QUALITY_ASSISTANT_MODEL,
    URL:
      process.env.URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_GUEST_MODE_ENABLED: process.env.NEXT_PUBLIC_GUEST_MODE_ENABLED,
    NEXT_PUBLIC_GUEST_LEGAL_APPROVED:
      process.env.NEXT_PUBLIC_GUEST_LEGAL_APPROVED,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
