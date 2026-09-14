import { createHash } from "node:crypto";
import type { MeasurementResolutionInput } from "@/lib/biomarkers";
import type { PreparedEvidence } from "./measurement-evidence-admission";

/** Increment when the allowlisted canonical record changes incompatibly. */
export const MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION = "1" as const;

type CanonicalIdentityRecord = Readonly<{
  formatVersion: typeof MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION;
  rawEvidence: Readonly<{
    label: string;
    unit: string | null;
    valueText: string | null;
    valueKind: string;
  }>;
  effectiveMeasurement: Readonly<{
    value: number | null;
    valueText: string | null;
    valueKind: string;
    ordinal: number | null;
    unit: string | null;
    referenceLow: number | null;
    referenceHigh: number | null;
  }>;
  axes: Readonly<{
    specimen: string | null;
    specimenSource: string | null;
    sourceAnalyteKey: string | null;
    proposedKey: string | null;
    modifier: string | null;
    timing: string | null;
    method: string | null;
    laboratory: string | null;
    sectionSupport: string | null;
    neighbourLabels: readonly string[];
  }>;
  panelSpecimenPolicy: Readonly<{
    status: string;
    policyKey: string | null;
    effectiveSpecimen: string | null;
    sourceAnalyteKey: string | null;
    sourceProvenance: Readonly<{
      kind: string;
      sourceRecordKey: string;
    }> | null;
    conflictPolicyKeys: readonly string[];
  }>;
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
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Measurement identity cannot serialize ${typeof value}`);
}

function identityRecord(prepared: PreparedEvidence): CanonicalIdentityRecord {
  const input = prepared.input;
  const measurement = prepared.effectiveMeasurement;
  const panel = prepared.panelSpecimenPolicy;
  const sourceProvenance = panel.sourceProvenance
    ? {
        kind: canonicalText(panel.sourceProvenance.kind) ?? "",
        sourceRecordKey:
          canonicalText(panel.sourceProvenance.sourceRecordKey) ?? "",
      }
    : null;
  return {
    formatVersion: MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
    rawEvidence: {
      label: canonicalText(input.rawLabel) ?? "",
      unit: canonicalText(prepared.rawUnit),
      valueText: canonicalText(input.rawValueText),
      valueKind: prepared.baseMeasurement.valueKind,
    },
    effectiveMeasurement: {
      value: measurement.value,
      valueText: canonicalText(measurement.valueText),
      valueKind: measurement.valueKind,
      ordinal: measurement.ordinal,
      unit: canonicalText(measurement.unit),
      referenceLow: measurement.refLow,
      referenceHigh: measurement.refHigh,
    },
    axes: {
      specimen: canonicalText(input.specimen),
      specimenSource: canonicalText(input.specimenSource),
      sourceAnalyteKey: canonicalText(prepared.sourceAnalyteKey),
      proposedKey: canonicalText(prepared.proposedKey),
      modifier: canonicalText(input.modifier),
      timing: canonicalText(input.timing),
      method: canonicalText(input.method),
      laboratory: canonicalText(input.laboratory),
      sectionSupport:
        input.section === "captured_section" ? "captured_section" : null,
      neighbourLabels: sortedUnique(
        (input.neighbourLabels ?? []).map(
          (value) => canonicalText(value) ?? "",
        ),
      ),
    },
    panelSpecimenPolicy: {
      status: panel.status,
      policyKey: canonicalText(panel.policyKey),
      effectiveSpecimen: canonicalText(panel.effectiveSpecimen),
      sourceAnalyteKey: canonicalText(panel.sourceAnalyteKey),
      sourceProvenance,
      conflictPolicyKeys: sortedUnique(
        panel.conflictPolicyKeys.map((value) => canonicalText(value) ?? ""),
      ),
    },
  };
}

/** Builds the versioned, privacy-safe identity of one prepared evidence record. */
export function buildPreparedEvidenceIdentity(
  prepared: PreparedEvidence,
): PreparedEvidenceIdentity {
  const record = identityRecord(prepared);
  const hash = createHash("sha256")
    .update(canonicalJson(record), "utf8")
    .digest("hex");
  return {
    formatVersion: MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
    record,
    hash,
  };
}

/**
 * Canonicalizes a direct already-prepared Resolver fixture for compatibility
 * with existing pure Resolver verification. Production source rows use
 * `buildPreparedEvidenceIdentity` instead.
 */
export function buildDirectResolverInputIdentity(
  input: MeasurementResolutionInput,
): Readonly<{
  formatVersion: typeof MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION;
  hash: string;
}> {
  const record = {
    formatVersion: MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
    rawLabel: canonicalText(input.rawLabel) ?? "",
    rawUnit: canonicalText(input.rawUnit),
    rawValueText: canonicalText(input.rawValueText),
    valueKind: input.valueKind ?? null,
    specimen: canonicalText(input.specimen),
    specimenSource: canonicalText(input.specimenSource),
    sourceAnalyteKey: canonicalText(input.sourceAnalyteKey),
    panelSpecimenPolicy: input.panelSpecimenPolicy ?? null,
    modifier: canonicalText(input.modifier),
    timing: canonicalText(input.timing),
    method: canonicalText(input.method),
    laboratory: canonicalText(input.laboratory),
    section:
      input.section === "captured_section"
        ? "captured_section"
        : canonicalText(input.section),
    neighbourLabels: sortedUnique(
      (input.neighbourLabels ?? []).map((value) => canonicalText(value) ?? ""),
    ),
    referenceLow: input.referenceLow ?? null,
    referenceHigh: input.referenceHigh ?? null,
    proposedKey: canonicalText(input.proposedKey),
  };
  return {
    formatVersion: MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
    hash: createHash("sha256")
      .update(canonicalJson(record), "utf8")
      .digest("hex"),
  };
}
