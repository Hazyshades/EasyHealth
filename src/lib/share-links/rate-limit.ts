import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseCanonicalAddress } from "./trusted-ingress-transport";

const HEX_PATTERN = /^[0-9a-f]{64}$/;

export type ShareFailureRateLimit = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

export class ShareRateLimitConfigurationError extends Error {
  constructor() {
    super("Share rate-limit configuration unavailable");
    this.name = "ShareRateLimitConfigurationError";
  }
}

export class ShareRateLimitStoreError extends Error {
  constructor() {
    super("Share rate-limit store unavailable");
    this.name = "ShareRateLimitStoreError";
  }
}

function boundedSetting(
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const raw = process.env[name]?.trim();
  const value = raw === undefined ? defaultValue : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ShareRateLimitConfigurationError();
  }
  return value;
}

function rateLimitPepper(): string {
  const value = process.env.SHARE_RATE_LIMIT_PEPPER?.trim();
  if (!value || value.length < 16) {
    throw new ShareRateLimitConfigurationError();
  }
  return value;
}

function dimensionDigest(dimension: string, value: string): string {
  return createHmac("sha256", rateLimitPepper())
    .update(`${dimension}:${value}`, "utf8")
    .digest("hex");
}

export function shareTokenDigestKey(tokenDigest: string): string {
  if (!HEX_PATTERN.test(tokenDigest)) {
    throw new ShareRateLimitConfigurationError();
  }
  return tokenDigest;
}

function normalizedRequesterAddress(address: string): string {
  const parsed = parseCanonicalAddress(address);
  if (!parsed) throw new ShareRateLimitConfigurationError();
  if (parsed.family === 4) {
    return `ipv4:${parsed.bytes[0]}.${parsed.bytes[1]}.${parsed.bytes[2]}.0/24`;
  }
  const prefix = Array.from(parsed.bytes.slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join(":");
  return `ipv6:${prefix}/64`;
}

export function classifyShareUserAgent(
  userAgent: string | null,
): "browser" | "automation" | "other" | "unknown" {
  if (!userAgent) return "unknown";
  if (
    /bot|crawler|spider|headless|curl|wget|python-requests|playwright|selenium/i.test(
      userAgent,
    )
  ) {
    return "automation";
  }
  if (/mozilla|chrome|safari|firefox|edg\//i.test(userAgent)) return "browser";
  return "other";
}

function requesterDimension(address: string, userAgent: string | null): string {
  return `${normalizedRequesterAddress(address)}:${classifyShareUserAgent(userAgent)}`;
}

type RateLimitStore = Pick<SupabaseClient, "rpc">;

const RateLimitRpcRowSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number(),
  store_available: z.literal(true),
});

type RateLimitRpcRow = z.infer<typeof RateLimitRpcRowSchema>;

function rpcRow(data: unknown): RateLimitRpcRow {
  const candidate = Array.isArray(data) ? data[0] : data;
  const parsed = RateLimitRpcRowSchema.safeParse(candidate);
  if (!parsed.success) throw new ShareRateLimitStoreError();
  return parsed.data;
}
async function consumeOne(
  store: RateLimitStore,
  keyDigest: string,
  limit: number,
  now: Date,
): Promise<RateLimitRpcRow> {
  const result = await store.rpc("consume_report_share_rate_limit", {
    p_key_digest: keyDigest,
    p_window_seconds: boundedSetting(
      "SHARE_RATE_LIMIT_WINDOW_SECONDS",
      60,
      10,
      300,
    ),
    p_limit: limit,
    p_now: now.toISOString(),
  });
  if (result.error) throw new ShareRateLimitStoreError();
  return rpcRow(result.data);
}

export async function consumeShareFailureRateLimits(
  store: RateLimitStore,
  input: Readonly<{
    tokenKey: string | null;
    requesterAddress: string;
    userAgent: string | null;
    now?: Date;
  }>,
): Promise<ShareFailureRateLimit> {
  const now = input.now ?? new Date();
  const requester = await consumeOne(
    store,
    dimensionDigest(
      "requester",
      requesterDimension(input.requesterAddress, input.userAgent),
    ),
    boundedSetting("SHARE_RATE_LIMIT_REQUESTER_FAILURES", 30, 1, 300),
    now,
  );
  if (input.tokenKey === null) {
    return {
      allowed: requester.allowed,
      retryAfterSeconds: requester.retry_after_seconds,
    };
  }
  const token = await consumeOne(
    store,
    dimensionDigest("token", input.tokenKey),
    boundedSetting("SHARE_RATE_LIMIT_TOKEN_FAILURES", 10, 1, 100),
    now,
  );
  return {
    allowed: token.allowed && requester.allowed,
    retryAfterSeconds: Math.max(
      token.retry_after_seconds,
      requester.retry_after_seconds,
    ),
  };
}
