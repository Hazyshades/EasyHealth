import type {
  MeasurementResolution,
  MeasurementResolutionInput,
  ResolverResult,
} from "./types";
import { resolveMeasurementDefinition } from "./measurement-resolution";

/**
 * EH-107 CBC measurement regression fixtures.
 * Pure verification contract: identity antipairs, exact sample forms, and unit cases.
 * Does not promote catalog definitions or mutate observations.
 */

export const CBC_REGRESSION_FAMILIES = [
  "differential-abs-pct",
  "rdw-variants",
  "reticulocytes",
  "red-cell-exact",
  "platelets",
  "diff-variants",
  "units",
] as const;

export type CbcRegressionFamily = (typeof CBC_REGRESSION_FAMILIES)[number];

export type CbcRegressionFixture = {
  id: string;
  family: CbcRegressionFamily;
  input: MeasurementResolutionInput;
  expected: {
    classification: ResolverResult;
    /** Required when classification is `resolved`. */
    measurementDefinitionKey?: string;
    /** Concrete keys that must never be selected. */
    forbiddenKeys?: readonly string[];
    /**
     * When false (default for non-resolved), any concrete key fails.
     * When true, a concrete key is allowed only if it matches `measurementDefinitionKey`.
     */
    allowConcreteKey?: boolean;
  };
};

export type CbcFixtureFailure = {
  id: string;
  family: CbcRegressionFamily;
  reason: string;
  actualClassification: ResolverResult;
  actualKey: string | null;
};

export type CbcRegressionReport = {
  total: number;
  passed: number;
  failed: number;
  familiesCovered: readonly CbcRegressionFamily[];
  missingFamilies: readonly CbcRegressionFamily[];
  failures: readonly CbcFixtureFailure[];
  rows: readonly {
    id: string;
    family: CbcRegressionFamily;
    expectedClassification: ResolverResult;
    actualClassification: ResolverResult;
    expectedKey: string | null;
    actualKey: string | null;
    passed: boolean;
  }[];
};

function fixture(
  id: string,
  family: CbcRegressionFamily,
  input: MeasurementResolutionInput,
  expected: CbcRegressionFixture["expected"]
): CbcRegressionFixture {
  return { id, family, input, expected };
}

const WHOLE_BLOOD = "whole_blood";

