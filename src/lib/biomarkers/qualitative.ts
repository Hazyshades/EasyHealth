export type ValueKind = "numeric" | "qualitative" | "ordinal" | "text";

export type ParsedLabValue = {
  value_kind: ValueKind;
  value: number | null;
  value_text: string | null;
  ordinal: number | null;
};

/** Dipstick / semi-quant ordinal map (design D1). */
const ORDINAL_MAP: Array<{ pattern: RegExp; ordinal: number; kind: ValueKind }> = [
  { pattern: /^(negative|neg|none|absent|негативн|отриц|negativ)/i, ordinal: 0, kind: "ordinal" },
  { pattern: /^(trace|следы|trazas)/i, ordinal: 1, kind: "ordinal" },
  { pattern: /^(\+{4}|4\+|xxxx)$/i, ordinal: 5, kind: "ordinal" },
  { pattern: /^(\+{3}|3\+|xxx)$/i, ordinal: 4, kind: "ordinal" },
  { pattern: /^(\+{2}|2\+|xx)$/i, ordinal: 3, kind: "ordinal" },
  { pattern: /^(\+|1\+|x)$/i, ordinal: 2, kind: "ordinal" },
  { pattern: /^(positive|pos|позитивн|положит|positiv)/i, ordinal: 2, kind: "ordinal" },
];

/**
 * Parse a lab cell that may be numeric or qualitative/semi-quantitative.
 */
export function parseLabValueCell(raw: unknown): ParsedLabValue | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { value_kind: "numeric", value: raw, value_text: String(raw), ordinal: null };
  }

  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;

  // Prefer ordinal/qualitative patterns before numeric parse
  for (const entry of ORDINAL_MAP) {
    if (entry.pattern.test(text)) {
      return {
        value_kind: entry.kind,
        value: null,
        value_text: text,
        ordinal: entry.ordinal,
      };
    }
  }

  // Numeric with optional comparison operators
  const cleaned = text.replace(/^[<>≤≥]+\s*/, "").replace(/,/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (Number.isFinite(parsed) && /^-?\d/.test(cleaned)) {
    return {
      value_kind: "numeric",
      value: parsed,
      value_text: text,
      ordinal: null,
    };
  }

  // Free text result
  return {
    value_kind: "text",
    value: null,
    value_text: text,
    ordinal: null,
  };
}

export type Specimen =
  | "serum"
  | "plasma"
  | "whole_blood"
  | "urine"
  | "other"
  | "unspecified";

export type Modifier =
  | "none"
  | "fasting"
  | "random"
  | "free"
  | "total"
  | "direct"
  | "indirect"
  | "calculated"
  | "ionized"
  | "absolute"
  | "percent"
  | string;

/**
 * Maps an explicit or label-derived specimen onto the stored vocabulary.
 *
 * #106 decision: the `explicit` branch keeps its trust here, because this
 * function is a pure mapper with no access to the row's provenance and no way
 * to judge where the value came from. The caller gates it instead — extraction
 * runs the result through `statedAxisValue`, and both resolver-input builders
 * do the same on read. Do not add provenance logic to this function; it would
 * duplicate the gate and give two places to get it wrong.
 */
export function inferSpecimen(
  key: string,
  name = "",
  explicit?: string | null
): Specimen {
  if (explicit && isSpecimen(explicit)) return explicit;
  const blob = `${key} ${name}`.toLowerCase();
  if (
    key.startsWith("urine_") ||
    key === "uacr" ||
    key === "upcr" ||
    key === "specific_gravity" ||
    /urine|моч[аие]|urinalysis|dipstick|orina/i.test(blob)
  ) {
    return "urine";
  }
  if (/plasma|плазм/i.test(blob)) return "plasma";
  if (/whole[\s_-]*blood|цельной?\s*кров|sangre\s*(total|entera)/i.test(blob)) return "whole_blood";
  if (/serum|сыворот|suero/i.test(blob)) return "serum";
  return "unspecified";
}

export function inferModifier(
  key: string,
  name = "",
  explicit?: string | null
): Modifier {
  if (explicit && explicit.trim()) return explicit.trim().toLowerCase();
  const blob = `${key} ${name}`.toLowerCase();
  if (/fasting|натощак|fpg|ayunas|basal/i.test(blob)) return "fasting";
  if (/random|случай|azar/i.test(blob)) return "random";
  if (/\bfree\b|свободн|libre/i.test(blob) && !/free_t/.test(key)) return "free";
  if (/\btotal\b|общ/i.test(blob) && /t3|t4|testosterone|cholesterol|colesterol/i.test(blob)) return "total";
  if (/direct|conjugated|прям|directa?/i.test(blob)) return "direct";
  if (/indirect|unconjugated|непрям|indirecta?/i.test(blob)) return "indirect";
  if (/ionized|ионизир|ionizado/i.test(blob)) return "ionized";
  if (/percent|%|относ|porcentaje/i.test(blob) && /neutrophil|lymphocyte|mono|eosino|baso|neutr[oó]filo|linfocito/i.test(blob)) {
    return "percent";
  }
  if (/absolute|абс|absolutos?/i.test(blob) && /neutrophil|lymphocyte|mono|eosino|baso|neutr[oó]filo|linfocito/i.test(blob)) {
    return "absolute";
  }
  if (/calculated|calc|расчёт|calculad[oa]/i.test(blob)) return "calculated";
  return "none";
}

function isSpecimen(v: string): v is Specimen {
  return ["serum", "plasma", "whole_blood", "urine", "other", "unspecified"].includes(v);
}

/** Observation identity key for latest-by aggregation. */
export function observationIdentityKey(
  biomarkerKey: string,
  specimen: string,
  modifier: string
): string {
  return `${biomarkerKey}::${specimen || "unspecified"}::${modifier || "none"}`;
}
