import { BIOMARKER_DEFINITIONS } from "./catalog/definitions";

/** Tokens that must never resolve via single-letter chemistry aliases. */
const BLOCKED_TOKENS = new Set([
  "n_a",
  "na_",
  "n_a_",
  "null",
  "none",
  "unknown",
  "not_applicable",
  "not_available",
]);

/** Single-letter / short chemistry aliases applied only when name context is chemistry-like. */
const CONTEXTUAL_SHORT_ALIASES: Record<string, string> = {
  na: "sodium",
  k: "potassium",
  cl: "chloride",
  ca: "calcium",
  mg: "magnesium",
  fe: "iron",
  hb: "hemoglobin",
  tg: "triglycerides",
  tc: "total_cholesterol",
};

function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const def of BIOMARKER_DEFINITIONS) {
    map.set(def.key, def.key);
    for (const alias of def.aliases) {
      const normalized = snakeCaseToken(alias);
      if (!normalized || BLOCKED_TOKENS.has(normalized)) continue;
      // Prefer first registration; canonical key always wins
      if (!map.has(normalized) || normalized === def.key) {
        map.set(normalized, def.key);
      }
    }
  }
  // Short chemistry aliases (Na, K, …). "n_a" stays blocked above.
  for (const [alias, canonical] of Object.entries(CONTEXTUAL_SHORT_ALIASES)) {
    map.set(alias, canonical);
  }
  // Ensure canonical keys map to themselves
  for (const def of BIOMARKER_DEFINITIONS) {
    map.set(def.key, def.key);
  }
  return map;
}

export const ALIAS_MAP: Map<string, string> = buildAliasMap();

export function snakeCaseToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/**
 * Strip to ASCII-ish lab key form used for alias lookup.
 * Cyrillic is preserved for RU aliases.
 */
export function normalizeBiomarkerKeyToken(key: string, name: string): string {
  const raw = (key || name).trim();
  if (!raw) return "";
  return snakeCaseToken(raw);
}

function looksLikeMissingToken(token: string, name: string): boolean {
  if (BLOCKED_TOKENS.has(token)) return true;
  const n = name.trim().toLowerCase();
  // Match N/A / n.a. — but NOT chemistry "Na" / token "na"
  if (/^(n\s*\/\s*a|n\.a\.?|not\s*applicable|not\s*available)$/i.test(n)) return true;
  if (token === "n_a") return true;
  return false;
}

/**
 * Resolve lab key/name → canonical catalog key when known; otherwise snake_case token.
 */
export function resolveCanonicalKey(key: string, name = ""): string {
  const token = normalizeBiomarkerKeyToken(key, name);
  if (!token) return "unknown";

  if (looksLikeMissingToken(token, name)) {
    // Fall back to name-only if key looked like N/A
    const fromName = name ? snakeCaseToken(name) : "";
    if (fromName && !looksLikeMissingToken(fromName, name)) {
      return ALIAS_MAP.get(fromName) ?? fromName;
    }
    return fromName || "unknown";
  }

  // Direct alias hit
  const direct = ALIAS_MAP.get(token);
  if (direct) return direct;

  // Try name if key missed
  if (name) {
    const nameToken = snakeCaseToken(name);
    const fromName = ALIAS_MAP.get(nameToken);
    if (fromName) return fromName;
  }

  // Contextual short alias: only if name/unit context suggests chemistry
  if (CONTEXTUAL_SHORT_ALIASES[token]) {
    const ctx = `${key} ${name}`.toLowerCase();
    const chemistryHint =
      /sodium|potassium|chloride|calcium|magnesium|iron|electrolyte|натрий|калий|хлор|кальций|магний|железо|mEq|mmol|mg\/dl|µmol/i.test(
        ctx
      ) || token.length > 1;
    // Single letter k/na: require chemistry-ish name or explicit key length
    if (token.length > 1 || chemistryHint) {
      // For pure "na"/"k" without context, still map (labs print Na/K constantly)
      if (!(token === "na" && looksLikeMissingToken(token, name))) {
        return CONTEXTUAL_SHORT_ALIASES[token]!;
      }
    }
  }

  return token;
}

/** @deprecated Prefer resolveCanonicalKey; kept for call-site compatibility. */
export function normalizeBiomarkerKey(key: string, name: string): string {
  return resolveCanonicalKey(key, name);
}
