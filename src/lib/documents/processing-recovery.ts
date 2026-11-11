export const DOCUMENT_PROCESSING_POLL_TIMEOUT_MS = 5 * 60_000;

export function processingPollRemainingMs(
  startedAt: number,
  now: number,
): number {
  return DOCUMENT_PROCESSING_POLL_TIMEOUT_MS - (now - startedAt);
}
