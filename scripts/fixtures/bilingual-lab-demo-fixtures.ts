import {
  findAliasAdmissions,
  getMeasurementDefinition,
  normalizeMeasurementUnit,
  type MeasurementResolutionInput,
} from "../../src/lib/biomarkers";

export const BILINGUAL_LAB_DEMO_DATES = [
  "2026-08-01",
  "2026-09-15",
  "2026-11-01",
] as const;

export type BilingualLabDemoDate = (typeof BILINGUAL_LAB_DEMO_DATES)[number];
export type BilingualLabDemoLanguage = "en" | "es";
export type BilingualLabDemoSpecimen =
  | "serum"
  | "plasma"
  | "urine"
  | "whole_blood";
export type BilingualLabDemoPanel =
  | "lipid"
  | "metabolic"
  | "thyroid"
  | "liver"
  | "kidney"
  | "cbc"
  | "iron"
  | "nutrients"
  | "inflammation";

export type BilingualLabDemoMeasurement = {
  readonly definitionKey: string;
  readonly panel: BilingualLabDemoPanel;
  readonly labels: Readonly<Record<BilingualLabDemoLanguage, string>>;
  readonly unit: string;
  readonly refLow: number;
  readonly refHigh: number;
  readonly specimen: BilingualLabDemoSpecimen;
  readonly method: "automated" | "manual";
  readonly modifier: "fasting" | "none";
  readonly values: Readonly<Record<BilingualLabDemoDate, number>>;
  readonly scoreCritical: boolean;
  readonly trendEligible: boolean;
};

export const BILINGUAL_LAB_DEMO_METADATA = {
  laboratory: "EasyHealth Demo Laboratory",
  patientName: "Demo Patient",
  patientId: "DEMO-001",
  accessionPrefix: "EH-DEMO-2026",
  reportTitle: {
    en: "Comprehensive Laboratory Results",
    es: "Informe completo de resultados de laboratorio",
  },
  syntheticBanner: {
    en: "SYNTHETIC DATA FOR PRODUCT DEMONSTRATION ONLY",
    es: "DATOS SINTÉTICOS SOLO PARA DEMOSTRACIÓN DEL PRODUCTO",
  },
  disclaimer: {
    en: "Synthetic demonstration document. Not a medical record, certificate, or clinical advice.",
    es: "Documento sintético de demostración. No es un registro médico, certificado ni consejo clínico.",
  },
} as const;

export const BILINGUAL_LAB_DEMO_PANEL_LABELS: Readonly<
  Record<
    BilingualLabDemoPanel,
    Readonly<Record<BilingualLabDemoLanguage, string>>
  >
> = {
  lipid: { en: "Lipid panel", es: "Perfil lipídico" },
  metabolic: { en: "Metabolic panel", es: "Perfil metabólico" },
  thyroid: { en: "Thyroid panel", es: "Perfil tiroideo" },
  liver: { en: "Liver panel", es: "Perfil hepático" },
  kidney: { en: "Kidney panel", es: "Perfil renal" },
  cbc: { en: "Complete blood count", es: "Hemograma completo" },
  iron: { en: "Iron studies", es: "Estudios de hierro" },
  nutrients: { en: "Nutrients", es: "Nutrientes" },
  inflammation: { en: "Inflammation", es: "Inflamación" },
};

const values = (
  first: number,
  second: number,
  third: number,
): Readonly<Record<BilingualLabDemoDate, number>> => ({
  "2026-08-01": first,
  "2026-09-15": second,
  "2026-11-01": third,
});

const measurement = (
  definitionKey: string,
  panel: BilingualLabDemoPanel,
  en: string,
  es: string,
  unit: string,
  refLow: number,
  refHigh: number,
  specimen: BilingualLabDemoSpecimen,
  modifier: "fasting" | "none",
  measurementValues: Readonly<Record<BilingualLabDemoDate, number>>,
  scoreCritical = false,
  trendEligible = false,
): BilingualLabDemoMeasurement => ({
  definitionKey,
  panel,
  labels: { en, es },
  unit,
  refLow,
  refHigh,
  specimen,
  method: "automated",
  modifier,
  values: measurementValues,
  scoreCritical,
  trendEligible,
});

