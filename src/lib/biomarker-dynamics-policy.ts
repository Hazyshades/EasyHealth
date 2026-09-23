import { normalizeComparisonUnit } from "@/lib/biomarker-comparison";

/** Frozen version for numeric movement labels. These are not clinical cutoffs. */
export const BIOMARKER_DIRECTION_POLICY_VERSION = "eh-149-direction-v1";

export type BiomarkerDirectionTolerance = Readonly<{
  measurementDefinitionKey: string;
  displayUnit: string;
  absolute: number;
  relative: number;
  policyVersion: string;
  reviewStatus: "reviewed";
}>;

function policyEntry(
  measurementDefinitionKey: string,
  displayUnit: string,
  absolute: number,
): BiomarkerDirectionTolerance {
  return {
    measurementDefinitionKey,
    displayUnit: normalizeComparisonUnit(displayUnit),
    absolute,
    relative: 0.01,
    policyVersion: BIOMARKER_DIRECTION_POLICY_VERSION,
    reviewStatus: "reviewed",
  };
}

/**
 * Only definitions with explicit reviewed thresholds belong in this policy.
 * Registry definitions without an entry remain `direction_policy_unavailable`.
 * Converted units use the same numeric movement threshold expressed in that
 * display unit.
 */
const explicitPolicyEntries: readonly BiomarkerDirectionTolerance[] = [
  ...[
    "glucose_serum",
    "glucose_plasma",
    "glucose_whole_blood",
    "fasting_glucose",
    "post_prandial_glucose_plasma",
  ].flatMap((measurementDefinitionKey) => [
    policyEntry(measurementDefinitionKey, "mmol/L", 0.1),
    policyEntry(measurementDefinitionKey, "mg/dL", 1.8),
  ]),
  policyEntry("hba1c_whole_blood", "%", 0.1),
  policyEntry("hba1c_whole_blood", "mmol/mol", 1.09),
  policyEntry("creatinine_serum", "µmol/L", 1),
  policyEntry("creatinine_serum", "umol/L", 1),
  policyEntry("creatinine_serum", "mg/dL", 0.0113),
];

export const BIOMARKER_DIRECTION_TOLERANCE_POLICY = explicitPolicyEntries;

const policyByKey = new Map(
  BIOMARKER_DIRECTION_TOLERANCE_POLICY.map((entry) => [
    `${entry.measurementDefinitionKey}::${entry.displayUnit}`,
    entry,
  ]),
);

export function getBiomarkerDirectionTolerance(
  measurementDefinitionKey: string,
  displayUnit: string | null | undefined,
): BiomarkerDirectionTolerance | null {
  const unit = normalizeComparisonUnit(displayUnit);
  if (!unit) return null;
  return policyByKey.get(`${measurementDefinitionKey}::${unit}`) ?? null;
}
