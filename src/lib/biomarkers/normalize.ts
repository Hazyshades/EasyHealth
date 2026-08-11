/** Registry token normalization used by extraction keys and internal identifiers. */
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
 * Accepts both identifier tokens (`_`) and measurement-label tokens (spaces).
 *
 * Returns `null` for fewer than two distinct tokens: a single-token projection
 * is equivalent to plain normalized equality, so admitting it would widen
 * nothing while exposing short labels to accidental collisions.
 */
export function tokenSetKey(normalizedToken: string): string | null {
  const tokens = [
    ...new Set(
      normalizedToken
        .split(/[\s_]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0),
    ),
  ];
  if (tokens.length < 2) return null;
  return tokens.sort().join(TOKEN_SET_SEPARATOR);
}

export type MeasurementLabelNormalization = {
  /** Authoritative match form (accent-preserving for ES). */
  primary: string;
  /** Accent-folded secondary form for controlled ES fallback. */
  folded: string;
  isEmpty: boolean;
  /** Digits-only / no-letter forms that must not participate in matching. */
  isWeak: boolean;
};

const SEPARATOR_RE = /[-–—_/\\,.;:()[\]{}·•|+*<>≤≥=]+/g;

/**
 * Human measurement-label normalization for alias admission.
 * Distinct from {@link snakeCaseToken} (identifier contract).
 */
export function analyzeMeasurementLabel(raw: string): MeasurementLabelNormalization {
  let primary = (raw ?? "").normalize("NFKC").trim().toLowerCase();
  primary = primary.replace(/ё/g, "е");
  // Keep percent as a word so `neu%` does not collapse onto `neu`.
  primary = primary.replace(/%/g, " percent ");
  primary = primary.replace(SEPARATOR_RE, " ");
  primary = primary.replace(/\s+/g, " ").trim();

  const folded = primary.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
  const isEmpty = primary.length === 0;
  const isWeak = isEmpty || isWeakMeasurementLabel(primary);

  return { primary, folded, isEmpty, isWeak };
}

export function normalizeMeasurementLabel(raw: string): string {
  return analyzeMeasurementLabel(raw).primary;
}

export function foldMeasurementLabel(raw: string): string {
  return analyzeMeasurementLabel(raw).folded;
}

function isWeakMeasurementLabel(primary: string): boolean {
  const compact = primary.replace(/\s+/g, "");
  if (!compact) return true;
  // No letters in any script (digits/symbols only) — e.g. collapsed "4".
  if (!/\p{L}/u.test(compact)) return true;
  return false;
}

/** @deprecated Use `resolveMeasurementDefinition` for semantic resolution. */
export function resolveCanonicalKey(key: string, name = ""): string {
  return snakeCaseToken(key || name) || "unknown";
}

/** @deprecated Use `resolveMeasurementDefinition` for semantic resolution. */
export function normalizeBiomarkerKey(key: string, name: string): string {
  return resolveCanonicalKey(key, name);
}