export const BILINGUAL_LAB_DEMO_MEASUREMENTS: readonly BilingualLabDemoMeasurement[] =
  [
    measurement(
      "total_cholesterol_serum",
      "lipid",
      "Total cholesterol",
      "colesterol total",
      "mg/dL",
      125,
      200,
      "serum",
      "none",
      values(203, 197, 191),
    ),
    measurement(
      "ldl_serum",
      "lipid",
      "LDL",
      "colesterol ldl",
      "mg/dL",
      0,
      129,
      "serum",
      "none",
      values(126, 118, 110),
      true,
      true,
    ),
    measurement(
      "non_hdl_cholesterol_serum",
      "lipid",
      "Non-HDL cholesterol",
      "colesterol no hdl",
      "mg/dL",
      0,
      159,
      "serum",
      "none",
      values(151, 143, 135),
      true,
      false,
    ),
    measurement(
      "hdl_serum",
      "lipid",
      "HDL",
      "colesterol hdl",
      "mg/dL",
      40,
      90,
      "serum",
      "none",
      values(52, 54, 56),
      true,
      false,
    ),
    measurement(
      "triglycerides_serum",
      "lipid",
      "Triglycerides",
      "triglicéridos",
      "mg/dL",
      0,
      149,
      "serum",
      "none",
      values(124, 110, 96),
      true,
      false,
    ),
    measurement(
      "fasting_glucose",
      "metabolic",
      "Fasting glucose",
      "glucosa en ayunas",
      "mg/dL",
      70,
      99,
      "plasma",
      "fasting",
      values(92, 90, 88),
      true,
      false,
    ),
    measurement(
      "hba1c_whole_blood",
      "metabolic",
      "HbA1c",
      "hemoglobina glucosilada",
      "%",
      4,
      5.6,
      "whole_blood",
      "none",
      values(5.6, 5.5, 5.4),
      true,
      true,
    ),
    measurement(
      "tsh_serum",
      "thyroid",
      "TSH",
      "tirotropina",
      "mIU/L",
      0.4,
      4,
      "serum",
      "none",
      values(2.18, 2.02, 1.86),
      true,
      false,
    ),
    measurement(
      "free_t4_serum",
      "thyroid",
      "FT4",
      "t4 libre",
      "ng/dL",
      0.8,
      1.8,
      "serum",
      "none",
      values(1.18, 1.2, 1.22),
      true,
      false,
    ),
    measurement(
      "alt_serum_catalytic_activity",
      "liver",
      "ALT",
      "alt",
      "U/L",
      7,
      45,
      "serum",
      "none",
      values(28, 25, 22),
      true,
      true,
    ),
    measurement(
      "ast_serum_catalytic_activity",
      "liver",
      "AST",
      "ast",
      "U/L",
      10,
      40,
      "serum",
      "none",
      values(25, 23, 21),
      true,
      false,
    ),
    measurement(
      "alp_serum_catalytic_activity",
      "liver",
      "ALP",
      "fosfatasa alcalina",
      "U/L",
      40,
      129,
      "serum",
      "none",
      values(76, 74, 72),
      true,
      false,
    ),
    measurement(
      "ggt_serum_catalytic_activity",
      "liver",
      "GGT",
      "ggt",
      "U/L",
      8,
      61,
      "serum",
      "none",
      values(22, 20, 18),
      false,
      false,
    ),
    measurement(
      "bilirubin_serum",
      "liver",
      "Total bilirubin",
      "bilirrubina total",
      "mg/dL",
      0.2,
      1.2,
      "serum",
      "none",
      values(0.7, 0.6, 0.6),
      true,
      false,
    ),
    measurement(
      "albumin_serum",
      "liver",
      "Albumin",
      "albúmina",
      "g/dL",
      3.5,
      5,
      "serum",
      "none",
      values(4.5, 4.6, 4.6),
      true,
      false,
    ),
    measurement(
      "egfr",
      "kidney",
      "eGFR",
      "tfg",
      "mL/min/1.73m2",
      60,
      120,
      "serum",
      "none",
      values(92, 96, 99),
      true,
      false,
    ),
    measurement(
      "creatinine_serum",
      "kidney",
      "Creatinine",
      "creatinina sérica",
      "mg/dL",
      0.6,
      1.2,
      "serum",
      "none",
      values(0.95, 0.9, 0.88),
      true,
      true,
    ),
    measurement(
      "uacr_urine",
      "kidney",
      "UACR",
      "cociente albumina creatinina",
      "mg/g",
      0,
      29,
      "urine",
      "none",
      values(9, 8, 7),
      true,
      false,
    ),
    measurement(
      "bun_serum",
      "kidney",
      "BUN",
      "nitrógeno ureico",
      "mg/dL",
      7,
      20,
      "serum",
      "none",
      values(14, 13, 12),
    ),
    measurement(
      "urea_serum",
      "kidney",
      "Urea",
      "urea",
      "mg/dL",
      15,
      45,
      "serum",
      "none",
      values(30, 28, 26),
    ),
    measurement(
      "sodium_serum",
      "kidney",
      "Sodium",
      "sodio",
      "mmol/L",
      135,
      145,
      "serum",
      "none",
      values(140, 139, 140),
    ),
    measurement(
      "potassium_serum",
      "kidney",
      "Potassium",
      "potasio",
      "mmol/L",
      3.5,
      5.1,
      "serum",
      "none",
      values(4.3, 4.2, 4.2),
    ),
    measurement(
      "chloride_serum",
      "kidney",
      "Chloride",
      "cloro",
      "mmol/L",
      98,
      107,
      "serum",
      "none",
      values(103, 102, 103),
    ),
    measurement(
      "bicarbonate_serum",
      "kidney",
      "Bicarbonate",
      "bicarbonato",
      "mmol/L",
      22,
      29,
      "serum",
      "none",
      values(25, 24, 25),
    ),
    measurement(
      "calcium_serum",
      "kidney",
      "Calcium",
      "calcio",
      "mmol/L",
      2.15,
      2.55,
      "serum",
      "none",
      values(2.34, 2.35, 2.36),
    ),
    measurement(
      "hemoglobin_whole_blood",
      "cbc",
      "Hemoglobin (HGB)",
      "hemoglobina (hgb)",
      "g/dL",
      13.5,
      17.5,
      "whole_blood",
      "none",
      values(13.9, 14.1, 14.3),
      true,
      true,
    ),
    measurement(
      "hematocrit_whole_blood",
      "cbc",
      "Hematocrit (HCT)",
      "hematocrito (hct)",
      "%",
      41,
      53,
      "whole_blood",
      "none",
      values(42, 42.6, 43.2),
      true,
      false,
    ),
    measurement(
      "rbc_whole_blood",
      "cbc",
      "Red blood cells (RBC)",
      "eritrocitos",
      "10^12/L",
      4.5,
      5.9,
      "whole_blood",
      "none",
      values(4.75, 4.82, 4.89),
    ),
    measurement(
      "wbc_whole_blood",
      "cbc",
      "White blood cells (WBC)",
      "leucocitos",
      "10^9/L",
      4,
      10,
      "whole_blood",
      "none",
      values(6.2, 6, 5.8),
      true,
      false,
    ),
    measurement(
      "platelets_whole_blood",
      "cbc",
      "Platelets (PLT)",
      "plaquetas (plt)",
      "10^9/L",
      150,
      400,
      "whole_blood",
      "none",
      values(248, 252, 260),
      true,
      false,
    ),
    measurement(
      "mcv_whole_blood",
      "cbc",
      "Mean corpuscular volume (MCV)",
      "volumen corpuscular medio",
      "fL",
      80,
      100,
      "whole_blood",
      "none",
      values(88.4, 88.4, 88.3),
      true,
      false,
    ),
    measurement(
      "mch_whole_blood",
      "cbc",
      "Mean corpuscular hemoglobin (MCH)",
      "hemoglobina corpuscular media",
      "pg",
      27,
      33,
      "whole_blood",
      "none",
      values(29.3, 29.3, 29.2),
    ),
    measurement(
      "mchc_whole_blood",
      "cbc",
      "Mean corpuscular hemoglobin concentration (MCHC)",
      "concentración de hb corpuscular",
      "g/dL",
      32,
      36,
      "whole_blood",
      "none",
      values(33.1, 33.1, 33.2),
    ),
    measurement(
      "rdw_cv",
      "cbc",
      "Red cell distribution width (RDW)",
      "rdw cv",
      "%",
      11.5,
      14.5,
      "whole_blood",
      "none",
      values(13.1, 13, 12.9),
    ),
    measurement(
      "mpv_whole_blood",
      "cbc",
      "Mean platelet volume (MPV)",
      "volumen plaquetario medio",
      "fL",
      8,
      12,
      "whole_blood",
      "none",
      values(10.4, 10.5, 10.6),
    ),
    measurement(
      "pdw_cv",
      "cbc",
      "Platelet distribution width (PDW)",
      "ancho de distribución plaquetaria",
      "%",
      9,
      17,
      "whole_blood",
      "none",
      values(13.5, 13.8, 14),
    ),
    measurement(
      "plateletcrit_percent",
      "cbc",
      "Plateletcrit (PCT)",
      "plaquetocrito",
      "%",
      0.15,
      0.4,
      "whole_blood",
      "none",
      values(0.258, 0.265, 0.276),
    ),
    measurement(
      "neutrophils_percent",
      "cbc",
      "Neutrophils",
      "neutrófilos",
      "%",
      40,
      75,
      "whole_blood",
      "none",
      values(58, 56, 54),
    ),
    measurement(
      "lymphocytes_percent",
      "cbc",
      "Lymphocytes",
      "linfocitos",
      "%",
      20,
      45,
      "whole_blood",
      "none",
      values(31, 33, 35),
    ),
    measurement(
      "monocytes_percent",
      "cbc",
      "Monocytes",
      "monocitos",
      "%",
      2,
      10,
      "whole_blood",
      "none",
      values(7, 7, 7),
    ),
    measurement(
      "eosinophils_percent",
      "cbc",
      "Eosinophils",
      "eosinófilos",
      "%",
      0,
      6,
      "whole_blood",
      "none",
      values(3, 3, 3),
    ),
    measurement(
      "basophils_percent",
      "cbc",
      "Basophils",
      "basófilos",
      "%",
      0,
      2,
      "whole_blood",
      "none",
      values(1, 1, 1),
    ),
    measurement(
      "iron_serum",
      "iron",
      "Serum iron",
      "Serum iron",
      "ug/dL",
      50,
      170,
      "serum",
      "none",
      values(92, 98, 104),
    ),
    measurement(
      "ferritin_serum",
      "iron",
      "Ferritin",
      "Ferritin",
      "ng/mL",
      30,
      400,
      "serum",
      "none",
      values(88, 96, 105),
    ),
    measurement(
      "tibc_serum",
      "iron",
      "Total iron-binding capacity",
      "Total iron-binding capacity",
      "ug/dL",
      250,
      450,
      "serum",
      "none",
      values(318, 320, 322),
    ),
    measurement(
      "uibc_serum",
      "iron",
      "Unsaturated iron-binding capacity",
      "Unsaturated iron-binding capacity",
      "ug/dL",
      110,
      370,
      "serum",
      "none",
      values(226, 222, 218),
    ),
    measurement(
      "transferrin_serum",
      "iron",
      "Transferrin",
      "Transferrin",
      "mg/dL",
      200,
      360,
      "serum",
      "none",
      values(270, 272, 275),
    ),
    measurement(
      "transferrin_saturation_serum",
      "iron",
      "Transferrin saturation",
      "Transferrin saturation",
      "%",
      20,
      50,
      "serum",
      "none",
      values(29, 31, 32),
    ),
    measurement(
      "vitamin_d_serum",
      "nutrients",
      "Vitamin D",
      "vitamina d",
      "ng/mL",
      20,
      50,
      "serum",
      "none",
      values(28, 31, 35),
      true,
      true,
    ),
    measurement(
      "b12_serum",
      "nutrients",
      "Vitamin B12",
      "vitamina b12",
      "pg/mL",
      200,
      900,
      "serum",
      "none",
      values(410, 438, 465),
      true,
      false,
    ),
    measurement(
      "folate_serum",
      "nutrients",
      "Folate",
      "folato",
      "pg/mL",
      4,
      20,
      "serum",
      "none",
      values(8.2, 8.8, 9.4),
      true,
      false,
    ),
    measurement(
      "crp_serum",
      "inflammation",
      "C-reactive protein, quantitative",
      "proteína c reactiva",
      "mg/L",
      0,
      5,
      "serum",
      "none",
      values(1.4, 1.1, 0.9),
    ),
  ] as const;

