/**
 * EH-119 measurement correction contract.
 *
 * A reviewer restates what was read from the document. That restatement is a
 * `MeasurementOverride`: an object naming only the fields the reviewer changed,
 * absolute against raw extraction rather than cumulative against a previous
 * override. Key presence is the signal — it is what distinguishes "the reviewer
 * restated the unit" from "the reviewer did not touch the unit".
 *
 * This module owns the shape, the semantics and the validation. It deliberately
 * does not import the writer: the writer imports this. `applyMeasurementOverride`
 * is pure over a base measurement so the composition can be tested without a
 * database row.
 *
 * The field allowlist is the correction contract's safety property. It contains
 * no raw, source, provenance, version or identity field, and no clinical
 * identity axis, so a correction structurally cannot rewrite raw evidence,
 * cannot guess a specimen, modifier, timing or method, and cannot assert an
 * outcome. `eh119_is_measurement_override` in migration
 * `047_eh119_observation_measurement_correction.sql` enforces the same
 * allowlist in the database.
 */
import {
  evaluateUnitCompatibility,
  getMeasurementDefinition,
  hasLeadingComparator,
  isCensoredLabValueCell,
  normalizeMeasurementUnit,
  parseLabValueCell,
} from "@/lib/biomarkers";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";

export const MEASUREMENT_OVERRIDE_FIELDS = [
  "value",
  "value_text",
  "value_kind",
  "ordinal",
  "unit",
  "ref_low",
  "ref_high",
  "observed_at",
] as const;

export type MeasurementOverrideField = (typeof MEASUREMENT_OVERRIDE_FIELDS)[number];

export type MeasurementValueKindKey = "numeric" | "qualitative" | "ordinal" | "text";

