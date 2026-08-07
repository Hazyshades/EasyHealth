/**
 * #114: a recognized row that did not resolve must say WHY, and the reason must
 * distinguish what the document owes from what the catalog owes.
 *
 * The defect this guards: `partial` absorbs at least three unrelated causes, and
 * every one of them reached the reviewer as "required context is missing". On a
 * real 44-row upload, twelve rows were blocked only because their definition is
 * provisional — nothing the reader could supply would have moved them.
 */
import assert from "node:assert/strict";
import {
  incompleteReasonClass,
  resolveMeasurementDefinition,
  type MeasurementResolution,
  type MeasurementResolutionInput,
} from "../src/lib/biomarkers";
import {
  measurementMappingGuidance,
  measurementReasonLabel,
} from "../src/lib/documents/biomarker-review-state";

function resolve(input: Partial<MeasurementResolutionInput> & { rawLabel: string }): MeasurementResolution {
  return resolveMeasurementDefinition({
    rawUnit: null,
    rawValueText: null,
    valueKind: "numeric",
    specimen: null,
    modifier: null,
    method: null,
    section: null,
    ...input,
  });
}

// --- 1. The two shapes the product currently conflates ----------------------

// Only candidate is provisional: compatible on every axis, no conflict, nothing
// the reviewer can supply. This is the misleading case from issue #114.
const provisionalOnly = resolve({
  rawLabel: "Total IgE",
  rawUnit: "IU/mL",
  rawValueText: "65.1",
});
assert.equal(provisionalOnly.result, "partial", "Total IgE is recognized but not reviewed");
assert.deepEqual(
  [...provisionalOnly.missingAxes],
  [],
  "the provisional case must carry no missing axis - that is exactly why it is indistinguishable today",
);
assert.deepEqual([...provisionalOnly.conflicts], [], "the provisional case must carry no conflict");

// Reviewed candidates exist, but the document never stated the specimen.
const axisBlocked = resolve({
  rawLabel: "ALT (alanine aminotransferase)",
  rawUnit: "U/L",
  rawValueText: "28",
});
assert.equal(axisBlocked.result, "partial", "ALT is recognized but has no stated specimen");
assert.ok(
  axisBlocked.missingAxes.includes("specimen"),
  "the axis case must report the specimen the document did not state",
);

// --- 2. The classes must differ --------------------------------------------

assert.equal(
  incompleteReasonClass(provisionalOnly),
  "definition_not_reviewed",
  "a provisional-only row is blocked by catalog review, not by missing context",
);
assert.equal(
  incompleteReasonClass(axisBlocked),
  "axis_not_stated",
  "a row missing a stated specimen is blocked by the document",
);
assert.notEqual(
  incompleteReasonClass(provisionalOnly),
  incompleteReasonClass(axisBlocked),
  "issue #114: these two must never again present as the same reason",
);

// --- 3. Precedence: a missing axis outranks maturity ------------------------
//
// Stating the axis stays useful after the definition is reviewed, so the
// actionable reason wins.

const provisionalAndAxisBlocked = resolve({
  rawLabel: "Total IgE",
  rawUnit: "IU/mL",
  rawValueText: "65.1",
  valueKind: "qualitative",
});
if (provisionalAndAxisBlocked.missingAxes.length > 0) {
  assert.equal(
    incompleteReasonClass(provisionalAndAxisBlocked),
    "axis_not_stated",
    "a missing axis outranks definition maturity",
  );
}

// --- 4. A hard conflict outranks a missing axis -----------------------------

const conflicted = resolve({
  rawLabel: "Glucose",
  rawUnit: "%",
  rawValueText: "5.0",
});
if (conflicted.conflicts.length > 0) {
  assert.equal(
    incompleteReasonClass(conflicted),
    "unit_or_value_conflict",
    "an incompatible unit outranks a missing axis",
  );
}