export const BILINGUAL_LAB_DEMO_SCORE_CRITICAL_KEYS: Readonly<
  Record<string, true>
> = Object.fromEntries(
  BILINGUAL_LAB_DEMO_MEASUREMENTS.filter(
    (measurement) => measurement.scoreCritical,
  ).map((measurement) => [measurement.definitionKey, true]),
);

const expectedScoreGroups: readonly string[][] = [
  ["ldl_serum", "non_hdl_cholesterol_serum"],
  ["hdl_serum"],
  ["triglycerides_serum"],
  ["fasting_glucose", "hba1c_whole_blood"],
  ["tsh_serum"],
  ["free_t4_serum"],
  ["alt_serum_catalytic_activity"],
  ["ast_serum_catalytic_activity"],
  ["alp_serum_catalytic_activity"],
  ["bilirubin_serum"],
  ["albumin_serum"],
  ["egfr", "creatinine_serum"],
  ["uacr_urine"],
  ["hemoglobin_whole_blood", "hematocrit_whole_blood"],
  ["wbc_whole_blood"],
  ["platelets_whole_blood"],
  ["mcv_whole_blood"],
  ["vitamin_d_serum"],
  ["b12_serum"],
  ["folate_serum"],
];

function assertManifest(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(`BILINGUAL_LAB_DEMO_INVALID: ${message}`);
}

