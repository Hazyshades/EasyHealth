/**
 * Full unit checks for biomarker catalog (run via `npx tsx`).
 */
import assert from "node:assert/strict";
import {
  getBiomarkerDefinition,
  presentObservation,
  resolveCanonicalKey,
} from "../src/lib/biomarkers";
import {
  buildHealthProfile,
  computeSystemDataConfidence,
  computeSystemStateScore,
  getSystemForMarker,
} from "../src/lib/health-systems";

function approx(a: number, b: number, eps = 0.05) {
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
}

// Aliases
assert.equal(resolveCanonicalKey("Na", "Sodium"), "sodium");
assert.equal(resolveCanonicalKey("lp_a", "Lp(a)"), "lpa");
assert.equal(resolveCanonicalKey("TSAT", "Transferrin saturation"), "transferrin_saturation");
assert.equal(resolveCanonicalKey("25-OH Vitamin D", ""), "vitamin_d");
assert.equal(resolveCanonicalKey("CO2", "Carbon dioxide"), "bicarbonate");
assert.equal(resolveCanonicalKey("hba1c", "HbA1c"), "hba1c");

// Systems
assert.equal(getSystemForMarker("crp"), "inflammation");
assert.equal(getSystemForMarker("ferritin"), "blood");
assert.equal(getSystemForMarker("vitamin_d"), "nutrients");
assert.equal(getSystemForMarker("sodium"), "kidney");
assert.equal(getSystemForMarker("albumin"), "liver");
assert.equal(getSystemForMarker("na"), "kidney");

// Score roles
assert.equal(getBiomarkerDefinition("apob")?.scoreRole, "extended");
assert.equal(getBiomarkerDefinition("tsh")?.scoreRole, "core");
assert.equal(getBiomarkerDefinition("free_t4")?.scoreRole, "core");
assert.equal(getBiomarkerDefinition("psa")?.scoreRole, "display");

// Unit conversions
const glucoseSi = presentObservation(
  { biomarker_key: "glucose", value: 90, unit: "mg/dL", ref_low: 70, ref_high: 99 },
  "si"
);
assert.equal(glucoseSi.converted, true);
approx(glucoseSi.value, 90 * 0.0555);
approx(glucoseSi.ref_low!, 70 * 0.0555);
assert.equal(glucoseSi.unit, "mmol/L");

const tg = presentObservation(
  { biomarker_key: "triglycerides", value: 150, unit: "mg/dL", ref_low: null, ref_high: null },
  "si"
);
approx(tg.value, 150 * 0.0113);

const chol = presentObservation(
  { biomarker_key: "ldl", value: 100, unit: "mg/dL", ref_low: null, ref_high: null },
  "si"
);
approx(chol.value, 100 * 0.0259);

const creat = presentObservation(
  { biomarker_key: "creatinine", value: 1.0, unit: "mg/dL", ref_low: null, ref_high: null },
  "si"
);
approx(creat.value, 88.4, 0.5);

const vitD = presentObservation(
  { biomarker_key: "vitamin_d", value: 30, unit: "ng/mL", ref_low: null, ref_high: null },
  "si"
);
approx(vitD.value, 75, 0.1);

const hba1c = presentObservation(
  { biomarker_key: "hba1c", value: 6.5, unit: "%", ref_low: null, ref_high: null },
  "si"
);
// Display rounds IFCC to integer mmol/mol
approx(hba1c.value, Math.round(10.93 * 6.5 - 23.5), 0.01);

const lpa = presentObservation(
  { biomarker_key: "lpa", value: 50, unit: "mg/dL", ref_low: null, ref_high: null },
  "si"
);
assert.equal(lpa.converted, false);
assert.equal(lpa.value, 50);

const egfr = presentObservation(
  { biomarker_key: "egfr", value: 90, unit: "mL/min/1.73 m²", ref_low: null, ref_high: null },
  "us"
);
assert.equal(egfr.converted, false);

// Double-convert guard: already SI glucose
const alreadySi = presentObservation(
  { biomarker_key: "glucose", value: 5.0, unit: "mmol/L", ref_low: 3.9, ref_high: 5.5 },
  "si"
);
assert.equal(alreadySi.converted, false);
assert.equal(alreadySi.value, 5.0);

// Health profile core-only score: extended out of range shouldn't dominate if core in range
const profile = buildHealthProfile(
  [
    {
      biomarker_key: "ldl",
      name: "LDL",
      value: 90,
      unit: "mg/dL",
      ref_low: 0,
      ref_high: 100,
      observed_at: "2026-01-01",
      document_id: null,
    },
    {
      biomarker_key: "apob",
      name: "ApoB",
      value: 200,
      unit: "mg/dL",
      ref_low: 0,
      ref_high: 90,
      observed_at: "2026-01-01",
      document_id: null,
    },
  ],
  []
);
const cardio = profile.systems.find((s) => s.id === "cardiovascular");
assert.ok(cardio);
assert.ok(cardio!.state_score >= 90, `core-only score should be high, got ${cardio!.state_score}`);

// Coverage uses coversConfidence set (blood without differentials still OK)
const bloodMarkers = [
  {
    key: "hemoglobin",
    name: "Hb",
    value: 14,
    unit: "g/dL",
    ref_low: 12,
    ref_high: 16,
    status: "in_range" as const,
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    score_role: "core" as const,
  },
  {
    key: "hematocrit",
    name: "Hct",
    value: 42,
    unit: "%",
    ref_low: 36,
    ref_high: 48,
    status: "in_range" as const,
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    score_role: "core" as const,
  },
  {
    key: "wbc",
    name: "WBC",
    value: 6,
    unit: "×10³/µL",
    ref_low: 4,
    ref_high: 11,
    status: "in_range" as const,
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    score_role: "core" as const,
  },
  {
    key: "rbc",
    name: "RBC",
    value: 5,
    unit: "×10⁶/µL",
    ref_low: 4,
    ref_high: 6,
    status: "in_range" as const,
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    score_role: "core" as const,
  },
  {
    key: "platelets",
    name: "PLT",
    value: 250,
    unit: "×10³/µL",
    ref_low: 150,
    ref_high: 400,
    status: "in_range" as const,
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    score_role: "core" as const,
  },
  {
    key: "mcv",
    name: "MCV",
    value: 90,
    unit: "fL",
    ref_low: 80,
    ref_high: 100,
    status: "in_range" as const,
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    score_role: "core" as const,
  },
  {
    key: "rdw",
    name: "RDW",
    value: 13,
    unit: "%",
    ref_low: 11,
    ref_high: 15,
    status: "in_range" as const,
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    score_role: "core" as const,
  },
  {
    key: "ferritin",
    name: "Ferritin",
    value: 80,
    unit: "ng/mL",
    ref_low: 30,
    ref_high: 400,
    status: "in_range" as const,
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    score_role: "core" as const,
  },
];
const conf = computeSystemDataConfidence("blood", bloodMarkers);
assert.ok(conf >= 80, `blood confidence expected high without differentials, got ${conf}`);
assert.ok(computeSystemStateScore(bloodMarkers) >= 90);

console.log("verify-biomarkers: all checks passed");