/** Stable CBC regression pack for EH-107 checklist families. */
export const CBC_MEASUREMENT_REGRESSION_FIXTURES: readonly CbcRegressionFixture[] = [
  // ── differential absolute vs percent (exact sample forms stay non-concrete) ──
  fixture("diff-neu-percent-sample", "differential-abs-pct", {
    rawLabel: "Neutrophils (NEU%)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["neutrophils_abs"],
  }),
  fixture("diff-neu-abs-sample", "differential-abs-pct", {
    rawLabel: "Neutrophils, absolute (NEU)",
    rawUnit: "x10^9/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["neutrophils_percent"],
  }),
  fixture("diff-neu-percent-resolved", "differential-abs-pct", {
    rawLabel: "neu%",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "neutrophils_percent",
    allowConcreteKey: true,
    forbiddenKeys: ["neutrophils_abs"],
  }),
  fixture("diff-neu-abs-resolved", "differential-abs-pct", {
    rawLabel: "NEU",
    rawUnit: "x10^9/L",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "neutrophils_abs",
    allowConcreteKey: true,
    forbiddenKeys: ["neutrophils_percent"],
  }),
  fixture("diff-lymf-percent-sample", "differential-abs-pct", {
    rawLabel: "Lymphocytes (LYMF%)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["lymphocytes_abs"],
  }),
  fixture("diff-lymf-abs-sample", "differential-abs-pct", {
    rawLabel: "Lymphocytes, absolute (LYMF)",
    rawUnit: "x10^9/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["lymphocytes_percent"],
  }),
  fixture("diff-lymf-percent-resolved", "differential-abs-pct", {
    rawLabel: "Lymphocytes",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "lymphocytes_percent",
    allowConcreteKey: true,
    forbiddenKeys: ["lymphocytes_abs"],
  }),
  fixture("diff-lymf-abs-no-crossmap", "differential-abs-pct", {
    rawLabel: "Lymphocytes",
    rawUnit: "x10^9/L",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["lymphocytes_percent", "lymphocytes_abs"],
  }),
  fixture("diff-mon-percent-sample", "differential-abs-pct", {
    rawLabel: "Monocytes (MON%)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["monocytes_abs", "neutrophils_percent", "neutrophils_abs"],
  }),
  fixture("diff-mon-abs-sample", "differential-abs-pct", {
    rawLabel: "Monocytes, absolute (MON)",
    rawUnit: "x10^9/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["monocytes_percent", "neutrophils_percent", "neutrophils_abs"],
  }),
  fixture("diff-eos-percent-sample", "differential-abs-pct", {
    rawLabel: "Eosinophils (EOS%)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["eosinophils_abs", "neutrophils_percent"],
  }),
  fixture("diff-eos-abs-sample", "differential-abs-pct", {
    rawLabel: "Eosinophils, absolute (EOS)",
    rawUnit: "x10^9/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["eosinophils_percent", "neutrophils_abs"],
  }),
  fixture("diff-bas-percent-sample", "differential-abs-pct", {
    rawLabel: "Basophils (BAS%)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["basophils_abs", "neutrophils_percent"],
  }),
  fixture("diff-bas-abs-sample", "differential-abs-pct", {
    rawLabel: "Basophils, absolute (BAS)",
    rawUnit: "x10^9/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["basophils_percent", "neutrophils_abs"],
  }),

  // ── RDW variants ──
  fixture("rdw-cv-resolved", "rdw-variants", {
    rawLabel: "RDW-CV",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "rdw_cv",
    allowConcreteKey: true,
    forbiddenKeys: ["rdw_sd"],
  }),
  fixture("rdw-sd-resolved", "rdw-variants", {
    rawLabel: "RDW-SD",
    rawUnit: "fL",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "rdw_sd",
    allowConcreteKey: true,
    forbiddenKeys: ["rdw_cv"],
  }),
  fixture("rdw-sample-generic", "rdw-variants", {
    rawLabel: "Red cell distribution width (RDW)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["rdw_sd"],
  }),
  fixture("rdw-bare-missing-context", "rdw-variants", {
    rawLabel: "RDW",
  }, {
    classification: "partial",
    forbiddenKeys: ["rdw_cv", "rdw_sd"],
  }),
  fixture("rdw-percent-with-specimen", "rdw-variants", {
    rawLabel: "RDW",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "rdw_cv",
    allowConcreteKey: true,
    forbiddenKeys: ["rdw_sd"],
  }),

  // ── reticulocytes (synthetic; absent from sample PDF) ──
  fixture("retic-percent-resolved", "reticulocytes", {
    rawLabel: "retic_percent",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "reticulocytes_percent",
    allowConcreteKey: true,
    forbiddenKeys: ["reticulocytes_abs"],
  }),
  fixture("retic-abs-resolved", "reticulocytes", {
    rawLabel: "Absolute reticulocyte count",
    rawUnit: "x10^9/L",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "reticulocytes_abs",
    allowConcreteKey: true,
    forbiddenKeys: ["reticulocytes_percent"],
  }),
  fixture("retic-bare-percent-unmapped", "reticulocytes", {
    rawLabel: "Reticulocytes",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "unmapped",
    forbiddenKeys: ["reticulocytes_percent", "reticulocytes_abs"],
  }),

  // ── red-cell exact sample labels ──
  fixture("red-rbc-sample", "red-cell-exact", {
    rawLabel: "Red blood cells (RBC)",
    rawUnit: "x10^12/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["hemoglobin_whole_blood", "hematocrit_whole_blood", "mcv_whole_blood"],
  }),
  fixture("red-hgb-sample", "red-cell-exact", {
    rawLabel: "Hemoglobin (HGB)",
    rawUnit: "g/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["hematocrit_whole_blood", "rbc_whole_blood", "mcv_whole_blood"],
  }),
  fixture("red-hgb-resolved-short", "red-cell-exact", {
    rawLabel: "Hemoglobin",
    rawUnit: "g/L",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "hemoglobin_whole_blood",
    allowConcreteKey: true,
    forbiddenKeys: ["hematocrit_whole_blood", "rbc_whole_blood"],
  }),
  fixture("red-hct-sample", "red-cell-exact", {
    rawLabel: "Hematocrit (HCT)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["hemoglobin_whole_blood", "mcv_whole_blood"],
  }),
  fixture("red-mcv-sample", "red-cell-exact", {
    rawLabel: "Mean corpuscular volume (MCV)",
    rawUnit: "fL",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["rdw_cv", "rdw_sd", "hemoglobin_whole_blood"],
  }),
  fixture("red-mcv-resolved-short", "red-cell-exact", {
    rawLabel: "MCV",
    rawUnit: "fL",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "mcv_whole_blood",
    allowConcreteKey: true,
    forbiddenKeys: ["rdw_cv", "rdw_sd"],
  }),
  fixture("red-mch-sample", "red-cell-exact", {
    rawLabel: "Mean corpuscular hemoglobin (MCH)",
    rawUnit: "pg",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["mcv_whole_blood", "hemoglobin_whole_blood"],
  }),
  fixture("red-mchc-sample", "red-cell-exact", {
    rawLabel: "Mean corpuscular hemoglobin concentration (MCHC)",
    rawUnit: "g/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["mcv_whole_blood", "hemoglobin_whole_blood"],
  }),

  // ── platelets ──
  fixture("plt-sample", "platelets", {
    rawLabel: "Platelets (PLT)",
    rawUnit: "x10^9/L",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["mcv_whole_blood", "rdw_cv", "rdw_sd"],
  }),
  fixture("plt-resolved-short", "platelets", {
    rawLabel: "PLT",
    rawUnit: "x10^9/L",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "platelets_whole_blood",
    allowConcreteKey: true,
    forbiddenKeys: ["mcv_whole_blood", "rdw_cv"],
  }),
  fixture("mpv-sample", "platelets", {
    rawLabel: "Mean platelet volume (MPV)",
    rawUnit: "fL",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["mcv_whole_blood", "rdw_sd", "platelets_whole_blood"],
  }),
  fixture("pdw-sample", "platelets", {
    rawLabel: "Platelet distribution width (PDW)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["rdw_cv", "rdw_sd", "mcv_whole_blood"],
  }),
  fixture("pct-sample", "platelets", {
    rawLabel: "Plateletcrit (PCT)",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["rdw_cv", "platelets_whole_blood", "mcv_whole_blood"],
  }),

  // ── segmented / band / manual differential variants ──
  fixture("diff-segmented-sample", "diff-variants", {
    rawLabel: "Segmented neutrophils",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["band_neutrophils_percent", "neutrophils_percent", "neutrophils_abs"],
  }),
  fixture("diff-band-sample", "diff-variants", {
    rawLabel: "Band neutrophils",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["neutrophils_percent", "neutrophils_abs"],
  }),
  fixture("diff-band-resolved", "diff-variants", {
    rawLabel: "Band neutrophils",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "band_neutrophils_percent",
    allowConcreteKey: true,
    forbiddenKeys: ["neutrophils_percent", "neutrophils_abs"],
  }),
  fixture("diff-lymph-manual-sample", "diff-variants", {
    rawLabel: "Lymphocytes, manual differential",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["lymphocytes_percent", "lymphocytes_abs"],
  }),
  fixture("diff-mon-manual-sample", "diff-variants", {
    rawLabel: "Monocytes, manual differential",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["lymphocytes_percent", "neutrophils_percent"],
  }),
  fixture("diff-eos-manual-sample", "diff-variants", {
    rawLabel: "Eosinophils, manual differential",
    rawUnit: "%",
    section: "CBC",
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["lymphocytes_percent", "neutrophils_percent"],
  }),

  // ── compatible and invalid units ──
  fixture("units-neu-percent-compatible", "units", {
    rawLabel: "Neutrophils",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "neutrophils_percent",
    allowConcreteKey: true,
    forbiddenKeys: ["neutrophils_abs"],
  }),
  fixture("units-neu-abs-compatible", "units", {
    rawLabel: "Neutrophils",
    rawUnit: "x10^9/L",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "resolved",
    measurementDefinitionKey: "neutrophils_abs",
    allowConcreteKey: true,
    forbiddenKeys: ["neutrophils_percent"],
  }),
  fixture("units-neu-percent-label-cell-unit", "units", {
    rawLabel: "neu%",
    rawUnit: "x10^9/L",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["neutrophils_percent", "neutrophils_abs"],
  }),
  fixture("units-neu-abs-label-percent-unit", "units", {
    rawLabel: "NEU",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["neutrophils_percent", "neutrophils_abs"],
  }),
  fixture("units-rdw-volume-on-percent-label", "units", {
    rawLabel: "RDW",
    rawUnit: "fL",
  }, {
    classification: "partial",
    forbiddenKeys: ["rdw_cv"],
  }),
  fixture("units-retic-percent-with-cell-unit", "units", {
    rawLabel: "retic_percent",
    rawUnit: "x10^9/L",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["reticulocytes_percent", "reticulocytes_abs"],
  }),
  fixture("units-retic-abs-with-percent-unit", "units", {
    rawLabel: "Absolute reticulocyte count",
    rawUnit: "%",
    specimen: WHOLE_BLOOD,
    valueKind: "numeric",
  }, {
    classification: "partial",
    forbiddenKeys: ["reticulocytes_percent", "reticulocytes_abs"],
  }),
];

