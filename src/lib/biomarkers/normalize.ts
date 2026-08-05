/** Registry token normalization used by extraction and resolution helpers. */
export function snakeCaseToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u00b5\u03bc]/g, "u")
    // Preserve percent markers so aliases like `neu%` do not collapse onto `neu`.
    .replace(/%/g, "_percent")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeBiomarkerKeyToken(key: string): string {
  return snakeCaseToken(key);
}

/** Separator that cannot occur inside a `snakeCaseToken` output. */
const TOKEN_SET_SEPARATOR = "|";

/**
 * Order-insensitive projection of a normalization token, used by #105 alias
 * admission so `alt_alanine_aminotransferase` and `alanine_aminotransferase_alt`
 * collapse onto the same key.
 *
 * Returns `null` for fewer than two distinct tokens: a single-token projection
 * is equivalent to plain normalized equality, so admitting it would widen
 * nothing while exposing short labels to accidental collisions.
 */
export function tokenSetKey(normalizedToken: string): string | null {
  const tokens = [
    ...new Set(normalizedToken.split("_").filter((token) => token.length > 0)),
  ];
  if (tokens.length < 2) return null;
  return tokens.sort().join(TOKEN_SET_SEPARATOR);
}

/** @deprecated Use `resolveMeasurementDefinition` for semantic resolution. */
export function resolveCanonicalKey(key: string, name = ""): string {
  return snakeCaseToken(key || name) || "unknown";
}

/** @deprecated Use `resolveMeasurementDefinition` for semantic resolution. */
export function normalizeBiomarkerKey(key: string, name: string): string {
  return resolveCanonicalKey(key, name);
}
