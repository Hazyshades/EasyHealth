import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MEASUREMENT_DEFINITIONS,
  analyzeMeasurementLabel,
  findAliasAdmissions,
  foldMeasurementLabel,
  getMeasurementDefinition,
  normalizeMeasurementLabel,
  resolveMeasurementDefinition,
  snakeCaseToken,
  validateMeasurementRegistry,
} from "../src/lib/biomarkers";
import {
  MULTILINGUAL_LAUNCH_SLICE_KEYS,
  listMissingMultilingualSliceLocales,
} from "../src/lib/biomarkers/multilingual-launch-slice";
import { buildExtractedReviewRow } from "../src/lib/documents/observation-review-workspace";
import { parsePipelineExtraction } from "../src/lib/documents/extraction";
import { runRegistryV2CandidateCorpus } from "./lib/registry-v2-candidate-corpus";

const failures: string[] = [];
function check(name: string, run: () => void): void {
  try {
    run();
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Measurement-label normalization is a separate, Unicode-aware contract
// ---------------------------------------------------------------------------

check("identifier normalizer is unchanged", () => {
  assert.equal(snakeCaseToken("Free T4"), "free_t4");
  assert.equal(snakeCaseToken("NEU%"), "neu_percent");
  // The identifier contract still strips non-Latin script; that is why label
  // matching must not use it.
  assert.equal(snakeCaseToken("Гемоглобин"), "");
});

check("pure Cyrillic labels keep their letters", () => {
  for (const label of ["Гемоглобин", "Глюкоза", "ТТГ", "АЛТ", "Триглицериды"]) {
    const analysis = analyzeMeasurementLabel(label);
    assert.equal(analysis.isEmpty, false, `${label} normalized to empty`);
    assert.equal(analysis.isWeak, false, `${label} normalized to a weak token`);
    assert.match(analysis.primary, /[\u0400-\u04FF]/, `${label} lost its Cyrillic content`);
  }
});

check("свободный Т4 does not collapse to a bare number", () => {
  const analysis = analyzeMeasurementLabel("свободный Т4");
  assert.notEqual(analysis.primary, "4");
  assert.equal(analysis.isWeak, false);
  assert.match(analysis.primary, /свободный/);
});

check("ё is folded onto е", () => {
  assert.equal(normalizeMeasurementLabel("Трёхкратный"), normalizeMeasurementLabel("Трехкратный"));
});

check("Spanish diacritics survive in the primary form", () => {
  assert.equal(normalizeMeasurementLabel("Triglicéridos"), "triglicéridos");
  assert.equal(normalizeMeasurementLabel("Neutrófilos"), "neutrófilos");
  assert.equal(foldMeasurementLabel("Triglicéridos"), "trigliceridos");
});

check("percent stays a distinct token", () => {
  assert.equal(normalizeMeasurementLabel("NEU%"), "neu percent");
  assert.notEqual(normalizeMeasurementLabel("NEU%"), normalizeMeasurementLabel("NEU"));
});

check("empty and weak labels are rejected", () => {
  assert.equal(analyzeMeasurementLabel("").isEmpty, true);
  assert.equal(analyzeMeasurementLabel("   ").isEmpty, true);
  assert.equal(analyzeMeasurementLabel("4").isWeak, true);
  assert.equal(analyzeMeasurementLabel("---").isWeak, true);
  assert.equal(findAliasAdmissions({ rawLabel: "4", laboratory: null }).length, 0);
  assert.equal(findAliasAdmissions({ rawLabel: "", laboratory: null }).length, 0);
});

// ---------------------------------------------------------------------------
// 2. Alias authority: locale required, no empty/weak normalized aliases
// ---------------------------------------------------------------------------

check("registry validates clean", () => {
  const validation = validateMeasurementRegistry();
  assert.equal(validation.valid, true, validation.errors.join("; "));
});

check("every alias declares a supported locale", () => {
  for (const definition of MEASUREMENT_DEFINITIONS) {
    for (const alias of definition.aliases) {
      assert.ok(
        alias.locale === "en" || alias.locale === "ru" || alias.locale === "es",
        `alias ${alias.key} has locale ${String(alias.locale)}`,
      );
    }
  }
});

check("no active alias normalizes to empty or weak", () => {
  for (const definition of MEASUREMENT_DEFINITIONS) {
    for (const alias of definition.aliases) {
      if (alias.lifecycle !== "active") continue;
      const analysis = analyzeMeasurementLabel(alias.value);
      assert.equal(analysis.isEmpty, false, `${alias.key} (${alias.value}) normalizes to empty`);
      assert.equal(analysis.isWeak, false, `${alias.key} (${alias.value}) normalizes to a weak token`);
      assert.equal(alias.normalizedValue, analysis.primary, `${alias.key} normalizedValue drift`);
    }
  }
});

check("missing locale fails catalog validation", () => {
  const definition = MEASUREMENT_DEFINITIONS.find((item) => item.key === "glucose_serum")!;
  const withoutLocale = {
    ...definition,
    aliases: definition.aliases.map((alias) => ({ ...alias, locale: undefined })),
  };
  assert.equal(validateMeasurementRegistry([withoutLocale]).valid, false);
});

check("empty-normalizing alias fails catalog validation", () => {
  const definition = MEASUREMENT_DEFINITIONS.find((item) => item.key === "glucose_serum")!;
  const broken = {
    ...definition,
    aliases: [
      {
        ...definition.aliases[0]!,
        value: "///",
        normalizedValue: "",
      },
    ],
  };
  assert.equal(validateMeasurementRegistry([broken]).valid, false);
});

// ---------------------------------------------------------------------------
// 3. Launch-slice locale coverage
// ---------------------------------------------------------------------------

check("every launch-slice measurement has en, ru and es aliases", () => {
  const missing = listMissingMultilingualSliceLocales(MEASUREMENT_DEFINITIONS);
  assert.deepEqual(missing, [], missing.join("; "));
  assert.ok(MULTILINGUAL_LAUNCH_SLICE_KEYS.length >= 60);
});

// ---------------------------------------------------------------------------
// 4. Resolution: raw label is authoritative, hints are not
// ---------------------------------------------------------------------------

const RESOLVING_LABELS: Array<[string, string | null, string, string]> = [
  ["Гемоглобин", "g/L", "whole_blood", "hemoglobin_whole_blood"],
  ["Лейкоциты", "x10^9/L", "whole_blood", "wbc_whole_blood"],
  ["ТТГ", "mIU/L", "serum", "tsh_serum"],
  ["Свободный Т4", "pmol/L", "serum", "free_t4_serum"],
  ["Glucosa", "mmol/L", "serum", "glucose_serum"],
  ["Triglicéridos", "mmol/L", "serum", "triglycerides_serum"],
  ["Hemoglobina glucosilada", "%", "whole_blood", "hba1c_whole_blood"],
  ["Hemoglobina (HGB)", "g/L", "whole_blood", "hemoglobin_whole_blood"],
];

check("pure RU and ES labels resolve without an English key hint", () => {
  for (const [label, unit, specimen, expectedKey] of RESOLVING_LABELS) {
    const resolution = resolveMeasurementDefinition({
      rawLabel: label,
      rawUnit: unit,
      specimen,
      valueKind: "numeric",
    });
    assert.equal(resolution.result, "resolved", `${label} -> ${resolution.result}`);
    assert.equal(resolution.measurementDefinitionKey, expectedKey, `${label} definition`);
  }
});

check("accent-folded Spanish input matches through the controlled fallback", () => {
  const resolution = resolveMeasurementDefinition({
    rawLabel: "Trigliceridos",
    rawUnit: "mmol/L",
    specimen: "serum",
    valueKind: "numeric",
  });
  assert.equal(resolution.result, "resolved");
  assert.equal(resolution.measurementDefinitionKey, "triglycerides_serum");
});

check("unknown labels stay unmapped in every language", () => {
  for (const label of ["Неизвестный маркер XYZ", "Marcador desconocido QZ", "Totally unknown assay"]) {
    const resolution = resolveMeasurementDefinition({ rawLabel: label, rawUnit: "mg/L", valueKind: "numeric" });
    assert.equal(resolution.result, "unmapped", `${label} -> ${resolution.result}`);
    assert.equal(resolution.measurementDefinitionKey, null);
    assert.equal(resolution.analyteKey, null);
  }
});

check("unknown labels do not grow the catalog", () => {
  const before = MEASUREMENT_DEFINITIONS.length;
  resolveMeasurementDefinition({ rawLabel: "Неизвестный маркер XYZ", rawUnit: "mg/L", valueKind: "numeric" });
  resolveMeasurementDefinition({ rawLabel: "Marcador desconocido QZ", rawUnit: "U/L", valueKind: "numeric" });
  assert.equal(MEASUREMENT_DEFINITIONS.length, before);
});

check("an English key hint alone cannot resolve a row", () => {
  // The label is unknown to the registry; only the extraction key looks familiar.
  const resolution = resolveMeasurementDefinition({
    rawLabel: "Analito no catalogado 77",
    rawUnit: "mmol/L",
    specimen: "serum",
    valueKind: "numeric",
  });
  assert.notEqual(resolution.result, "resolved");
  assert.equal(resolution.measurementDefinitionKey, null);
});

check("a row missing its specimen stays incomplete rather than guessing", () => {
  const resolution = resolveMeasurementDefinition({
    rawLabel: "Глюкоза",
    rawUnit: "mmol/L",
    valueKind: "numeric",
  });
  assert.equal(resolution.result, "partial");
  assert.equal(resolution.measurementDefinitionKey, null);
  assert.ok(resolution.missingAxes.includes("specimen"));
});

check("EN behaviour does not regress", () => {
  const alt = resolveMeasurementDefinition({
    rawLabel: "ALT (alanine aminotransferase)",
    rawUnit: "U/L",
    specimen: "serum",
    valueKind: "numeric",
  });
  assert.equal(alt.result, "resolved");
  assert.equal(alt.measurementDefinitionKey, "alt_serum_catalytic_activity");

  const hgb = resolveMeasurementDefinition({
    rawLabel: "Hemoglobin (HGB)",
    rawUnit: "g/L",
    specimen: "whole_blood",
    valueKind: "numeric",
  });
  assert.equal(hgb.result, "resolved");
  assert.equal(hgb.measurementDefinitionKey, "hemoglobin_whole_blood");
});

check("admitted alias evidence carries its locale", () => {
  const admissions = findAliasAdmissions({ rawLabel: "Гемоглобин", laboratory: null });
  assert.ok(admissions.length > 0);
  assert.ok(admissions.every((admission) => typeof admission.alias.locale === "string"));
  assert.ok(admissions.some((admission) => admission.alias.locale === "ru"));
});

// ---------------------------------------------------------------------------
// 5. Review surface: raw first, canonical English only when resolved
// ---------------------------------------------------------------------------

const REVIEW_ROW_BASE = {
  id: "row-1",
  biomarker_name: "Hemoglobin",
  raw_name: "Гемоглобин",
  value_numeric: 142,
  value_text: null,
  value_kind: "numeric",
  unit: "g/L",
  raw_unit: "g/L",
  raw_value_text: "142",
  reference_range: "130 – 160",
  raw_reference_range: "130 – 160",
  specimen: "whole_blood",
  modifier: null,
  method: null,
  confidence: 0.9,
  source_page: 1,
  source_text: "Гемоглобин, цельная кровь 142 g/L",
  status: "needs_review",
} as const;

check("resolved row shows the original label and the canonical English name", () => {
  const row = buildExtractedReviewRow({
    ...REVIEW_ROW_BASE,
    measurement_definition_key: "hemoglobin_whole_blood",
    normalization: {
      result: "resolved",
      mappingConfidenceBand: "high",
      registryBindingReady: true,
      candidateDefinitionKey: "hemoglobin_whole_blood",
      activeRevision: null,
      resolutionDetails: null as never,
    },
  });
  assert.equal(row.rawEvidence.displayName, "Гемоглобин");
  assert.equal(
    row.rawEvidence.canonicalEnglishName,
    getMeasurementDefinition("hemoglobin_whole_blood")?.displayName,
  );
  assert.equal(row.rawEvidence.value, "142 g/L");
  assert.equal(row.rawEvidence.referenceText, "130 – 160");
});

check("incomplete row keeps the original label and names no candidate", () => {
  const row = buildExtractedReviewRow({
    ...REVIEW_ROW_BASE,
    raw_name: "Глюкоза",
    measurement_definition_key: null,
    normalization: {
      result: "partial",
      mappingConfidenceBand: "medium",
      registryBindingReady: false,
      candidateDefinitionKey: "glucose_serum",
      activeRevision: null,
      resolutionDetails: null as never,
    },
  });
  assert.equal(row.rawEvidence.displayName, "Глюкоза");
  assert.equal(row.rawEvidence.canonicalEnglishName, null);
  assert.equal(row.mapping.label, "More details needed");
});

check("unmapped row still shows its non-English label", () => {
  const row = buildExtractedReviewRow({
    ...REVIEW_ROW_BASE,
    raw_name: "Неизвестный маркер XYZ",
    normalization: {
      result: "unmapped",
      mappingConfidenceBand: "low",
      registryBindingReady: false,
      activeRevision: null,
      resolutionDetails: null as never,
    },
  });
  assert.equal(row.rawEvidence.displayName, "Неизвестный маркер XYZ");
  assert.equal(row.rawEvidence.canonicalEnglishName, null);
  assert.equal(row.mapping.label, "Measurement not recognized");
  // Product chrome stays English.
  assert.match(row.mapping.guidance ?? "", /raw result is preserved/i);
});

// ---------------------------------------------------------------------------
// 6. Extraction contract: verbatim label and qualitative text
// ---------------------------------------------------------------------------
const extractionSource = readFileSync("src/lib/documents/extraction.ts", "utf8");

check("extraction prompt states the verbatim-label contract", () => {
  assert.match(extractionSource, /raw_name is REQUIRED for every row/);
  assert.match(extractionSource, /Do not translate raw_name/);
  assert.match(extractionSource, /optional English snake_case hint only/);
  assert.match(extractionSource, /NOT authoritative identity/);
  assert.match(extractionSource, /Do not invent catalog entries/);
});

check("parser keeps the Russian label verbatim", () => {
  const parsed = parsePipelineExtraction({
    lab_name: "Лаборатория",
    observed_at: "2026-01-02",
    biomarkers: [
      {
        raw_name: "Гемоглобин",
        key: "hemoglobin",
        name: "Hemoglobin",
        value: 142,
        unit: "g/L",
      },
    ],
  });
  assert.equal(parsed.biomarkers.length, 1);
  assert.equal(parsed.biomarkers[0]!.raw_name, "Гемоглобин");
  assert.equal(parsed.biomarkers[0]!.name, "Hemoglobin");
  assert.equal(parsed.biomarkers[0]!.key, "hemoglobin");
});

check("parser preserves specimen explicitly captured in row provenance", () => {
  const parsed = parsePipelineExtraction({
    biomarkers: [
      {
        raw_name: "Hemoglobin (HGB)",
        key: "hemoglobin",
        value: 150,
        unit: "g/L",
        specimen: null,
        source_text:
          "Specimen: whole_blood | Analyte: Hemoglobin (HGB) | Result: 150 | Unit: g/L",
      },
      {
        raw_name: "Glucose",
        key: "urine_glucose",
        value: 5.1,
        unit: "mmol/L",
        specimen: null,
        source_text: "Analyte: Glucose | Result: 5.1 | Unit: mmol/L",
      },
    ],
  });
  assert.equal(parsed.biomarkers[0]!.specimen, "whole_blood");
  assert.equal(parsed.biomarkers[0]!.inferred_axes, null);
  assert.equal(
    parsed.biomarkers[1]!.specimen,
    "unspecified",
    "a key-derived specimen without row evidence must remain absent",
  );
});

check("parser keeps Spanish accents in the verbatim label", () => {
  const parsed = parsePipelineExtraction({
    biomarkers: [{ raw_name: "Triglicéridos", value: 1.2, unit: "mmol/L" }],
  });
  assert.equal(parsed.biomarkers[0]!.raw_name, "Triglicéridos");
});

check("parser preserves qualitative wording in RU and ES", () => {
  const parsed = parsePipelineExtraction({
    biomarkers: [
      { raw_name: "Скрытая кровь", value: "Отрицательно", unit: "" },
      { raw_name: "Sangre oculta", value: "Negativo", unit: "" },
    ],
  });
  assert.equal(parsed.biomarkers[0]!.value_text, "Отрицательно");
  assert.equal(parsed.biomarkers[1]!.value_text, "Negativo");
  // The normalized reading is stored separately, never in place of the wording.
  assert.equal(parsed.biomarkers[0]!.ordinal, 0);
  assert.equal(parsed.biomarkers[1]!.ordinal, 0);
});

check("parser falls back to name and drops label-less rows", () => {
  const parsed = parsePipelineExtraction({
    biomarkers: [
      { name: "Glucose", value: 5.3, unit: "mmol/L" },
      { value: 1, unit: "mmol/L" },
    ],
  });
  assert.equal(parsed.biomarkers.length, 1);
  assert.equal(parsed.biomarkers[0]!.raw_name, "Glucose");
});

check("a non-laboratory payload extracts nothing", () => {
  assert.deepEqual(parsePipelineExtraction({ biomarkers: [] }).biomarkers, []);
  assert.deepEqual(parsePipelineExtraction({}).biomarkers, []);
});

check("accent-fold admission is reported as a fallback", () => {
  const folded = findAliasAdmissions({ rawLabel: "Trigliceridos", laboratory: null });
  assert.ok(folded.length > 0, "unaccented Spanish label was not admitted");
  assert.ok(
    folded.some((admission) => admission.alias.foldFallback === true),
    "fold fallback was not reported for an unaccented label",
  );
  // The accented spelling matches its own alias directly, so at least one
  // admission is a primary-form match rather than a fold fallback.
  const primary = findAliasAdmissions({ rawLabel: "Triglicéridos", laboratory: null });
  assert.ok(
    primary.some((admission) => admission.alias.foldFallback !== true),
    "accented label did not match the accent-preserving alias directly",
  );
});

// ---------------------------------------------------------------------------
// 7. Corpus: real multilingual coverage and per-language gates
// ---------------------------------------------------------------------------

const run = runRegistryV2CandidateCorpus();

check("corpus has no fixture errors", () => {
  assert.deepEqual(run.manifest.fixtureErrors, []);
});

check("corpus covers en, ru and es with real rows", () => {
  for (const language of ["en", "ru", "es"] as const) {
    const segment = run.report.segments.language[language];
    assert.ok(segment, `missing ${language} segment`);
    assert.ok(segment.total >= 4, `${language} has only ${segment.total} rows`);
    assert.equal(segment.expectedClassificationFailures, 0, `${language} classification failures`);
    assert.equal(segment.falseConcreteResolutions, 0, `${language} false concrete resolutions`);
  }
});

check("every threshold, including per-language gates, passes", () => {
  const failed = run.manifest.thresholdChecks.filter((thresholdCheck) => !thresholdCheck.passed);
  assert.deepEqual(failed, [], JSON.stringify(failed));
  for (const language of ["en", "ru", "es"] as const) {
    assert.ok(
      run.manifest.thresholdChecks.some(
        (thresholdCheck) => thresholdCheck.metric === `language.${language}.expectedClassificationRate`,
      ),
      `missing ${language} threshold check`,
    );
  }
});

check("RU and ES corpus rows really carry their language", () => {
  const ruRows = run.report.rows.filter((row) => row.language === "ru");
  const esRows = run.report.rows.filter((row) => row.language === "es");
  assert.ok(ruRows.length > 0 && esRows.length > 0, "missing RU or ES rows");
  assert.ok(
    ruRows.every((row) => /[\u0400-\u04FF]/.test(row.rawEvidence.label)),
    "an RU row carries no Cyrillic text",
  );
  assert.ok(
    esRows.some((row) => /[áéíóúüñ]/i.test(row.rawEvidence.label)),
    "no accented ES row",
  );
});

check("corpus keeps deliberate unknown rows unmapped", () => {
  for (const id of ["ru-unknown-marker", "es-unknown-marker"]) {
    const row = run.report.rows.find((item) => item.id === id);
    assert.ok(row, `missing corpus row ${id}`);
    assert.equal(row.actualClassification, "unmapped", `${id} -> ${row.actualClassification}`);
    assert.equal(row.classificationMatches, true);
  }
});

// Language authenticity gate: a fixture that claims a language it does not use
// must fail, otherwise coverage can be faked exactly as it was before.
const authenticityRoot = mkdtempSync(join(tmpdir(), "eh-multilingual-authenticity-"));
try {
  cpSync("registry/candidate-release/v1", authenticityRoot, { recursive: true });
  const fixturePath = join(authenticityRoot, "documents", "cbc-ru-north.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    rawRows: Array<{ rawLabel: string }>;
  };
  for (const rawRow of fixture.rawRows) rawRow.rawLabel = "Hemoglobin";
  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

  const corpusPath = join(authenticityRoot, "corpus.json");
  const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as {
    rows: Array<{ documentId: string; rawLabel: string }>;
  };
  for (const row of corpus.rows) {
    if (row.documentId === "cbc-ru-north") row.rawLabel = "Hemoglobin";
  }
  writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");

  check("English-labelled RU fixture fails the authenticity gate", () => {
    assert.throws(
      () => runRegistryV2CandidateCorpus({ root: authenticityRoot }),
      /declares language ru but no label contains Cyrillic text/,
    );
  });
} finally {
  rmSync(authenticityRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`verify-multilingual-lab-pipeline: ${failures.length} check(s) failed`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log("verify-multilingual-lab-pipeline: all checks passed");
}
