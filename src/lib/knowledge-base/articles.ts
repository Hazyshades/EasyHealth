import type { KnowledgeArticleRecord } from "./types";

const REVIEW = {
  status: "published",
  reviewedBy: "EasyHealth clinical product",
  reviewedAt: "2026-09-01",
} as const;

const MEDLINEPLUS = "MedlinePlus Medical Test";

export const KNOWLEDGE_ARTICLES = [
  {
    slug: "hemoglobin",
    measurementDefinitionKey: "hemoglobin_whole_blood",
    category: "blood",
    summary:
      "Hemoglobin is the red-cell protein that carries oxygen through the body.",
    whatItMeasures:
      "This measurement describes the amount of hemoglobin in a whole-blood sample. It is one part of a complete blood count and is read alongside the other red-cell measurements on the same report.",
    interpretationFactors: [
      "The result can be influenced by hydration, altitude, pregnancy, smoking, recent illness, and other personal context.",
      "The laboratory's own method, units, and reference information belong with the reported result.",
      "A single result is not a diagnosis and should be discussed with a healthcare professional when it raises questions.",
    ],
    relatedMeasurementDefinitionKeys: [
      "hematocrit_whole_blood",
      "mcv_whole_blood",
    ],
    relatedPanelKeys: ["cbc"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Hemoglobin test",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/hemoglobin-test/",
      },
    ],
  },
  {
    slug: "hematocrit",
    measurementDefinitionKey: "hematocrit_whole_blood",
    category: "blood",
    summary:
      "Hematocrit describes how much of a whole-blood sample is made up of red blood cells.",
    whatItMeasures:
      "The hematocrit is reported as a percentage of the blood volume occupied by red blood cells. It is commonly reported as part of a complete blood count.",
    interpretationFactors: [
      "Hydration, altitude, pregnancy, recent illness, and the body's red-cell production can affect the result.",
      "The meaning of a result depends on the laboratory method, the accompanying blood-count measurements, and the person's context.",
      "The result should be interpreted with the report's own information rather than a universal cutoff.",
    ],
    relatedMeasurementDefinitionKeys: [
      "hemoglobin_whole_blood",
      "mcv_whole_blood",
    ],
    relatedPanelKeys: ["cbc"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Hematocrit test",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/hematocrit-test/",
      },
    ],
  },
  {
    slug: "white-blood-cell-count",
    measurementDefinitionKey: "wbc_whole_blood",
    category: "blood",
    summary:
      "A white blood cell count measures the number of white blood cells in whole blood.",
    whatItMeasures:
      "White blood cells are part of the immune system. This measurement counts them in a whole-blood sample and is often read with the differential counts on a complete blood count.",
    interpretationFactors: [
      "Recent infection, inflammation, stress, exercise, medicines, and other health context can affect the count.",
      "The total count does not describe every white-cell type; differential measurements add more detail when they are reported.",
      "A result needs the laboratory's method and clinical context before it can be interpreted responsibly.",
    ],
    relatedMeasurementDefinitionKeys: [
      "platelets_whole_blood",
      "hemoglobin_whole_blood",
    ],
    relatedPanelKeys: ["cbc"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "White blood cell (WBC) count",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/white-blood-cell-wbc-count/",
      },
    ],
  },
  {
    slug: "platelet-count",
    measurementDefinitionKey: "platelets_whole_blood",
    category: "blood",
    summary:
      "A platelet count measures the number of platelets in whole blood.",
    whatItMeasures:
      "Platelets are small blood components involved in clot formation. This measurement counts them in a whole-blood sample and is commonly included in a complete blood count.",
    interpretationFactors: [
      "Recent illness, inflammation, medicines, pregnancy, and sample handling can affect the reported count.",
      "Platelet count is one part of a broader evaluation and does not describe platelet function by itself.",
      "The report's units, method, and accompanying measurements provide important context for any discussion.",
    ],
    relatedMeasurementDefinitionKeys: [
      "hemoglobin_whole_blood",
      "wbc_whole_blood",
    ],
    relatedPanelKeys: ["cbc"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Platelet tests",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/platelet-tests/",
      },
    ],
  },
  {
    slug: "mean-corpuscular-volume",
    measurementDefinitionKey: "mcv_whole_blood",
    category: "blood",
    summary:
      "Mean corpuscular volume (MCV) describes the average size of red blood cells.",
    whatItMeasures:
      "MCV is calculated from the red-cell measurements in a whole-blood sample. It helps describe red-cell size as part of a complete blood count.",
    interpretationFactors: [
      "Red-cell production, nutrient status, hydration, recent illness, and other clinical context can influence the result.",
      "MCV is interpreted with hemoglobin, hematocrit, and other blood-count measurements rather than alone.",
      "The laboratory's reported unit and method remain the source of truth for the individual result.",
    ],
    relatedMeasurementDefinitionKeys: [
      "hemoglobin_whole_blood",
      "hematocrit_whole_blood",
    ],
    relatedPanelKeys: ["cbc"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Mean corpuscular volume (MCV)",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/mean-corpuscular-volume-mcv/",
      },
    ],
  },
  {
    slug: "glucose",
    measurementDefinitionKey: "glucose_serum",
    category: "metabolic",
    summary:
      "A serum glucose measurement reports the amount of glucose in a blood sample at collection.",
    whatItMeasures:
      "Glucose is a sugar used by the body for energy. This concrete Registry definition describes a quantitative glucose measurement in serum; other specimen or timing variants remain distinct definitions.",
    interpretationFactors: [
      "Whether the sample was collected after fasting, after a meal, or at another time can change how the result is understood.",
      "Activity, medicines, acute illness, and the laboratory method can also influence a reported value.",
      "Use the collection context and the laboratory's own information when discussing a result with a healthcare professional.",
    ],
    relatedMeasurementDefinitionKeys: ["hba1c_whole_blood"],
    relatedPanelKeys: [],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Blood glucose test",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/blood-glucose-test/",
      },
    ],
  },
  {
    slug: "hemoglobin-a1c",
    measurementDefinitionKey: "hba1c_whole_blood",
    category: "metabolic",
    summary:
      "Hemoglobin A1c (HbA1c) describes the proportion of hemoglobin with glucose attached.",
    whatItMeasures:
      "HbA1c is measured in a whole-blood sample and reflects average exposure to glucose over the preceding several weeks to months. It is different from a point-in-time glucose measurement.",
    interpretationFactors: [
      "Red-cell lifespan and conditions that change red-cell turnover can affect the relationship between HbA1c and glucose exposure.",
      "The assay method, units, medicines, and personal health context should be considered with the result.",
      "HbA1c is one measurement and does not independently establish a diagnosis.",
    ],
    relatedMeasurementDefinitionKeys: ["glucose_serum"],
    relatedPanelKeys: [],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Hemoglobin A1C (HbA1c) test",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/",
      },
    ],
  },
  {
    slug: "thyroid-stimulating-hormone",
    measurementDefinitionKey: "tsh_serum",
    category: "thyroid",
    summary:
      "Thyroid-stimulating hormone (TSH) is a pituitary signal used to assess thyroid regulation.",
    whatItMeasures:
      "This concrete Registry definition measures TSH quantitatively in serum. TSH helps signal the thyroid to make thyroid hormones and is usually considered with other information when needed.",
    interpretationFactors: [
      "Medicines, pregnancy, acute illness, time of collection, and assay method can influence the result.",
      "TSH is often considered with thyroid hormone measurements and symptoms rather than in isolation.",
      "The report's units and the person's context matter more than a universal interpretation of one value.",
    ],
    relatedMeasurementDefinitionKeys: ["free_t4_serum"],
    relatedPanelKeys: ["thyroid"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "TSH (thyroid-stimulating hormone) test",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/",
      },
    ],
  },
  {
    slug: "alt",
    measurementDefinitionKey: "alt_serum_catalytic_activity",
    category: "liver",
    summary:
      "ALT is an enzyme measurement reported from a serum sample as catalytic activity.",
    whatItMeasures:
      "Alanine aminotransferase (ALT) is an enzyme found in several tissues, including the liver. This concrete Registry definition describes its catalytic activity in serum; the result is interpreted with other information.",
    interpretationFactors: [
      "Medicines, exercise, alcohol exposure, recent illness, and other health context can affect an ALT result.",
      "ALT is commonly considered with other liver-related measurements and the person's history.",
      "An isolated enzyme result does not identify a cause or establish a diagnosis.",
    ],
    relatedMeasurementDefinitionKeys: [
      "ast_serum_catalytic_activity",
      "bilirubin_serum",
      "albumin_serum",
    ],
    relatedPanelKeys: ["liver"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Alanine transaminase (ALT) blood test",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/alanine-transaminase-alt-blood-test/",
      },
    ],
  },
  {
    slug: "creatinine",
    measurementDefinitionKey: "creatinine_serum",
    category: "kidney",
    summary:
      "Serum creatinine reports the amount of creatinine in a blood sample.",
    whatItMeasures:
      "Creatinine is a waste product produced by normal muscle activity and cleared from the blood by the kidneys. This concrete Registry definition measures it quantitatively in serum.",
    interpretationFactors: [
      "Muscle mass, diet, hydration, medicines, and recent strenuous activity can influence the result.",
      "Creatinine is often considered with estimated filtration measures and other kidney-related information.",
      "A result should be read with the laboratory's method, units, and the person's broader context.",
    ],
    relatedMeasurementDefinitionKeys: ["egfr"],
    relatedPanelKeys: ["kidney"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Creatinine test",
        publisher: MEDLINEPLUS,
        href: "https://medlineplus.gov/lab-tests/creatinine-test/",
      },
    ],
  },
  {
    slug: "egfr",
    measurementDefinitionKey: "egfr",
    category: "kidney",
    summary:
      "Estimated glomerular filtration rate (eGFR) is an estimate of kidney filtration.",
    whatItMeasures:
      "eGFR is calculated from laboratory and personal inputs to estimate how efficiently the kidneys filter blood. It is an estimate, not a direct measurement of filtration.",
    interpretationFactors: [
      "The equation, creatinine result, age, and other inputs used by the reporting laboratory affect the estimate.",
      "Trends over time and accompanying kidney information can be more informative than one isolated estimate.",
      "The reported equation, units, and clinical context should stay with the result when it is discussed.",
    ],
    relatedMeasurementDefinitionKeys: ["creatinine_serum"],
    relatedPanelKeys: ["kidney"],
    contentVersion: "1.0.0",
    review: REVIEW,
    sources: [
      {
        title: "Estimated glomerular filtration rate (eGFR)",
        publisher: "National Kidney Foundation",
        href: "https://www.kidney.org/kidney-topics/estimated-glomerular-filtration-rate-egfr",
      },
    ],
  },
] as const satisfies readonly KnowledgeArticleRecord[];
