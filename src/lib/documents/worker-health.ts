export const DEFAULT_WORKER_LIVENESS_THRESHOLD_MS = 20_000;

function configuredLivenessThresholdMs(): number {
  const configured = Number(process.env.WORKER_LIVENESS_THRESHOLD_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_WORKER_LIVENESS_THRESHOLD_MS;
}

export function isWorkerOffline(
  lastSeen: string | null | undefined,
  nowMs = Date.now(),
  thresholdMs = configuredLivenessThresholdMs(),
): boolean {
  if (!lastSeen) return true;
  const lastSeenMs = Date.parse(lastSeen);
  if (!Number.isFinite(lastSeenMs)) return true;
  return nowMs - lastSeenMs > thresholdMs;
}