function validateLabel(
  measurementDefinitionKey: string,
  language: BilingualLabDemoLanguage,
  rawLabel: string,
): void {
  const admissions = findAliasAdmissions({
    rawLabel,
    laboratory: BILINGUAL_LAB_DEMO_METADATA.laboratory,
  });
  const admitted =
    admissions.some(
      ({ definition, alias }) =>
        definition.key === measurementDefinitionKey &&
        alias.locale === language &&
        alias.lifecycle === "active" &&
        alias.matchAuthority === "reviewed_resolution",
    ) ||
    (language === "es" &&
      admissions.some(
        ({ definition, alias }) =>
          definition.key === measurementDefinitionKey &&
          alias.locale === "en" &&
          alias.lifecycle === "active" &&
          alias.matchAuthority === "reviewed_resolution",
      ));
  assertManifest(
    admitted,
    `${language} label ${JSON.stringify(rawLabel)} does not admit ${measurementDefinitionKey}`,
  );
}

function validateMeasurement(measurement: BilingualLabDemoMeasurement): void {
  const definition = getMeasurementDefinition(measurement.definitionKey);
  assertManifest(definition, `missing definition ${measurement.definitionKey}`);
  assertManifest(
    definition.maturity === "reviewed",
    `${measurement.definitionKey} is not reviewed`,
  );
  assertManifest(
    measurement.refLow <= measurement.refHigh,
    `${measurement.definitionKey} has reversed bounds`,
  );
  const normalizedUnit = normalizeMeasurementUnit(measurement.unit);
  assertManifest(
    normalizedUnit.normalizedUnit,
    `${measurement.definitionKey} has unsupported unit ${measurement.unit}`,
  );

  for (const language of ["en", "es"] as const) {
    validateLabel(
      measurement.definitionKey,
      language,
      measurement.labels[language],
    );
  }

  for (const date of BILINGUAL_LAB_DEMO_DATES) {
    const value = measurement.values[date];
    assertManifest(
      Number.isFinite(value),
      `${measurement.definitionKey} has invalid value at ${date}`,
    );
    if (measurement.scoreCritical) {
      assertManifest(
        value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER,
        `${measurement.definitionKey} has an unsafe score value at ${date}`,
      );
    }
  }
}

