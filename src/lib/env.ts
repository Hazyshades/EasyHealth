import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Frozen Circle / x402 stack — optional so human app boots without payments
    SELLER_ADDRESS: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    CIRCLE_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1),
    DEEPSEEK_API_KEY: z.string().min(1).optional(),
    DEEPSEEK_BASE_URL: z.string().url().optional(),
    DEEPSEEK_MODEL: z.string().min(1).optional(),
    OWL_ALPHA_API_KEY: z.string().min(1).optional(),
    OPENROUTER_BASE_URL: z.string().url().optional(),
    OWL_ALPHA_MODEL: z.string().min(1).optional(),
    NEBIUS_API_KEY: z.string().min(1).optional(),
    NEBIUS_BASE_URL: z.string().url().default("https://api.tokenfactory.nebius.com/v1"),
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
    NEBIUS_QUALITY_REPORT_MODEL: z.string().min(1).default("deepseek-ai/DeepSeek-V3.2"),
    NEBIUS_QUALITY_SYNTHESIS_MODEL: z.string().min(1).default("deepseek-ai/DeepSeek-V3.2"),
    URL: z.string().url().default("http://localhost:3000"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    // Frozen Circle human auth — optional
    NEXT_PUBLIC_CIRCLE_APP_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  },
  runtimeEnv: {
    SELLER_ADDRESS: process.env.SELLER_ADDRESS,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CIRCLE_API_KEY: process.env.CIRCLE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
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
    NEBIUS_FAST_EXTRACT_VISION_MODEL: process.env.NEBIUS_FAST_EXTRACT_VISION_MODEL,
    NEBIUS_FAST_SUMMARIZE_MODEL: process.env.NEBIUS_FAST_SUMMARIZE_MODEL,
    NEBIUS_FAST_REPORT_MODEL: process.env.NEBIUS_FAST_REPORT_MODEL,
    NEBIUS_FAST_SYNTHESIS_MODEL: process.env.NEBIUS_FAST_SYNTHESIS_MODEL,
    NEBIUS_QUALITY_CLASSIFY_MODEL: process.env.NEBIUS_QUALITY_CLASSIFY_MODEL,
    NEBIUS_QUALITY_EXTRACT_TEXT_MODEL: process.env.NEBIUS_QUALITY_EXTRACT_TEXT_MODEL,
    NEBIUS_QUALITY_EXTRACT_VISION_MODEL: process.env.NEBIUS_QUALITY_EXTRACT_VISION_MODEL,
    NEBIUS_QUALITY_SUMMARIZE_MODEL: process.env.NEBIUS_QUALITY_SUMMARIZE_MODEL,
    NEBIUS_QUALITY_REPORT_MODEL: process.env.NEBIUS_QUALITY_REPORT_MODEL,
    NEBIUS_QUALITY_SYNTHESIS_MODEL: process.env.NEBIUS_QUALITY_SYNTHESIS_MODEL,
    URL:
      process.env.URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_CIRCLE_APP_ID: process.env.NEXT_PUBLIC_CIRCLE_APP_ID,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
