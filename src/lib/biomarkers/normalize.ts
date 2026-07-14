/** Registry token normalization used by extraction and resolution helpers. */
export function snakeCaseToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u00b5\u03bc]/g, "u")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeBiomarkerKeyToken(key: string): string {
  return snakeCaseToken(key);
}

/** @deprecated Use `resolveMeasurementDefinition` for semantic resolution. */
export function resolveCanonicalKey(key: string, name = ""): string {
  return snakeCaseToken(key || name) || "unknown";
}

/** @deprecated Use `resolveMeasurementDefinition` for semantic resolution. */
export function normalizeBiomarkerKey(key: string, name: string): string {
  return resolveCanonicalKey(key, name);
}
