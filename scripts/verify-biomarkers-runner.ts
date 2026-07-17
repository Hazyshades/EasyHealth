/**
 * Full unit checks for biomarker catalog (run via `npx tsx`).
 */
import assert from "node:assert/strict";
import {
  getMeasurementDefinitionsForAnalyte,
  getAnalyte,
  MEASUREMENT_DEFINITIONS,
  MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  normalizeMeasurementUnit,
  presentObservation,
  resolveMeasurementDefinition,
  serializeMeasurementRegistryManifest,
  validateMeasurementRegistry,
} from "../src/lib/biomarkers";
import { LAUNCH_CATALOG_MIGRATION_RECORDS, getLaunchCatalogRecord, getLaunchConversion, resolveLaunchCatalogKey } from "../src/lib/biomarkers/launch-registry";
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
assert.equal(resolveLaunchCatalogKey("Na", "Sodium"), "sodium");
assert.equal(resolveLaunchCatalogKey("lp_a", "Lp(a)"), "lpa");
assert.equal(resolveLaunchCatalogKey("TSAT", "Transferrin saturation"), "transferrin_saturation");
assert.equal(resolveLaunchCatalogKey("25-OH Vitamin D", ""), "vitamin_d");
assert.equal(resolveLaunchCatalogKey("CO2", "Carbon dioxide"), "bicarbonate");
assert.equal(resolveLaunchCatalogKey("hba1c", "HbA1c"), "hba1c");

// Context-aware measurement resolution never guesses a differential form.
assert.equal(
  resolveMeasurementDefinition({ rawLabel: "Neutrophils", rawUnit: "%", specimen: "whole_blood" })
    .measurementDefinitionKey,
  "neutrophils_percent"
);
assert.equal(
  resolveMeasurementDefinition({ rawLabel: "Neutrophils", rawUnit: "x10^9/L", specimen: "whole_blood" })
    .measurementDefinitionKey,
  "neutrophils_abs"
);
assert.equal(resolveMeasurementDefinition({ rawLabel: "Neutrophils" }).result, "partial");
assert.notEqual(
  resolveMeasurementDefinition({ rawLabel: "Glucose", rawUnit: "mg/dL", specimen: "serum" })
    .measurementDefinitionKey,
  "fasting_glucose"
);
assert.equal(
  resolveMeasurementDefinition({ rawLabel: "FPG", rawUnit: "mg/dL", specimen: "plasma", modifier: "fasting" })
    .measurementDefinitionKey,
  "fasting_glucose"
);
assert.equal(resolveMeasurementDefinition({ rawLabel: "RDW", rawUnit: "fL" }).result, "partial");

// Registry 2.1: unit dimensions, evidence, and mapping confidence are independent from OCR.
const neutrophilPercent = resolveMeasurementDefinition({
  rawLabel: "Neutrophils",
  rawUnit: "%",
  specimen: "whole_blood",
  extractionConfidence: 0.01,
});
assert.equal(neutrophilPercent.mappingConfidenceBand, "high");
assert.equal(neutrophilPercent.mappingConfidence, 0.95);
assert.ok(
  neutrophilPercent.candidateEvidence.some(
    (candidate) =>
      candidate.candidateKey === "neutrophils_abs" &&
      candidate.rejected.some((item) => item.code === "unit_dimension_conflict")
  )
);
const highOcrAmbiguous = resolveMeasurementDefinition({
  rawLabel: "Neutrophils",
  extractionConfidence: 0.99,
});
assert.equal(highOcrAmbiguous.result, "partial");
assert.equal(highOcrAmbiguous.mappingConfidenceBand, "medium");
assert.equal(normalizeMeasurementUnit("mg/dL").normalizedUnit, "mg/dl");
assert.equal(normalizeMeasurementUnit("mg/dL").dimension, "mass_concentration");
assert.equal(
  resolveMeasurementDefinition({ rawLabel: "FPG", rawUnit: "unknown-unit", specimen: "plasma" }).result,
  "partial"
);
assert.equal(
  resolveMeasurementDefinition({ rawLabel: "Glucose", rawUnit: "mg/dL", specimen: "urine" }).result,
  "partial"
);
assert.equal(resolveMeasurementDefinition({ rawLabel: "Glucose", rawUnit: "mg/dL", specimen: "serum" }).measurementDefinitionKey, "glucose_serum");
assert.equal(resolveMeasurementDefinition({ rawLabel: "Glucose", rawUnit: "mg/dL", specimen: "plasma" }).measurementDefinitionKey, "glucose_plasma");
assert.equal(getMeasurementDefinitionsForAnalyte("glucose").length, 5);
assert.equal(getLaunchConversion("glucose")?.type, "linear");
assert.ok(getAnalyte("neutrophils"));
assert.deepEqual(
  new Set(MEASUREMENT_DEFINITIONS.filter((definition) => definition.sourceProvenance.kind === "registry_v1_migration").map((definition) => definition.sourceProvenance.sourceRecordKey)),
  new Set(LAUNCH_CATALOG_MIGRATION_RECORDS.map((record) => record.sourceRecordKey))
);
assert.equal(validateMeasurementRegistry().valid, true);
assert.equal(
  serializeMeasurementRegistryManifest([...MEASUREMENT_DEFINITIONS].reverse()),
  serializeMeasurementRegistryManifest(MEASUREMENT_DEFINITIONS)
);
assert.equal(MEASUREMENT_CATALOG_MANIFEST_DIGEST.length, 64);