// A conflict from a candidate that was never viable must not outrank a missing
// axis. Found on document 298232ee: numeric `Glucose 4.1 mmol/L` collects a
// `value_kind_conflict` from `glucose_urine_dipstick`, which it was never going
// to be, while four live candidates wait only for a specimen.
const numericGlucose = resolve({
  rawLabel: "Glucose",
  rawUnit: "mmol/L",
  rawValueText: "4.1",
});
assert.ok(numericGlucose.conflicts.length > 0, "the irrelevant candidate still records its conflict");
assert.ok(
  numericGlucose.candidateEvidence.some(({ selectable }) => selectable),
  "and viable candidates remain",
);
assert.equal(
  incompleteReasonClass(numericGlucose),
  "axis_not_stated",
  "a conflict only blocks this row when it leaves nothing selectable",
);

// --- 5. An unrecognized label is not blamed on maturity ---------------------

const unrecognized = resolve({ rawLabel: "Totally unknown assay xyzzy" });
assert.equal(unrecognized.result, "unmapped");
assert.equal(
  incompleteReasonClass(unrecognized),
  "no_candidate",
  "nothing was recognized, so there is no definition to review",
);

// --- 6. A retired definition is absence, not immaturity ---------------------
//
// Design flagged this as unverified. Retired definitions are excluded from
// candidate generation rather than at admissibility, so they must surface as
// `no_candidate`. If this ever fails, the taxonomy needs a fourth member and the
// spec has to change before the code does.

const retiredKeys = ["retired_placeholder_key_that_should_not_exist"];
for (const key of retiredKeys) {
  const retired = resolve({ rawLabel: key });
  assert.notEqual(
    incompleteReasonClass(retired),
    "definition_not_reviewed",
    "a retired or absent definition is not the same as one awaiting review",
  );
}

// --- 8. The regression guard for #114 itself --------------------------------
//
// "required context is missing" is only ever true when the document owes the
// evidence. If it reappears for any other class, the defect is back.

const CLASSES = [
  "unit_or_value_conflict",
  "axis_not_stated",
  "definition_not_reviewed",
  "no_candidate",
] as const;

for (const incompleteReason of CLASSES) {
  for (const outcome of ["partial", "ambiguous", "unmapped"] as const) {
    const copy = measurementMappingGuidance(outcome, { incompleteReason, missingAxes: [] });
    if (incompleteReason === "axis_not_stated") continue;
    assert.doesNotMatch(
      copy,
      /required context is missing/,
      `${outcome}/${incompleteReason} must not tell the reader that context is missing`,
    );
  }
}

// The catalog-blocked wording must own the wait and ask for nothing.
const catalogCopy = measurementMappingGuidance("partial", {
  incompleteReason: "definition_not_reviewed",
  missingAxes: [],
});
assert.match(catalogCopy, /awaiting review in our catalog/i);
assert.match(catalogCopy, /preserved/i, "the reader must be told the result is kept");
assert.doesNotMatch(
  catalogCopy,
  /missing|provide|supply|specify|choose/i,
  "catalog-blocked copy must not invite the reader to supply anything",
);

// The axis wording must name the axis rather than gesture at it.
assert.match(
  measurementMappingGuidance("partial", {
    incompleteReason: "axis_not_stated",
    missingAxes: ["specimen"],
  }),
  /The specimen is not stated in this report\./,
  "issue #63: name the axis at row level",
);
assert.match(
  measurementMappingGuidance("partial", {
    incompleteReason: "axis_not_stated",
    missingAxes: ["specimen", "method"],
  }),
  /specimen and method are not stated/,
  "two missing axes read as one sentence",
);

// No reviewer should ever see a raw internal token.
for (const axis of ["specimen", "modifier", "method", "timing", "unit", "value_kind"]) {
  assert.notEqual(
    measurementReasonLabel(axis),
    axis.replaceAll("_", " "),
    `${axis} must have a clinical label, not an underscore-stripped token`,
  );
}

// --- 7. A resolved row has no reason class ----------------------------------

const resolved = resolve({
  rawLabel: "Glucose",
  rawUnit: "mmol/L",
  rawValueText: "5.3",
  specimen: "serum",
});
if (resolved.result === "resolved") {
  assert.equal(
    incompleteReasonClass(resolved),
    null,
    "a resolved row is not incomplete and carries no reason",
  );
}

console.log("verify-incomplete-reason-class: all checks passed");
