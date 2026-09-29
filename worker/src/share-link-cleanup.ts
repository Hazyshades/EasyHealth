import { z } from "zod";
import { workerEnv } from "./env.js";
import { supabase } from "./supabase.js";

const CleanupSchema = z.object({
  deleted_count: z.number().int().nonnegative(),
  remaining_expired_count: z.number().int().nonnegative(),
  exhausted: z.boolean(),
});

const AccessCleanupSchema = CleanupSchema.extend({ skipped: z.boolean() });

type CleanupResult = z.infer<typeof CleanupSchema>;
type AccessCleanupResult = z.infer<typeof AccessCleanupSchema>;
type RateCleanupSummary = Readonly<{
  rateLimitBuckets: CleanupResult;
  pinProofs: CleanupResult;
}>;

export type ShareLinkCleanupSummary = Readonly<{
  accessEvents: AccessCleanupResult | null;
  rateLimitBuckets: CleanupResult | null;
  pinProofs: CleanupResult | null;
}>;

const MAX_FAILURE_RETRIES = 3;
let nextAccessEventCleanupAt = 0;
let nextRateLimitCleanupAt = 0;
let accessEventFailures = 0;
let rateLimitFailures = 0;

function parseCleanupResult(data: unknown): CleanupResult {
  const parsed = CleanupSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) throw new Error("share_cleanup_result_invalid");
  return parsed.data;
}

function parseAccessCleanupResult(data: unknown): AccessCleanupResult {
  const parsed = AccessCleanupSchema.safeParse(
    Array.isArray(data) ? data[0] : data,
  );
  if (!parsed.success) throw new Error("share_cleanup_result_invalid");
  return parsed.data;
}

async function cleanupAccessEvents(
  now: Date,
): Promise<AccessCleanupResult | null> {
  try {
    const result = await supabase.rpc("cleanup_report_share_access_events", {
      p_now: now.toISOString(),
      p_max_batches: 100,
    });
    if (result.error) throw new Error("access_event_cleanup_failed");

    const summary = parseAccessCleanupResult(result.data);
    accessEventFailures = 0;
    const backlog = summary.skipped || summary.exhausted;
    if (backlog) {
      console.warn("share_access_event_cleanup_backlog", {
        remaining_expired_events: summary.remaining_expired_count,
      });
    }
    nextAccessEventCleanupAt =
      now.getTime() +
      (backlog
        ? workerEnv.shareAccessEventCleanupRetryIntervalMs
        : workerEnv.shareAccessEventCleanupIntervalMs);
    return summary;
  } catch (error) {
    accessEventFailures += 1;
    nextAccessEventCleanupAt =
      now.getTime() + workerEnv.shareAccessEventCleanupRetryIntervalMs;
    const signal =
      accessEventFailures >= MAX_FAILURE_RETRIES
        ? "share_access_event_cleanup_failed"
        : "share_access_event_cleanup_retry";
    console.error(signal, {
      attempts: accessEventFailures,
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

async function cleanupRateLimitedState(
  now: Date,
): Promise<RateCleanupSummary | null> {
  try {
    const rateLimitBuckets = await supabase.rpc(
      "cleanup_report_share_rate_limit_buckets",
      {
        p_now: now.toISOString(),
        p_max_batches: 20,
      },
    );
    if (rateLimitBuckets.error) throw new Error("rate_limit_cleanup_failed");

    const pinProofs = await supabase.rpc("cleanup_report_share_pin_proofs", {
      p_now: now.toISOString(),
      p_max_batches: 20,
    });
    if (pinProofs.error) throw new Error("pin_proof_cleanup_failed");

    const summary = {
      rateLimitBuckets: parseCleanupResult(rateLimitBuckets.data),
      pinProofs: parseCleanupResult(pinProofs.data),
    } satisfies RateCleanupSummary;
    rateLimitFailures = 0;
    const backlog =
      summary.rateLimitBuckets.exhausted || summary.pinProofs.exhausted;
    if (backlog) {
      console.warn("share_rate_limit_cleanup_backlog", {
        remaining_expired_buckets:
          summary.rateLimitBuckets.remaining_expired_count,
        remaining_expired_proofs: summary.pinProofs.remaining_expired_count,
      });
    }
    nextRateLimitCleanupAt =
      now.getTime() +
      (backlog
        ? workerEnv.shareRateLimitCleanupRetryIntervalMs
        : workerEnv.shareRateLimitCleanupIntervalMs);
    return summary;
  } catch (error) {
    rateLimitFailures += 1;
    nextRateLimitCleanupAt =
      now.getTime() + workerEnv.shareRateLimitCleanupRetryIntervalMs;
    const signal =
      rateLimitFailures >= MAX_FAILURE_RETRIES
        ? "share_rate_limit_cleanup_failed"
        : "share_rate_limit_cleanup_retry";
    console.error(signal, {
      attempts: rateLimitFailures,
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

export async function cleanupShareLinkState(
  now = new Date(),
): Promise<ShareLinkCleanupSummary | null> {
  const nowMs = now.getTime();
  const accessEvents =
    nowMs >= nextAccessEventCleanupAt ? await cleanupAccessEvents(now) : null;
  const rateCleanup =
    nowMs >= nextRateLimitCleanupAt ? await cleanupRateLimitedState(now) : null;
  if (accessEvents === null && rateCleanup === null) return null;
  return {
    accessEvents,
    rateLimitBuckets: rateCleanup?.rateLimitBuckets ?? null,
    pinProofs: rateCleanup?.pinProofs ?? null,
  };
}
