import type {
  MeasurementResolutionInput,
  PanelSpecimenPolicyContext,
  SpecimenKey,
} from "@/lib/biomarkers";
import { snakeCaseToken } from "@/lib/biomarkers";
import {
  matchReviewedPanelSpecimenPolicy,
  type PanelSpecimenPolicy,
  type ReviewedPanelSpecimenPolicyMatch,
} from "@/lib/biomarkers/panel-specimen-policy";
import {
  applyMeasurementOverride,
  type BaseMeasurement,
  type MeasurementOverride,
  type MeasurementValueKindKey,
} from "./observation-measurement-correction";
import { statedAxisValue, type RowProvenance } from "./stated-axis-evidence";

/**
 * Row-neutral source envelope for Resolver evidence preparation.
 *
 * Adapters translate database or fixture rows into this shape. They do not
 * decide whether an extracted axis is evidence; that decision belongs to
 * `prepareMeasurementEvidence`.
 */
export type MeasurementEvidenceSource = Readonly<{
  baseMeasurement: BaseMeasurement;
  override?: MeasurementOverride | null;
  rawLabel: string;
  rawUnit?: string | null;
  rawValueText?: string | null;
  sourceText?: string | null;
  sectionContext?: string | null;
  sourceAnalyteKey?: string | null;
  proposedKey?: string | null;
  panelSpecimenPolicies?: readonly PanelSpecimenPolicy[];
  specimen?: string | null;
  modifier?: string | null;
  timing?: string | null;
  method?: string | null;
  neighbourLabels?: readonly string[];
  laboratory?: string | null;
}>;

export type PreparedEvidence = Readonly<{
  baseMeasurement: BaseMeasurement;
  effectiveMeasurement: BaseMeasurement;
  override: MeasurementOverride | null;
  rawUnit: string | null;
  provenance: RowProvenance;
  sourceAnalyteKey: string | null;
  proposedKey: string | null;
  panelSpecimenPolicy: PanelSpecimenPolicyContext;
  input: MeasurementResolutionInput;
}>;

const NON_EVIDENCE_AXIS_VALUES: Readonly<Record<string, true>> = {
  "": true,
  none: true,
  unknown: true,
  unspecified: true,
};

function canonicalAxis(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = snakeCaseToken(value.trim());
  return NON_EVIDENCE_AXIS_VALUES[normalized] ? null : normalized || null;
}

