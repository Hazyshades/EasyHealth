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

export type ShareLinkCleanupSummary = Readonly<{
  accessEvents: AccessCleanupResult;
  rateLimitBuckets: CleanupResult;
  pinProofs: CleanupResult;
}>;

const MAX_FAILURE_RETRIES = 3;
let nextCleanupAt = 0;
let consecutiveFailures = 0;

function nextDelay(summary: ShareLinkCleanupSummary): number {
  const backlog =
    summary.accessEvents.skipped ||
    summary.accessEvents.exhausted ||
    summary.rateLimitBuckets.exhausted ||
    summary.pinProofs.exhausted;
  return backlog
    ? workerEnv.shareRateLimitCleanupRetryIntervalMs
    : workerEnv.shareRateLimitCleanupIntervalMs;
}

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

export async function cleanupShareLinkState(
  now = new Date(),
): Promise<ShareLinkCleanupSummary | null> {
  const nowMs = now.getTime();
  if (nowMs < nextCleanupAt) return null;

  try {
    const accessEvents = await supabase.rpc(
      "cleanup_report_share_access_events",
      {
        p_now: now.toISOString(),
        p_max_batches: 100,
      },
    );
    if (accessEvents.error) throw new Error("access_event_cleanup_failed");

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
      accessEvents: parseAccessCleanupResult(accessEvents.data),
      rateLimitBuckets: parseCleanupResult(rateLimitBuckets.data),
      pinProofs: parseCleanupResult(pinProofs.data),
    } satisfies ShareLinkCleanupSummary;
    consecutiveFailures = 0;
    const accessBacklog =
      summary.accessEvents.skipped || summary.accessEvents.exhausted;
    const rateLimitBacklog =
      summary.rateLimitBuckets.exhausted || summary.pinProofs.exhausted;
    if (accessBacklog) {
      console.warn("share_access_event_cleanup_backlog", {
        remaining_expired_events: summary.accessEvents.remaining_expired_count,
      });
    }
    if (rateLimitBacklog) {
      console.warn("share_rate_limit_cleanup_backlog", {
        remaining_expired_buckets:
          summary.rateLimitBuckets.remaining_expired_count,
        remaining_expired_proofs: summary.pinProofs.remaining_expired_count,
      });
    }
    nextCleanupAt = nowMs + nextDelay(summary);
    return summary;
  } catch (error) {
    consecutiveFailures += 1;
    nextCleanupAt = nowMs + workerEnv.shareRateLimitCleanupRetryIntervalMs;
    const signal =
      consecutiveFailures >= MAX_FAILURE_RETRIES
        ? "share_rate_limit_cleanup_failed"
        : "share_rate_limit_cleanup_retry";
    console.error(signal, {
      attempts: consecutiveFailures,
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}