export function listMissingCbcRegressionFamilies(
  fixtures: readonly CbcRegressionFixture[] = CBC_MEASUREMENT_REGRESSION_FIXTURES
): CbcRegressionFamily[] {
  const present = new Set(fixtures.map((fixture) => fixture.family));
  return CBC_REGRESSION_FAMILIES.filter((family) => !present.has(family));
}

function evaluateFixture(
  fixtureRow: CbcRegressionFixture,
  resolution: MeasurementResolution
): CbcFixtureFailure | null {
  const actualKey = resolution.measurementDefinitionKey;
  const allowConcrete =
    fixtureRow.expected.allowConcreteKey ?? fixtureRow.expected.classification === "resolved";

  if (resolution.result !== fixtureRow.expected.classification) {
    return {
      id: fixtureRow.id,
      family: fixtureRow.family,
      reason: `expected classification ${fixtureRow.expected.classification}, got ${resolution.result}`,
      actualClassification: resolution.result,
      actualKey,
    };
  }

  if (fixtureRow.expected.classification === "resolved") {
    if (!fixtureRow.expected.measurementDefinitionKey) {
      return {
        id: fixtureRow.id,
        family: fixtureRow.family,
        reason: "resolved fixture is missing expected.measurementDefinitionKey",
        actualClassification: resolution.result,
        actualKey,
      };
    }
    if (actualKey !== fixtureRow.expected.measurementDefinitionKey) {
      return {
        id: fixtureRow.id,
        family: fixtureRow.family,
        reason: `expected concrete key ${fixtureRow.expected.measurementDefinitionKey}, got ${actualKey}`,
        actualClassification: resolution.result,
        actualKey,
      };
    }
  } else if (!allowConcrete && actualKey) {
    return {
      id: fixtureRow.id,
      family: fixtureRow.family,
      reason: `non-concrete outcome selected concrete key ${actualKey}`,
      actualClassification: resolution.result,
      actualKey,
    };
  }

  if (actualKey && fixtureRow.expected.forbiddenKeys?.includes(actualKey)) {
    return {
      id: fixtureRow.id,
      family: fixtureRow.family,
      reason: `selected forbidden concrete key ${actualKey}`,
      actualClassification: resolution.result,
      actualKey,
    };
  }

  return null;
}

