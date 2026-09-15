import { createHash } from "node:crypto";
import type {
  MeasurementResolutionInput,
  PanelSpecimenPolicyContext,
} from "@/lib/biomarkers";
import type { PreparedEvidence } from "./measurement-evidence-admission";

/** Increment when the allowlisted canonical record changes incompatibly. */
export const MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION = "1" as const;

type CanonicalPolicyContext = Readonly<{
  disposition: PanelSpecimenPolicyContext["status"];
  key: string | null;
  conflictingKeys: readonly string[];
  effectiveSpecimen: string | null;
  source: "stated" | "reviewed_panel_policy" | "none" | "unknown";
}>;

type CanonicalIdentityRecord = Readonly<{
  formatVersion: typeof MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION;
  rawLabel: string;
  rawUnit: string | null;
  rawValueText: string | null;
  valueKind: string | null;
  effectiveValue: number | null;
  effectiveValueText: string | null;
  effectiveValueKind: string | null;
  effectiveUnit: string | null;
  effectiveOrdinal: number | null;
  specimen: string | null;
  specimenSource: string | null;
  sourceAnalyteKey: string | null;
  policyContext: CanonicalPolicyContext;
  modifier: string | null;
  timing: string | null;
  method: string | null;
  sectionSupport: boolean;
  neighbourLabels: readonly string[];
  referenceLow: number | null;
  referenceHigh: number | null;
  proposedKey: string | null;
  laboratory: string | null;
}>;

export type PreparedEvidenceIdentity = Readonly<{
  formatVersion: typeof MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION;
  record: CanonicalIdentityRecord;
  hash: string;
}>;

function canonicalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  return normalized.length > 0 ? normalized : null;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort();
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error(
        "Measurement identity cannot contain a non-finite number",
      );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Measurement identity cannot serialize ${typeof value}`);
}

function policyContextFromInput(
  input: MeasurementResolutionInput,
): CanonicalPolicyContext {
  const panel = input.panelSpecimenPolicy;
  const disposition =
    panel?.status ??
    (input.specimenSource === "stated" ? "stated" : "no_match");
  const source =
    panel?.status === "stated"
      ? "stated"
      : panel?.status === "applied"
        ? "reviewed_panel_policy"
        : panel?.status === "no_match"
          ? "none"
          : panel?.status === "conflict"
            ? "unknown"
            : input.specimenSource === "stated"
              ? "stated"
              : input.specimenSource === "reviewed_panel_policy"
                ? "reviewed_panel_policy"
                : "unknown";
  return {
    disposition,
    key: canonicalText(panel?.policyKey),
    conflictingKeys: sortedUnique(
      (panel?.conflictPolicyKeys ?? []).map(
        (value) => canonicalText(value) ?? "",
      ),
    ),
    effectiveSpecimen: canonicalText(
      panel ? panel.effectiveSpecimen : input.specimen,
    ),
    source,
  };
}

function identityRecordFromInput(
  input: MeasurementResolutionInput,
  options: {
    rawUnit: string | null;
    rawValueKind: string | null;
    effectiveValue: number | null;
    effectiveValueText: string | null;
    effectiveValueKind: string | null;
    effectiveUnit: string | null;
    effectiveOrdinal: number | null;
  },
): CanonicalIdentityRecord {
  return {
    formatVersion: MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
    rawLabel: canonicalText(input.rawLabel) ?? "",
    rawUnit: canonicalText(options.rawUnit),
    rawValueText: canonicalText(input.rawValueText),
    valueKind: canonicalText(options.rawValueKind),
    effectiveValue: options.effectiveValue,
    effectiveValueText: canonicalText(options.effectiveValueText),
    effectiveValueKind: canonicalText(options.effectiveValueKind),
    effectiveUnit: canonicalText(options.effectiveUnit),
    effectiveOrdinal: options.effectiveOrdinal,
    specimen: canonicalText(input.specimen),
    specimenSource: canonicalText(input.specimenSource),
    sourceAnalyteKey: canonicalText(input.sourceAnalyteKey),
    policyContext: policyContextFromInput(input),
    modifier: canonicalText(input.modifier),
    timing: canonicalText(input.timing),
    method: canonicalText(input.method),
    sectionSupport: input.section === "captured_section",
    neighbourLabels: sortedUnique(
      (input.neighbourLabels ?? []).map(
        (value) => canonicalText(value) ?? "",
      ),
    ),
    referenceLow: input.referenceLow ?? null,
    referenceHigh: input.referenceHigh ?? null,
    proposedKey: canonicalText(input.proposedKey),
    laboratory: canonicalText(input.laboratory),
  };
}

function identityRecord(prepared: PreparedEvidence): CanonicalIdentityRecord {
  return identityRecordFromInput(prepared.input, {
    rawUnit: prepared.rawUnit,
    rawValueKind: prepared.baseMeasurement.valueKind,
    effectiveValue: prepared.effectiveMeasurement.value,
    effectiveValueText: prepared.effectiveMeasurement.valueText,
    effectiveValueKind: prepared.effectiveMeasurement.valueKind,
    effectiveUnit: prepared.effectiveMeasurement.unit,
    effectiveOrdinal: prepared.effectiveMeasurement.ordinal,
  });
}

function hashIdentityRecord(record: CanonicalIdentityRecord): string {
  return createHash("sha256")
    .update(canonicalJson(record), "utf8")
    .digest("hex");
}

/** Builds the versioned, privacy-safe identity of one prepared evidence record. */
export function buildPreparedEvidenceIdentity(
  prepared: PreparedEvidence,
): PreparedEvidenceIdentity {
  const record = identityRecord(prepared);
  return {
    formatVersion: MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
    record,
    hash: hashIdentityRecord(record),
  };
}

/**
 * Canonicalizes a direct Resolver fixture with the same format-1 record.
 * Production source rows use `buildPreparedEvidenceIdentity`.
 */
export function buildDirectResolverInputIdentity(
  input: MeasurementResolutionInput,
): Readonly<{
  formatVersion: typeof MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION;
  hash: string;
}> {
  const record = identityRecordFromInput(input, {
    rawUnit: input.rawUnit ?? null,
    rawValueKind: input.valueKind ?? null,
    effectiveValue: null,
    effectiveValueText: input.rawValueText ?? null,
    effectiveValueKind: input.valueKind ?? null,
    effectiveUnit: input.rawUnit ?? null,
    effectiveOrdinal: null,
  });
  return {
    formatVersion: MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
    hash: hashIdentityRecord(record),
  };
}
