/**
 * #105: alias admission must not depend on label token order.
 *
 * The extractor rephrases parenthetical laboratory labels non-deterministically
 * — `ALT (alanine aminotransferase)` as printed becomes
 * `Alanine aminotransferase (ALT)` on some runs. Alias matching compares an
 * ordered token sequence, so the reordered spelling admits no candidate at all
 * and the row collapses to `unmapped` even though ALT is a reviewed definition.
 *
 * These checks assert outcome parity between the two orderings, and pin the two
 * relaxations that must NOT follow from order-insensitive matching: token
 * containment and single-token widening.
 */
import assert from "node:assert/strict";
import {
  MEASUREMENT_DEFINITIONS,
  findAliasAdmissions,
  resolveMeasurementDefinition,
  snakeCaseToken,
  validateMeasurementRegistry,
  type MeasurementResolution,
  type MeasurementResolutionInput,
} from "../src/lib/biomarkers";

/** Labels exactly as printed in lab_data/sample_lab_report_english_mock.pdf. */
const PRINTED_LABELS: ReadonlyArray<
  readonly [label: string, unit: string | null, specimen: string | null]
> = [
  ["Total protein", "g/L", null],
  ["Glucose", "mmol/L", null],
  ["Total bilirubin", "umol/L", null],
  ["Direct bilirubin", "umol/L", null],
  ["ALT (alanine aminotransferase)", "U/L", null],
  ["AST (aspartate aminotransferase)", "U/L", null],
  ["C-reactive protein, quantitative", "mg/L", null],
  ["Antistreptolysin-O (ASO)", "IU/mL", null],
  ["Red blood cells (RBC)", "x10^12/L", "whole_blood"],
  ["Hemoglobin (HGB)", "g/L", "whole_blood"],
  ["Hematocrit (HCT)", "%", "whole_blood"],
  ["Mean corpuscular volume (MCV)", "fL", "whole_blood"],
  ["Mean corpuscular hemoglobin (MCH)", "pg", "whole_blood"],
  ["Mean corpuscular hemoglobin concentration (MCHC)", "g/L", "whole_blood"],
  ["Red cell distribution width (RDW)", "%", "whole_blood"],
  ["Platelets (PLT)", "x10^9/L", "whole_blood"],
  ["Mean platelet volume (MPV)", "fL", "whole_blood"],
  ["Platelet distribution width (PDW)", "%", "whole_blood"],
  ["Plateletcrit (PCT)", "%", "whole_blood"],
  ["White blood cells (WBC)", "x10^9/L", "whole_blood"],
  ["Neutrophils (NEU%)", "%", "whole_blood"],
  ["Neutrophils, absolute (NEU)", "x10^9/L", "whole_blood"],
  ["Lymphocytes (LYMF%)", "%", "whole_blood"],
  ["Lymphocytes, absolute (LYMF)", "x10^9/L", "whole_blood"],
  ["Monocytes (MON%)", "%", "whole_blood"],
  ["Monocytes, absolute (MON)", "x10^9/L", "whole_blood"],
  ["Eosinophils (EOS%)", "%", "whole_blood"],
  ["Eosinophils, absolute (EOS)", "x10^9/L", "whole_blood"],
  ["Basophils (BAS%)", "%", "whole_blood"],
  ["Basophils, absolute (BAS)", "x10^9/L", "whole_blood"],
  ["ESR, Westergren automated", "mm/hour", "whole_blood"],
  ["Segmented neutrophils", "%", "whole_blood"],
  ["Band neutrophils", "%", "whole_blood"],
  ["Lymphocytes, manual differential", "%", "whole_blood"],
  ["Monocytes, manual differential", "%", "whole_blood"],
  ["Eosinophils, manual differential", "%", "whole_blood"],
  ["Total IgE", "IU/mL", null],
  ["Eosinophilic cationic protein (ECP)", "ng/mL", null],
];

/** `Long name (ABBR)` <-> `ABBR (Long name)`; null when the label has no parenthetical. */
function swapParenthetical(label: string): string | null {
  const match = /^(.+?)\s*\(([^)]+)\)$/.exec(label.trim());
  if (!match) return null;
  const head = match[1]!.trim();
  const inner = match[2]!.trim();
  if (!head || !inner) return null;
  return `${inner.charAt(0).toUpperCase()}${inner.slice(1)} (${head})`;
}

function resolve(
  label: string,
  unit: string | null,
  specimen: string | null,
): MeasurementResolution {
  const input: MeasurementResolutionInput = {
    rawLabel: label,
    rawUnit: unit,
    valueKind: "numeric",
    specimen,
    modifier: null,
    method: null,
    section: null,
    referenceLow: null,
    referenceHigh: null,
    extractionConfidence: 0.9,
    proposedKey: null,
    rawValueText: null,
  };
  return resolveMeasurementDefinition(input);
}

function fingerprint(resolution: MeasurementResolution) {
  return {
    result: resolution.result,
    measurementDefinitionKey: resolution.measurementDefinitionKey,
    analyteKey: resolution.analyteKey,
    candidateKeys: [...resolution.candidateKeys].sort(),
    missingAxes: [...resolution.missingAxes].sort(),
    conflicts: [...resolution.conflicts].sort(),
  };
}

// --- 1. Outcome parity across both orderings -------------------------------

let comparedLabels = 0;
const parityFailures: string[] = [];

for (const [label, unit, specimen] of PRINTED_LABELS) {
  const swapped = swapParenthetical(label);
  if (!swapped) continue;
  comparedLabels += 1;

  const printedFingerprint = fingerprint(resolve(label, unit, specimen));
  const swappedFingerprint = fingerprint(resolve(swapped, unit, specimen));

  try {
    assert.deepEqual(swappedFingerprint, printedFingerprint);
  } catch {
    parityFailures.push(
      `${label}\n      printed: ${JSON.stringify(printedFingerprint)}\n      swapped: ${swapped} -> ${JSON.stringify(swappedFingerprint)}`,
    );
  }
}