export function validateBilingualLabDemoManifest(): void {
  const seenKeys = new Set<string>();
  for (const measurement of BILINGUAL_LAB_DEMO_MEASUREMENTS) {
    assertManifest(
      !seenKeys.has(measurement.definitionKey),
      `duplicate definition ${measurement.definitionKey}`,
    );
    seenKeys.add(measurement.definitionKey);
    validateMeasurement(measurement);
  }

  for (const group of expectedScoreGroups) {
    assertManifest(
      group.some((key) => key in BILINGUAL_LAB_DEMO_SCORE_CRITICAL_KEYS),
      `score-readiness group is not covered: ${group.join(", ")}`,
    );
  }
}

export function measurementResolutionInput(
  measurement: BilingualLabDemoMeasurement,
  language: BilingualLabDemoLanguage,
  date: BilingualLabDemoDate,
): MeasurementResolutionInput {
  return {
    rawLabel: measurement.labels[language],
    rawUnit: measurement.unit,
    rawValueText: String(measurement.values[date]),
    specimen: measurement.specimen,
    specimenSource: "stated",
    modifier: measurement.modifier === "none" ? null : measurement.modifier,
    section: BILINGUAL_LAB_DEMO_PANEL_LABELS[measurement.panel].en,
    referenceLow: measurement.refLow,
    referenceHigh: measurement.refHigh,
    extractionConfidence: 1,
    valueKind: "numeric",
    proposedKey: measurement.definitionKey,
    timing: measurement.modifier === "fasting" ? "fasting" : "point_in_time",
    method: measurement.method,
    laboratory: BILINGUAL_LAB_DEMO_METADATA.laboratory,
  };
}

validateBilingualLabDemoManifest();