const VALUE_KINDS: readonly MeasurementValueKindKey[] = [
  "numeric",
  "qualitative",
  "ordinal",
  "text",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * A comparator-bearing result is a censored measurement, not a number. #108
 * shows the extractor already loses the censoring by storing `< 0.20` as `0.2`,
 * and the comparator leaking into the `modifier` clinical axis is only kept out
 * by an incidental normalization rule. A reviewer restating such a value must
 * not be able to make that worse with their name attached, so the flow keeps
 * the printed string and refuses to synthesize a number from it.
 */

export type MeasurementOverride = {
  readonly value?: number | null;
  readonly value_text?: string | null;
  readonly value_kind?: MeasurementValueKindKey;
  readonly ordinal?: number | null;
  readonly unit?: string;
  readonly ref_low?: number | null;
  readonly ref_high?: number | null;
  readonly observed_at?: string | null;
};

export type BaseMeasurement = {
  readonly value: number | null;
  readonly valueText: string | null;
  readonly valueKind: MeasurementValueKindKey;
  readonly ordinal: number | null;
  readonly unit: string | null;
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly observedAt: string | null;
};

export type ExtractedBiomarkerMeasurementRow = Readonly<{
  value_numeric: number | string | null;
  value_text: string | null;
  value_kind: string | null;
  ordinal: number | null;
  unit: string | null;
  reference_range: string | null;
  raw_reference_range: string | null;
  raw_value_text?: string | null;
}>;

function finiteMeasurementValue(
  value: number | string | null | undefined,
): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds the client-safe correction base from immutable extracted evidence.
 * Persistence and resolver decisions remain the normalization writer's job.
 */
export function baseMeasurementFromExtractedRow(
  row: ExtractedBiomarkerMeasurementRow,
  observedAt: string | null,
): BaseMeasurement {
  let value = finiteMeasurementValue(row.value_numeric);
  let valueText = row.value_text?.trim() || null;
  let valueKind = row.value_kind ?? null;
  let ordinal = row.ordinal ?? null;

  const printedComparator =
    [row.value_text, row.raw_value_text, typeof row.value_numeric === "string" ? row.value_numeric : null]
      .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
      .find((candidate) => isCensoredLabValueCell(candidate)) ?? null;

  if (printedComparator) {
    value = null;
    valueText = printedComparator;
    valueKind = "text";
    ordinal = null;
  } else if (value == null && valueText) {
    const parsed = parseLabValueCell(valueText);
    if (parsed) {
      value = parsed.value;
      valueText = parsed.value_text;
      valueKind = parsed.value_kind;
      ordinal = parsed.ordinal;
    }
  } else if (value != null) {
    valueKind ??= "numeric";
    valueText ??= String(value);
  }

  const normalizedValueKind =
    valueKind === "numeric" || valueKind === "qualitative" || valueKind === "ordinal"
      ? valueKind
      : "text";
  if (normalizedValueKind === "numeric" && value == null) {
    throw new Error("Numeric observation has no usable value");
  }
  if (normalizedValueKind !== "numeric" && !valueText) {
    throw new Error("Qualitative observation has no usable value");
  }

  const { ref_low, ref_high } = parseReferenceRange(
    row.reference_range ?? row.raw_reference_range,
  );
  return {
    value,
    valueText,
    valueKind: normalizedValueKind,
    ordinal,
    unit: row.unit,
    refLow: ref_low,
    refHigh: ref_high,
    observedAt,
  };
}

export type MeasurementCorrectionCode =
  | "override_not_an_object"
  | "override_empty"
  | "override_unknown_field"
  | "override_field_type"
  | "value_kind_unsupported"
  | "value_kind_requires_value"
  | "value_kind_requires_text"
  | "reference_range_inverted"
  | "observed_at_invalid"
  | "observed_at_in_future"
  | "unit_blank"
  | "unit_unsupported"
  | "unit_dimension_conflict"
  | "correction_reason_required"
  | "censored_value_requires_text";

export type MeasurementCorrectionFailure = {
  readonly ok: false;
  readonly code: MeasurementCorrectionCode;
  readonly field: MeasurementOverrideField | "correction_reason";
  readonly message: string;
  readonly observed?: string;
  readonly expected?: readonly string[];
};

export type MeasurementCorrectionSuccess = {
  readonly ok: true;
  readonly override: MeasurementOverride;
  readonly measurement: BaseMeasurement;
  /**
   * True when the restated unit costs the row the concrete definition it is
   * currently bound to. The caller may only proceed when the request
   * acknowledged that outcome; silent degradation is the one behaviour ruled
   * out by the capability spec.
   */
  readonly losesDefinitionBinding: boolean;
};

export type MeasurementCorrectionResult =
  | MeasurementCorrectionSuccess
  | MeasurementCorrectionFailure;

function fail(
  code: MeasurementCorrectionCode,
  field: MeasurementCorrectionFailure["field"],
  message: string,
  extra?: { observed?: string; expected?: readonly string[] }
): MeasurementCorrectionFailure {
  return { ok: false, code, field, message, ...extra };
}
const CORRECTION_HTTP_STATUSES: Readonly<Record<string, number>> = {
  override_not_an_object: 400,
  override_empty: 400,
  override_unknown_field: 400,
  override_field_type: 400,
  value_kind_unsupported: 400,
  value_kind_requires_value: 400,
  value_kind_requires_text: 400,
  reference_range_inverted: 400,
  observed_at_invalid: 400,
  observed_at_in_future: 400,
  unit_blank: 400,
  unit_unsupported: 400,
  unit_dimension_conflict: 400,
  censored_value_requires_text: 400,
  correction_reason_required: 400,
  invalid_measurement_override: 400,
  measurement_override_observed_at_in_future: 400,
  measurement_correction_requires_reason: 400,
  correction_requires_reviewed_concrete_definition: 422,
  invalid_normalization_resolution_payload: 422,
  invalid_normalization_writer_payload: 422,
  invalid_normalization_write_kind: 422,
  normalization_writer_actor_required: 422,
  invalid_normalization_writer_request_hash: 422,
  incomplete_normalization_cannot_have_concrete_identity: 422,
  resolved_normalization_requires_concrete_identity: 422,
  unreviewed_measurement_definition: 422,
  reversal_revision_source_mismatch: 422,
  superseded_revision_source_mismatch: 422,
  stale_revision_conflict: 409,
  observation_source_mismatch: 409,
  observation_source_owner_mismatch: 409,
  active_revision_projection_mismatch: 409,
  measurement_override_projection_mismatch: 409,
  revision_observation_binding_conflict: 409,
  terminal_record: 409,
  observation_source_page_missing: 422,
  invalid_resolver_decision_trace: 422,
  resolver_decision_trace_resolution_mismatch: 422,
};

/**
 * Maps correction and writer contract codes to the HTTP class the API exposes.
 * Returning null for an unknown code keeps unexpected failures distinguishable
 * from a known correction rejection.
 */
export function codeFor(code: string | null | undefined): number | null {
  return code ? CORRECTION_HTTP_STATUSES[code] ?? null : null;
}


function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isMeasurementOverrideField(key: string): key is MeasurementOverrideField {
  return (MEASUREMENT_OVERRIDE_FIELDS as readonly string[]).includes(key);
}

/**
 * Structural validation plus the immutable shape invariants shared with SQL.
 * Date freshness and unit compatibility remain application-only checks.
 */
export function isMeasurementOverride(value: unknown): value is MeasurementOverride {
  const parsed = parseMeasurementOverride(value);
  if (!parsed.ok) return false;
  const override = parsed.override;
  if ("value_kind" in override) {
    if (override.value_kind === "numeric") {
      if (!("value" in override) || override.value == null) return false;
    } else if (!("value_text" in override) || !override.value_text?.trim()) {
      return false;
    }
  }
  return !(
    override.ref_low != null &&
    override.ref_high != null &&
    override.ref_low > override.ref_high
  );
}

export function parseMeasurementOverride(
  value: unknown
): { ok: true; override: MeasurementOverride } | MeasurementCorrectionFailure {
  if (!isPlainObject(value)) {
    return fail("override_not_an_object", "value", "A correction must name the fields it restates.");
  }

  const keys = Object.keys(value);
  if (keys.length === 0) {
    return fail("override_empty", "value", "Nothing was restated.");
  }

  for (const key of keys) {
    if (!isMeasurementOverrideField(key)) {
      return fail(
        "override_unknown_field",
        "value",
        `\`${key}\` is not a correctable field.`,
        { observed: key, expected: MEASUREMENT_OVERRIDE_FIELDS }
      );
    }
  }

  const candidate = value as Record<MeasurementOverrideField, unknown>;

  for (const key of ["value", "ordinal", "ref_low", "ref_high"] as const) {
    if (key in candidate && candidate[key] !== null && !isFiniteNumber(candidate[key])) {
      return fail("override_field_type", key, `\`${key}\` must be a number or empty.`);
    }
  }

  if ("value_text" in candidate && candidate.value_text !== null && typeof candidate.value_text !== "string") {
    return fail("override_field_type", "value_text", "The result text must be text.");
  }

  if ("value_kind" in candidate) {
    if (
      typeof candidate.value_kind !== "string" ||
      !VALUE_KINDS.includes(candidate.value_kind as MeasurementValueKindKey)
    ) {
      return fail(
        "value_kind_unsupported",
        "value_kind",
        "That result kind is not supported.",
        {
          observed: String(candidate.value_kind),
          expected: VALUE_KINDS,
        }
      );
    }
  }

  if ("unit" in candidate) {
    if (typeof candidate.unit !== "string" || candidate.unit.trim() === "") {
      return fail("unit_blank", "unit", "A restated unit cannot be blank.");
    }
  }

  if ("observed_at" in candidate && candidate.observed_at !== null) {
    if (
      typeof candidate.observed_at !== "string" ||
      !isCalendarDate(candidate.observed_at)
    ) {
      return fail("observed_at_invalid", "observed_at", "The date must be a calendar date.");
    }
  }

  const override: MeasurementOverride = {};
  const draft = override as Record<string, unknown>;
  for (const key of MEASUREMENT_OVERRIDE_FIELDS) {
    if (key in candidate) draft[key] = candidate[key];
  }
  return { ok: true, override };
}

/**
 * Compose the effective measurement. Only keys present in the override are
 * applied; every other field keeps its raw extracted value. The override is
 * absolute against raw extraction, so undoing a correction is a copy of an
 * earlier override rather than a replay of a diff chain.
 */
export function applyMeasurementOverride(
  base: BaseMeasurement,
  override: MeasurementOverride | null | undefined
): BaseMeasurement {
  if (!override) return base;
  return {
    value: "value" in override ? override.value ?? null : base.value,
    valueText: "value_text" in override ? override.value_text ?? null : base.valueText,
    valueKind: "value_kind" in override ? override.value_kind ?? base.valueKind : base.valueKind,
    ordinal: "ordinal" in override ? override.ordinal ?? null : base.ordinal,
    unit: "unit" in override ? override.unit ?? null : base.unit,
    refLow: "ref_low" in override ? override.ref_low ?? null : base.refLow,
    refHigh: "ref_high" in override ? override.ref_high ?? null : base.refHigh,
    observedAt: "observed_at" in override ? override.observed_at ?? base.observedAt : base.observedAt,
  };
}

/**
 * True when the restated value carries a comparator. Such a value stays text:
 * the flow never routes it through `parseLabNumber`, which drops the comparator
 * and leaves a number the laboratory never reported.
 */
export function isCensoredValueText(valueText: string | null | undefined): boolean {
  return hasLeadingComparator(valueText);
}

export function validateMeasurementCorrection(options: {
  base: BaseMeasurement;
  override: unknown;
  correctionReason: string | null | undefined;
  /** The definition the row is currently bound to, when it is resolved. */
  boundDefinitionKey?: string | null;
  /** Set when the caller has been told the correction costs the binding. */
  acknowledgeDefinitionLoss?: boolean;
  now?: Date;
}): MeasurementCorrectionResult {
  if (!options.correctionReason || options.correctionReason.trim() === "") {
    return fail(
      "correction_reason_required",
      "correction_reason",
      "Say why you are correcting this result."
    );
  }

  const parsed = parseMeasurementOverride(options.override);
  if (!parsed.ok) return parsed;
  const override = parsed.override;

  // The database check is intentionally keyed to fields present in the
  // override, not to the raw value that happens to fill an omitted field.
  // Keeping the same invariant here avoids a request that passes application
  // validation only to fail with a less actionable database error.
  if ("value_kind" in override) {
    if (
      override.value_kind === "numeric" &&
      (!("value" in override) || override.value == null)
    ) {
      return fail(
        "value_kind_requires_value",
        "value",
        "A numeric result restatement must include a number.",
      );
    }
    if (
      override.value_kind !== "numeric" &&
      (!("value_text" in override) || !override.value_text?.trim())
    ) {
      return fail(
        "value_kind_requires_text",
        "value_text",
        "A non-numeric result restatement must include the printed text.",
      );
    }
  }

  const measurement = applyMeasurementOverride(options.base, override);
  if (measurement.valueKind !== "numeric" && measurement.value != null) {
    return fail(
      "value_kind_requires_text",
      "value",
      "A non-numeric result cannot retain a numeric value; clear Value and provide the printed text.",
    );
  }

  if (measurement.valueKind === "numeric" && measurement.value == null) {
    return fail(
      "value_kind_requires_value",
      "value",
      "A numeric result needs a number."
    );
  }
  if (measurement.valueKind !== "numeric" && !measurement.valueText?.trim()) {
    return fail(
      "value_kind_requires_text",
      "value_text",
      "A non-numeric result needs the printed text."
    );
  }

  // #108: a comparator is a censoring statement, not a magnitude. Keeping it as
  // text is the only reading that does not attribute an invented number to the
  // reviewer.
  if (isCensoredValueText(measurement.valueText) && measurement.valueKind === "numeric") {
    return fail(
      "censored_value_requires_text",
      "value_kind",
      "A result reported with < or > is kept as printed text, not as a number.",
      { observed: measurement.valueText ?? undefined }
    );
  }

  if (
    measurement.refLow != null &&
    measurement.refHigh != null &&
    measurement.refLow > measurement.refHigh
  ) {
    return fail(
      "reference_range_inverted",
      "ref_low",
      "The reference range starts above where it ends."
    );
  }

  if ("observed_at" in override && measurement.observedAt !== null) {
    if (measurement.observedAt > (options.now ?? new Date()).toISOString().slice(0, 10)) {
      return fail("observed_at_in_future", "observed_at", "The date cannot be in the future.");
    }
  }

  let losesDefinitionBinding = false;

  if ("unit" in override) {
    const normalized = normalizeMeasurementUnit(measurement.unit);
    if (!normalized.normalizedUnit) {
      return fail("unit_unsupported", "unit", "That unit is not recognized.", {
        observed: measurement.unit ?? undefined,
      });
    }

    const boundDefinition = options.boundDefinitionKey
      ? getMeasurementDefinition(options.boundDefinitionKey)
      : null;

    if (boundDefinition) {
      const compatibility = evaluateUnitCompatibility(boundDefinition.unitPolicy, normalized);
      if (compatibility.disposition === "conflict") {
        losesDefinitionBinding = true;
        if (!options.acknowledgeDefinitionLoss) {
          const code =
            compatibility.evidence.code === "unit_dimension_conflict"
              ? "unit_dimension_conflict"
              : "unit_unsupported";
          const dimensions = boundDefinition.unitPolicy.dimensions;
          return fail(
            code,
            "unit",
            `${normalized.normalizedUnit} does not measure ${dimensions.join(" or ")}. ` +
              "Saving it leaves this result without its measurement mapping.",
            { observed: normalized.normalizedUnit, expected: dimensions }
          );
        }
      }
    } else if (!normalized.dimension) {
      return fail("unit_unsupported", "unit", "That unit is not recognized.", {
        observed: measurement.unit ?? undefined,
      });
    }
  }

  return { ok: true, override, measurement, losesDefinitionBinding };
}