// Systems
assert.equal(getSystemForMarker("crp"), "inflammation");
assert.equal(getSystemForMarker("ferritin"), "blood");
assert.equal(getSystemForMarker("vitamin_d"), "nutrients");
assert.equal(getSystemForMarker("sodium"), "kidney");
assert.equal(getSystemForMarker("albumin"), "liver");
assert.equal(getSystemForMarker("na"), "kidney");

// Score roles
assert.equal(getLaunchCatalogRecord("apob")?.scoreRole, "extended");
assert.equal(getLaunchCatalogRecord("tsh")?.scoreRole, "core");
assert.equal(getLaunchCatalogRecord("free_t4")?.scoreRole, "core");
assert.equal(getLaunchCatalogRecord("ferritin")?.scoreRole, "extended");
assert.equal(getLaunchCatalogRecord("psa")?.scoreRole, "display");

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
assert.equal(cardio!.state_score, null);

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
assert.ok(conf >= 60, `blood confidence must remain useful with Registry 2.0 coverage, got ${conf}`);
assert.ok(computeSystemStateScore("blood", bloodMarkers)! >= 90);

// Qualitative + specialty non-score
import { parseLabValueCell, observationIdentityKey } from "../src/lib/biomarkers";

const neg = parseLabValueCell("Negative");
assert.equal(neg?.value_kind, "ordinal");
assert.equal(neg?.ordinal, 0);
assert.equal(neg?.value, null);

const twoPlus = parseLabValueCell("2+");
assert.equal(twoPlus?.ordinal, 3);

const num = parseLabValueCell("5.2");
assert.equal(num?.value_kind, "numeric");
assert.equal(num?.value, 5.2);

// PSA display-only does not tank cardiovascular score (core still wins on that system)
const psaProfile = buildHealthProfile(
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
      biomarker_key: "psa",
      name: "PSA",
      value: 20,
      unit: "ng/mL",
      ref_low: 0,
      ref_high: 4,
      observed_at: "2026-01-01",
      document_id: null,
      value_kind: "numeric",
    },
    {
      biomarker_key: "urine_ketones",
      name: "Ketones",
      value: null,
      unit: "",
      ref_low: null,
      ref_high: null,
      observed_at: "2026-01-01",
      document_id: null,
      value_kind: "ordinal",
      value_text: "Negative",
      ordinal: 0,
      specimen: "urine",
    },
  ],
  []
);
const systems = psaProfile.systems.map((s) => s.id);
assert.ok(systems.includes("cardiovascular"));
const cardioOnly = psaProfile.systems.find((s) => s.id === "cardiovascular");
assert.equal(cardioOnly?.state_score, null);
// General is factual-only and never receives a soft fallback score.
const general = psaProfile.systems.find((s) => s.id === "general");
if (general) {
  const psaOnly = computeSystemStateScore("general", general.markers.filter((m) => m.key === "psa"));
  assert.equal(psaOnly, null);
}

// General / display-only in-range markers remain unscored.
const generalInRange = buildHealthProfile(
  [
    {
      biomarker_key: "mpv",
      name: "Mean platelet volume (MPV)",
      value: 11.3,
      unit: "fL",
      ref_low: 6,
      ref_high: 13,
      observed_at: "2025-09-09",
      document_id: null,
    },
    {
      biomarker_key: "neutrophils_percent",
      name: "Neutrophils (NEU%)",
      value: 62.6,
      unit: "%",
      ref_low: 40,
      ref_high: 75,
      observed_at: "2025-09-09",
      document_id: null,
    },
    {
      biomarker_key: "total_ige",
      name: "Total IgE",
      value: 65.1,
      unit: "IU/mL",
      ref_low: 0,
      ref_high: 100,
      observed_at: "2025-09-09",
      document_id: null,
    },
  ],
  []
);
for (const sys of generalInRange.systems) {
  assert.equal(sys.state_score, null, `${sys.id} must not receive a soft fallback score`);
}