/** Pure CBC regression evaluator. Does not write patient or registry state. */
export function runCbcMeasurementRegressionSuite(
  fixtures: readonly CbcRegressionFixture[] = CBC_MEASUREMENT_REGRESSION_FIXTURES,
  resolve: (input: MeasurementResolutionInput) => MeasurementResolution = resolveMeasurementDefinition
): CbcRegressionReport {
  const missingFamilies = listMissingCbcRegressionFamilies(fixtures);
  const failures: CbcFixtureFailure[] = missingFamilies.map((family) => ({
    id: `coverage:${family}`,
    family,
    reason: `checklist family ${family} has no fixtures`,
    actualClassification: "unmapped",
    actualKey: null,
  }));

  const rows = fixtures.map((fixtureRow) => {
    const resolution = resolve(fixtureRow.input);
    const failure = missingFamilies.length === 0 ? evaluateFixture(fixtureRow, resolution) : null;
    if (failure) failures.push(failure);
    return {
      id: fixtureRow.id,
      family: fixtureRow.family,
      expectedClassification: fixtureRow.expected.classification,
      actualClassification: resolution.result,
      expectedKey: fixtureRow.expected.measurementDefinitionKey ?? null,
      actualKey: resolution.measurementDefinitionKey,
      passed: !failure && missingFamilies.length === 0,
    };
  });

  const familiesCovered = CBC_REGRESSION_FAMILIES.filter((family) =>
    fixtures.some((fixtureRow) => fixtureRow.family === family)
  );

  return {
    total: fixtures.length,
    passed: rows.filter((row) => row.passed).length,
    failed: failures.length,
    familiesCovered,
    missingFamilies,
    failures,
    rows,
  };
}
