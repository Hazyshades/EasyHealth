/**
 * Client-side cache for short-lived signed storage URLs.
 * Keys are opaque (e.g. `thumb:${documentId}`, `page:${documentId}:${n}`).
 */

type CacheEntry = {
  url: string;
  expiresAtMs: number;
};

const cache = new Map<string, CacheEntry>();

/** Refresh / treat as expired this many ms before actual expiry. */
const SKEW_MS = 60_000;

export function getCachedSignedUrl(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAtMs - SKEW_MS) {
    cache.delete(key);
    return null;
  }
  return entry.url;
}

export function setCachedSignedUrl(
  key: string,
  url: string,
  expiresInSeconds: number
): void {
  if (!url || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) return;
  cache.set(key, {
    url,
    expiresAtMs: Date.now() + expiresInSeconds * 1000,
  });
}

export function thumbnailCacheKey(documentId: string): string {
  return `thumb:${documentId}`;
}

export function pageCacheKey(documentId: string, pageNumber: number): string {
  return `page:${documentId}:${pageNumber}`;
}

export function fileCacheKey(documentId: string): string {
  return `file:${documentId}`;
}
