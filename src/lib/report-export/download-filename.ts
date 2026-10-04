const UNSAFE_FILENAME = /[\u0000-\u001f<>:"/\\|?*]/gu;

/**
 * Resolves a download filename from a `Content-Disposition` header.
 *
 * The server already sanitizes the name, but this is the final sink before the
 * browser writes to disk, so path separators and control characters are removed
 * again rather than trusted.
 */
export function attachmentFilename(
  contentDisposition: string | null,
  fallback: string,
): string {
  const extended = contentDisposition?.match(
    /filename\*=UTF-8''([^;]+)/iu,
  )?.[1];
  const plain = contentDisposition?.match(/filename="([^"]*)"/iu)?.[1];
  const candidate = extended ?? plain;
  if (!candidate) return fallback;

  let decoded = candidate;
  if (extended) {
    try {
      decoded = decodeURIComponent(extended);
    } catch {
      return fallback;
    }
  }

  const sanitized = decoded.replace(UNSAFE_FILENAME, " ").trim().slice(0, 120);
  return sanitized.length > 0 ? sanitized : fallback;
}
