/**
 * #106: which clinical-axis values count as *stated* by the source document.
 *
 * `analyte-measurement-model` requires that unknown information "MUST NOT behave
 * as positive compatibility evidence". The resolver honours that, but it cannot
 * tell a stated axis from one the extraction model inferred — `input.specimen`
 * is a bare string, and satisfying the axis is exactly what removes it from
 * `missingAxes` and makes a candidate admissible.
 *
 * So the distinction has to be drawn before resolution. An axis value is stated
 * only when its lexical form occurs in provenance already captured for that row:
 * the row's own `source_text`, or the `section_context` it was printed under.
 * The existing spec already sanctions the second source with the phrase
 * "and available context cannot prove it".
 *
 * The test deliberately under-approximates. A specimen printed in a page header
 * we never captured reads as unstated, which yields `partial` — raw evidence
 * intact, explicitly reviewable. That is the safe error direction.
 *
 * This module holds no catalog or resolver imports so that both row-to-input
 * builders can apply the same policy.
 */

/** Provenance captured for a single extracted row. */
export type RowProvenance = {
  /**
   * The row's own printed label. It is document text, so a modifier spelled in
   * the label — `Neutrophils, absolute (NEU)` — is stated even when no snippet
   * was captured.
   */
  label?: string | null;
  /** Verbatim snippet from the document containing the row. */
  sourceText?: string | null;
  /** Heading or panel the row was printed under. */
  sectionContext?: string | null;
};

/** Axis values that mean "the document did not say", and are never fabricated. */
const UNKNOWN_AXIS_VALUES: Readonly<Record<string, true>> = {
  unspecified: true,
  none: true,
  unknown: true,
};

/**
 * Lexical forms that count as stating each specimen, including the Cyrillic and
 * Spanish stems already recognised by `inferSpecimen`.
 */
const SPECIMEN_FORMS: Readonly<Record<string, readonly string[]>> = {
  serum: ["serum", "сыворот", "suero"],
  plasma: ["plasma", "плазм"],
  whole_blood: [
    "whole blood",
    "whole-blood",
    "wholeblood",
    "цельной крови",
    "цельная кровь",
    "sangre total",
    "sangre entera",
  ],
  urine: ["urine", "моч", "orina"],
};

export type ClinicalAxis = "specimen" | "modifier" | "method" | "timing";

/**
 * Collapses to lowercase words separated by single spaces, so that hyphen,
 * underscore and space are equivalent — `Post-prandial` states `post_prandial`
 * exactly as `post prandial` does. This mirrors `snakeCaseToken`, which maps
 * every non-alphanumeric run to one separator.
 */
function normalizeLexical(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u00b5\u03bc]/g, "u")
    // `snakeCaseToken` already treats `%` as the word, so `NEU%` states percent.
    .replace(/%/g, " percent ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeHaystack(provenance: RowProvenance): string {
  return normalizeLexical(
    `${provenance.label ?? ""} ${provenance.sourceText ?? ""} ${provenance.sectionContext ?? ""}`,
  );
}

/**
 * Lexical forms that would state the given axis value. Specimen uses a curated
 * synonym table because its tokens differ from its stored key; the other axes
 * are stored as the word the document prints, so the value itself is the form.
 */
function statedForms(axis: ClinicalAxis, value: string): readonly string[] {
  const forms = axis === "specimen" ? SPECIMEN_FORMS[value] ?? [value] : [value];
  return forms.map(normalizeLexical);
}

/**
 * True when the axis value is evidenced by the row's own captured provenance.
 *
 * Unknown/default values return true: they assert nothing, so there is nothing
 * to fabricate and nothing to strip.
 */
export function isAxisStated(
  axis: ClinicalAxis,
  value: string | null | undefined,
  provenance: RowProvenance,
): boolean {
  if (typeof value !== "string") return true;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed in UNKNOWN_AXIS_VALUES) return true;

  const haystack = normalizeHaystack(provenance);
  if (haystack.length === 0) return false;
  // A value made only of punctuation (`<`, seen on censored results where the
  // comparator leaked into the modifier axis) normalizes to the empty string,
  // and `includes("")` is true for every haystack. Such a value can never be
  // evidenced lexically, so it is never stated.
  const forms = statedForms(axis, trimmed).filter((form) => form.length > 0);
  return forms.some((form) => haystack.includes(form));
}

/**
 * Returns the axis value when the document states it, otherwise `null` so the
 * resolver receives the axis as absent and reports it missing.
 */
export function statedAxisValue<T extends string | null | undefined>(
  axis: ClinicalAxis,
  value: T,
  provenance: RowProvenance,
): T | null {
  return isAxisStated(axis, value, provenance) ? value : null;
}

export type AxisInference = {
  axis: ClinicalAxis;
  /** The value the extraction layer supplied without document evidence. */
  discarded: string;
};

/**
 * Every axis on a row whose concrete value the document does not state.
 * Non-authoritative: for auditing and for the static release gate, never for
 * resolution.
 */
export function unstatedAxes(
  axes: Readonly<Partial<Record<ClinicalAxis, string | null | undefined>>>,
  provenance: RowProvenance,
): readonly AxisInference[] {
  const found: AxisInference[] = [];
  for (const axis of ["specimen", "modifier", "method", "timing"] as const) {
    const value = axes[axis];
    if (typeof value !== "string") continue;
    if (isAxisStated(axis, value, provenance)) continue;
    found.push({ axis, discarded: value.trim() });
  }
  return found;
}

/** A row carrying at least one concrete axis the document does not state. */
export type UnstatedAxisFinding = {
  rowId: string;
  label: string;
  inferences: readonly AxisInference[];
};

export type AuditableRow = {
  id: string;
  biomarker_name?: string | null;
  raw_name?: string | null;
  section_context?: string | null;
  source_text?: string | null;
  specimen?: string | null;
  modifier?: string | null;
  method?: string | null;
};

/**
 * The static gate: every row whose concrete axis values are not evidenced by its
 * own captured provenance. Used by the verification script and by the
 * candidate-release seam check.
 */
export function auditUnstatedAxes(
  rows: readonly AuditableRow[],
): readonly UnstatedAxisFinding[] {
  const findings: UnstatedAxisFinding[] = [];
  for (const row of rows) {
    const inferences = unstatedAxes(
      { specimen: row.specimen, modifier: row.modifier, method: row.method },
      {
        label: row.raw_name ?? row.biomarker_name,
        sourceText: row.source_text,
        sectionContext: row.section_context,
      },
    );
    if (inferences.length === 0) continue;
    findings.push({
      rowId: row.id,
      label: row.raw_name?.trim() || row.biomarker_name?.trim() || row.id,
      inferences,
    });
  }
  return findings;
}
