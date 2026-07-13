export function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

export function sanitizeReportStrings<T extends Record<string, unknown>>(content: T): T {
  const next = { ...content } as Record<string, unknown>;

  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string") {
      next[key] = stripMarkdownBold(value);
    } else if (Array.isArray(value)) {
      next[key] = value.map((item) =>
        typeof item === "string" ? stripMarkdownBold(item) : item
      );
    }
  }

  return next as T;
}