function canonicalAnalyte(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function canonicalLabel(value: string): string {
  return value.normalize("NFKC").trim();
}

function canonicalNeighbours(values: readonly string[] | undefined): string[] {
  const unique = new Set<string>();
  for (const value of values ?? []) {
    const normalized = canonicalLabel(value);
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort();
}

function effectiveRawValueText(
  source: MeasurementEvidenceSource,
  measurement: BaseMeasurement,
): string | null {
  // This field is raw evidence, so a measurement correction must not rewrite
  // the printed value. The corrected value remains in effectiveMeasurement.
  return (
    source.rawValueText ??
    source.baseMeasurement.valueText ??
    measurement.valueText ??
    null
  );
}

function effectiveInputValueKind(
  valueKind: MeasurementValueKindKey,
): MeasurementResolutionInput["valueKind"] {
  return valueKind === "numeric" ||
    valueKind === "qualitative" ||
    valueKind === "ordinal"
    ? valueKind
    : null;
}

function panelContextFor(
  sourceAnalyteKey: string | null,
  statedSpecimen: SpecimenKey | null,
  match: ReviewedPanelSpecimenPolicyMatch,
): PanelSpecimenPolicyContext {
  if (statedSpecimen) {
    return {
      status: "stated",
      policyKey: null,
      effectiveSpecimen: statedSpecimen,
      sourceAnalyteKey,
      sourceProvenance: null,
      conflictPolicyKeys: [],
    };
  }
  if (match.status === "matched" && match.policy) {
    return {
      status: "applied",
      policyKey: match.policy.key,
      effectiveSpecimen: match.policy.specimen,
      sourceAnalyteKey,
      sourceProvenance: match.policy.sourceProvenance,
      conflictPolicyKeys: [],
    };
  }
  if (match.status === "conflict") {
    return {
      status: "conflict",
      policyKey: null,
      effectiveSpecimen: null,
      sourceAnalyteKey,
      sourceProvenance: null,
      conflictPolicyKeys: [...match.policyKeys],
    };
  }
  return {
    status: "no_match",
    policyKey: null,
    effectiveSpecimen: null,
    sourceAnalyteKey,
    sourceProvenance: null,
    conflictPolicyKeys: [],
  };
}

/**
 * Applies one deterministic evidence-admission order. The returned object is
 * immutable by convention: every consumer receives this same prepared record,
 * rather than rebuilding a Resolver input from the source row.
 */
export function prepareMeasurementEvidence(
  source: MeasurementEvidenceSource,
): PreparedEvidence {
  const effectiveMeasurement = applyMeasurementOverride(
    source.baseMeasurement,
    source.override,
  );
  const provenance: RowProvenance = {
    label: source.rawLabel,
    sourceText: source.sourceText ?? null,
    sectionContext: source.sectionContext ?? null,
  };
  const sourceAnalyteKey = canonicalAnalyte(source.sourceAnalyteKey);
  const rawStatedSpecimen = statedAxisValue(
    "specimen",
    source.specimen ?? null,
    provenance,
  );
  const statedSpecimen = canonicalAxis(rawStatedSpecimen) as SpecimenKey | null;
  const match = statedSpecimen
    ? ({
        status: "no_match",
        policies: [],
        policyKeys: [],
        policy: null,
      } as const)
    : matchReviewedPanelSpecimenPolicy(
        source.sectionContext,
        sourceAnalyteKey,
        source.panelSpecimenPolicies,
      );
  const panelSpecimenPolicy = panelContextFor(
    sourceAnalyteKey,
    statedSpecimen,
    match,
  );
  const specimen = panelSpecimenPolicy.effectiveSpecimen;
  const specimenSource =
    panelSpecimenPolicy.status === "stated"
      ? "stated"
      : panelSpecimenPolicy.status === "applied"
        ? "reviewed_panel_policy"
        : null;
  const modifier = canonicalAxis(
    statedAxisValue("modifier", source.modifier ?? null, provenance),
  );
  const timing = canonicalAxis(
    statedAxisValue("timing", source.timing ?? null, provenance),
  );
  const method = canonicalAxis(
    statedAxisValue("method", source.method ?? null, provenance),
  );
  const rawUnit =
    source.override && "unit" in source.override
      ? (source.override.unit ?? null)
      : (source.rawUnit ?? effectiveMeasurement.unit ?? null);
  const rawValueText = effectiveRawValueText(source, effectiveMeasurement);
  const input: MeasurementResolutionInput = {
    rawLabel: canonicalLabel(source.rawLabel),
    rawUnit,
    rawValueText,
    valueKind: effectiveInputValueKind(effectiveMeasurement.valueKind),
    specimen,
    specimenSource,
    sourceAnalyteKey,
    panelSpecimenPolicy,
    modifier,
    timing: timing as MeasurementResolutionInput["timing"],
    method,
    section: source.sectionContext?.trim() ? "captured_section" : null,
    neighbourLabels: canonicalNeighbours(source.neighbourLabels),
    referenceLow: effectiveMeasurement.refLow,
    referenceHigh: effectiveMeasurement.refHigh,
    proposedKey: canonicalAnalyte(source.proposedKey),
    laboratory: canonicalAnalyte(source.laboratory),
  };
  return {
    baseMeasurement: source.baseMeasurement,
    rawUnit: source.rawUnit ?? source.baseMeasurement.unit ?? null,
    effectiveMeasurement,
    override: source.override ?? null,
    provenance,
    sourceAnalyteKey,
    proposedKey: canonicalAnalyte(source.proposedKey),
    panelSpecimenPolicy,
    input,
  };
}

/** Adds the document date for an observation payload without changing evidence. */
export function measurementAtObservedDate(
  prepared: PreparedEvidence,
  observedAt: string | null,
): BaseMeasurement {
  const correctedObservedAt =
    prepared.override && "observed_at" in prepared.override
      ? prepared.effectiveMeasurement.observedAt
      : null;
  return {
    ...prepared.effectiveMeasurement,
    observedAt: correctedObservedAt ?? observedAt,
  };
}
