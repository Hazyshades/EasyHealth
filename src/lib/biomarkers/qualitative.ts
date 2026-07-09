export type ValueKind = "numeric" | "qualitative" | "ordinal" | "text";

export type ParsedLabValue = {
  value_kind: ValueKind;
  value: number | null;
  value_text: string | null;
  ordinal: number | null;
};

/** Dipstick / semi-quant ordinal map (design D1). */
const ORDINAL_MAP: Array<{ pattern: RegExp; ordinal: number; kind: ValueKind }> = [
  { pattern: /^(negative|neg|none|absent|негативн|отриц)/i, ordinal: 0, kind: "ordinal" },
  { pattern: /^(trace|следы)/i, ordinal: 1, kind: "ordinal" },
  { pattern: /^(\+{4}|4\+|xxxx)$/i, ordinal: 5, kind: "ordinal" },
  { pattern: /^(\+{3}|3\+|xxx)$/i, ordinal: 4, kind: "ordinal" },
  { pattern: /^(\+{2}|2\+|xx)$/i, ordinal: 3, kind: "ordinal" },
  { pattern: /^(\+|1\+|x)$/i, ordinal: 2, kind: "ordinal" },
  { pattern: /^(positive|pos|позитивн|положит)/i, ordinal: 2, kind: "ordinal" },
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
    /urine|моч[аие]|urinalysis|dipstick/i.test(blob)
  ) {
    return "urine";
  }
  if (/plasma|плазм/i.test(blob)) return "plasma";
  if (/whole\s*blood|цельной?\s*кров/i.test(blob)) return "whole_blood";
  if (/serum|сыворот/i.test(blob)) return "serum";
  return "unspecified";
}

export function inferModifier(
  key: string,
  name = "",
  explicit?: string | null
): Modifier {
  if (explicit && explicit.trim()) return explicit.trim().toLowerCase();
  const blob = `${key} ${name}`.toLowerCase();
  if (/fasting|натощак|fpg/i.test(blob)) return "fasting";
  if (/random|случай/i.test(blob)) return "random";
  if (/\bfree\b|свободн/i.test(blob) && !/free_t/.test(key)) return "free";
  if (/\btotal\b|общ/i.test(blob) && /t3|t4|testosterone|cholesterol/i.test(blob)) return "total";
  if (/direct|conjugated|прям/i.test(blob)) return "direct";
  if (/indirect|unconjugated|непрям/i.test(blob)) return "indirect";
  if (/ionized|ионизир/i.test(blob)) return "ionized";
  if (/percent|%|относ/i.test(blob) && /neutrophil|lymphocyte|mono|eosino|baso/i.test(blob)) {
    return "percent";
  }
  if (/absolute|абс/i.test(blob) && /neutrophil|lymphocyte|mono|eosino|baso/i.test(blob)) {
    return "absolute";
  }
  if (/calculated|calc|расчёт/i.test(blob)) return "calculated";
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