assert.equal(
  observationIdentityKey("creatinine", "serum", "none") !==
    observationIdentityKey("creatinine", "urine", "none"),
  true
);

// OCR artifact shape
import { buildPageOcrArtifact, isPageOcrArtifact } from "../src/lib/biomarkers";
const art = buildPageOcrArtifact({
  engine: "pdf-text",
  page_number: 1,
  full_text: "Glucose 90",
});
assert.equal(isPageOcrArtifact(art), true);
assert.equal(art.schema_version, 1);

// Strict readiness: alternatives satisfy a group, but each named system needs every group.
const strictProfile = buildHealthProfile(
  [
    { biomarker_key: "non_hdl_cholesterol", name: "Non-HDL", value: 120, unit: "mg/dL", ref_low: 0, ref_high: 150, observed_at: "2026-02-01", document_id: null },
    { biomarker_key: "hdl", name: "HDL", value: 55, unit: "mg/dL", ref_low: 40, ref_high: 100, observed_at: "2026-02-01", document_id: null },
    { biomarker_key: "triglycerides", name: "Triglycerides", value: 100, unit: "mg/dL", ref_low: 0, ref_high: 150, observed_at: "2026-02-01", document_id: null },
    { biomarker_key: "hba1c", name: "HbA1c", value: 5.2, unit: "%", ref_low: 4, ref_high: 5.6, observed_at: "2026-02-01", document_id: null },
    { biomarker_key: "tsh", name: "TSH", value: 2, unit: "mIU/L", ref_low: 0.4, ref_high: 4, observed_at: "2026-02-01", document_id: null },
    { biomarker_key: "free_t4", name: "Free T4", value: 1.2, unit: "ng/dL", ref_low: 0.8, ref_high: 1.8, observed_at: "2026-02-01", document_id: null },
  ],
  []
);
const strictCardio = strictProfile.systems.find((system) => system.id === "cardiovascular");
assert.equal(strictCardio?.scoreability, "scoreable");
assert.equal(strictCardio?.score_readiness.required_groups[0]?.satisfied_by, "non_hdl_cholesterol");
assert.ok(strictCardio?.state_score != null);
assert.equal(strictProfile.scoreable_named_system_count, 3);
assert.equal(strictProfile.scoreable_named_system_total, 8);
assert.ok(strictProfile.overall_state_score != null);

const missingReferenceProfile = buildHealthProfile(
  [
    { biomarker_key: "ldl", name: "LDL", value: 90, unit: "mg/dL", ref_low: null, ref_high: null, observed_at: "2026-02-01", document_id: null },
    { biomarker_key: "hdl", name: "HDL", value: 55, unit: "mg/dL", ref_low: 40, ref_high: 100, observed_at: "2026-02-01", document_id: null },
    { biomarker_key: "triglycerides", name: "Triglycerides", value: 100, unit: "mg/dL", ref_low: 0, ref_high: 150, observed_at: "2026-02-01", document_id: null },
  ],
  []
);
const missingReferenceCardio = missingReferenceProfile.systems.find((system) => system.id === "cardiovascular");
assert.equal(missingReferenceCardio?.state_score, null);
assert.deepEqual(missingReferenceCardio?.score_readiness.present_without_reference, ["ldl"]);

const bloodWithCorrelatedOutlier = bloodMarkers.map((marker) =>
  marker.key === "hematocrit"
    ? { ...marker, value: 60, status: "out_of_range" as const }
    : marker
);
assert.equal(computeSystemStateScore("blood", bloodWithCorrelatedOutlier), 95);

const inflammationProfile = buildHealthProfile(
  [
    { biomarker_key: "crp", name: "CRP", value: 1, unit: "mg/L", ref_low: 0, ref_high: 5, observed_at: "2026-02-01", document_id: null },
  ],
  []
);
const inflammation = inflammationProfile.systems.find((system) => system.id === "inflammation");
assert.equal(inflammation?.scoreability, "non_scoreable");
assert.equal(inflammation?.state_score, null);
assert.equal(inflammationProfile.overall_state_score, null);

assert.equal(buildHealthProfile([], []).profile_display_state, "onboarding");
assert.equal(
  buildHealthProfile([], [{ id: "doc-1", original_filename: "report.pdf", observed_at: null, lab_name: null }]).profile_display_state,
  "no_recognized_biomarkers"
);

console.log("verify-biomarkers: all checks passed");