assert.ok(
  comparedLabels >= 20,
  `expected the launch corpus to contribute at least 20 parenthetical labels, got ${comparedLabels}`,
);

assert.deepEqual(
  parityFailures,
  [],
  `label ordering must not change the resolver outcome:\n    ${parityFailures.join("\n    ")}`,
);

// --- 2. The reported ALT case ----------------------------------------------

const altPrinted = resolve("ALT (alanine aminotransferase)", "U/L", null);
const altSwapped = resolve("Alanine aminotransferase (ALT)", "U/L", null);

assert.equal(altPrinted.result, "partial");
assert.deepEqual([...altPrinted.candidateKeys].sort(), [
  "alt_plasma_catalytic_activity",
  "alt_serum_catalytic_activity",
]);
assert.deepEqual([...altPrinted.missingAxes], ["specimen"]);
assert.deepEqual(
  fingerprint(altSwapped),
  fingerprint(altPrinted),
  "the reordered ALT spelling must resolve exactly like the printed one",
);

// --- 3. Token CONTAINMENT must stay unmatched -------------------------------
//
// Order-insensitivity is set EQUALITY. A strict superset of an alias's tokens
// must not admit that alias, otherwise `Neutrophils, absolute (NEU)` would be
// admitted by an alias for `Neutrophils (NEU)`.

function admittedDefinitionKeys(label: string): string[] {
  return findAliasAdmissions({ rawLabel: label, laboratory: null })
    .map(({ definition }) => definition.key)
    .sort();
}

const supersetProbe = "Neutrophils absolute extra marker (NEU)";
const supersetTokens = new Set(snakeCaseToken(supersetProbe).split("_"));
for (const definition of MEASUREMENT_DEFINITIONS) {
  for (const alias of definition.aliases) {
    const aliasTokens = alias.normalizedValue.split("_").filter(Boolean);
    if (aliasTokens.length < 2) continue;
    const isStrictSubset =
      aliasTokens.every((token) => supersetTokens.has(token)) &&
      new Set(aliasTokens).size < supersetTokens.size;
    if (!isStrictSubset) continue;
    assert.ok(
      !admittedDefinitionKeys(supersetProbe).includes(definition.key),
      `token containment must not admit ${definition.key} for ${JSON.stringify(supersetProbe)}`,
    );
  }
}

// --- 4. Single-token labels gain nothing ------------------------------------

for (const singleToken of ["alt", "glucose", "hgb"]) {
  const before = admittedDefinitionKeys(singleToken);
  const reordered = admittedDefinitionKeys(singleToken.toUpperCase());
  assert.deepEqual(
    reordered,
    before,
    `single-token label ${singleToken} must admit the same definitions regardless of casing`,
  );
}

// A permutation of a real authored alias MUST be admitted — that is the fix.
assert.deepEqual(
  admittedDefinitionKeys("Aminotransferase alanine"),
  ["alt_serum_catalytic_activity", "alt_plasma_catalytic_activity"].sort(),
  "a permutation of the authored alias `alanine_aminotransferase` must be admitted",
);

// A token set that matches no authored alias MUST stay unadmitted.
assert.deepEqual(
  admittedDefinitionKeys("Flange widget calibration"),
  [],
  "a token set matching no authored alias must stay unadmitted",
);

// --- 5. The reported match mode is the one that fired -----------------------

const printedAdmission = findAliasAdmissions({
  rawLabel: "ALT (alanine aminotransferase)",
  laboratory: null,
});
const swappedAdmission = findAliasAdmissions({
  rawLabel: "Alanine aminotransferase (ALT)",
  laboratory: null,
});
assert.ok(
  printedAdmission.every(({ alias }) => alias.matchType === "normalized"),
  "the printed ordering must still be reported as an ordered normalized match",
);
assert.ok(
  swappedAdmission.length > 0 &&
    swappedAdmission.every(({ alias }) => alias.matchType === "token_set"),
  "the reordered spelling must report the token_set mode, not the authored one",
);
for (const { alias } of swappedAdmission) {
  const authored = MEASUREMENT_DEFINITIONS.flatMap((definition) => definition.aliases).find(
    (candidate) => candidate.key === alias.key,
  );
  assert.ok(authored, `admitted alias ${alias.key} must exist in the catalog`);
  assert.equal(alias.matchAuthority, authored!.matchAuthority);
  assert.equal(alias.approvalStatus, authored!.approvalStatus);
  assert.equal(alias.lifecycle, authored!.lifecycle);
  assert.deepEqual(alias.provenance, authored!.provenance);
}

// --- 6. Catalog invariant: no cross-analyte token-set collision -------------

const registry = validateMeasurementRegistry();
assert.deepEqual(
  registry.errors.filter((error) => error.includes("token-set projection")),
  [],
  "no two reviewed analytes may share a token-set projection",
);

// Specimen variants of ONE analyte legitimately share a projection and must not
// be reported as a collision.
const altSpecimenVariants = MEASUREMENT_DEFINITIONS.filter(
  (definition) => definition.analyteKey === "alt" && definition.maturity === "reviewed",
).map((definition) => definition.key);
assert.ok(
  altSpecimenVariants.length >= 2,
  "the ALT analyte must retain at least two reviewed specimen variants for this check to mean anything",
);
assert.ok(
  registry.valid,
  `registry validation must pass: ${registry.errors.join("; ")}`,
);

console.log(
  `verify-alias-order-insensitivity: all checks passed (${comparedLabels} parenthetical labels compared in both orderings)`,
);
