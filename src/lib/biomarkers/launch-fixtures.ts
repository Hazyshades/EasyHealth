import { resolveMeasurementDefinition } from "./measurement-resolution";
import type { MeasurementResolutionInput, MeasurementValueKind, ResolverResult } from "./types";

export type LaunchResolverFixture = MeasurementResolutionInput & {
  id: string;
  rawLabel: string;
  rawUnit: string | null;
  valueKind: MeasurementValueKind;
  section: string;
  expected?: {
    result: ResolverResult;
    measurementDefinitionKey?: string | null;
    missingAxes?: readonly string[];
    conflicts?: readonly string[];
  };
};

const numeric = (id: string, rawLabel: string, rawUnit: string | null, section: string): LaunchResolverFixture => ({ id, rawLabel, rawUnit, valueKind: "numeric", section });
const cbc = (id: string, rawLabel: string, rawUnit: string | null, expected: LaunchResolverFixture["expected"], options: Partial<Pick<LaunchResolverFixture, "method" | "modifier" | "specimen" | "valueKind">> = {}): LaunchResolverFixture => ({ id, rawLabel, rawUnit, section: "CBC", specimen: "whole_blood", valueKind: "numeric", expected, ...options });
const qualitative = (id: string, rawLabel: string, rawUnit: string | null): LaunchResolverFixture => ({ id, rawLabel, rawUnit, valueKind: "qualitative", section: "Serology, parasitology, allergy markers" });

const differential = [
  ["neutrophils", "NEU", "Нейтрофилы"],
  ["lymphocytes", "LYM", "Лимфоциты"],
  ["monocytes", "MON", "Моноциты"],
  ["eosinophils", "EOS", "Эозинофилы"],
  ["basophils", "BAS", "Базофилы"],
] as const;

export const SAMPLE_NEWEST_LAUNCH_FIXTURES: readonly LaunchResolverFixture[] = [
  numeric("total-protein", "Total protein", "g/L", "Biochemistry and inflammation"), numeric("glucose", "Glucose", "mmol/L", "Biochemistry and inflammation"), numeric("total-bilirubin", "Total bilirubin", "umol/L", "Biochemistry and inflammation"), numeric("direct-bilirubin", "Direct bilirubin", "umol/L", "Biochemistry and inflammation"), numeric("alt", "ALT (alanine aminotransferase)", "U/L", "Biochemistry and inflammation"), numeric("ast", "AST (aspartate aminotransferase)", "U/L", "Biochemistry and inflammation"), numeric("crp", "C-reactive protein, quantitative", "mg/L", "Biochemistry and inflammation"), numeric("aso", "Antistreptolysin-O (ASO)", "IU/mL", "Biochemistry and inflammation"),
  cbc("rbc", "Red blood cells (RBC)", "x10^12/L", { result: "resolved", measurementDefinitionKey: "rbc_whole_blood" }), cbc("hgb", "Hemoglobin (HGB)", "g/L", { result: "resolved", measurementDefinitionKey: "hemoglobin_whole_blood" }), cbc("hct", "Hematocrit (HCT)", "%", { result: "resolved", measurementDefinitionKey: "hematocrit_whole_blood" }), cbc("mcv", "Mean corpuscular volume (MCV)", "fL", { result: "resolved", measurementDefinitionKey: "mcv_whole_blood" }), cbc("mch", "Mean corpuscular hemoglobin (MCH)", "pg", { result: "resolved", measurementDefinitionKey: "mch_whole_blood" }), cbc("mchc", "Mean corpuscular hemoglobin concentration (MCHC)", "g/L", { result: "resolved", measurementDefinitionKey: "mchc_whole_blood" }),
  cbc("rdw-cv", "Red cell distribution width CV (RDW-CV)", "%", { result: "resolved", measurementDefinitionKey: "rdw_cv" }), cbc("rdw-sd", "Red cell distribution width SD (RDW-SD)", "fL", { result: "resolved", measurementDefinitionKey: "rdw_sd" }), cbc("rdw-bare", "RDW", null, { result: "partial", measurementDefinitionKey: null, missingAxes: ["unit"] }), cbc("plt", "Platelets (PLT)", "x10^9/L", { result: "resolved", measurementDefinitionKey: "platelets_whole_blood" }), cbc("mpv", "Mean platelet volume (MPV)", "fL", { result: "resolved", measurementDefinitionKey: "mpv_whole_blood" }), cbc("pdw", "Platelet distribution width (PDW)", "%", { result: "resolved", measurementDefinitionKey: "pdw_cv" }), cbc("pct", "Plateletcrit (PCT)", "%", { result: "resolved", measurementDefinitionKey: "plateletcrit_percent" }), cbc("wbc", "White blood cells (WBC)", "x10^9/L", { result: "resolved", measurementDefinitionKey: "wbc_whole_blood" }),
  ...differential.flatMap(([analyte, abbreviation, russian]) => [
    cbc(`${analyte}-percent`, `${analyte[0]!.toUpperCase()}${analyte.slice(1)} (${abbreviation}%)`, "%", { result: "resolved", measurementDefinitionKey: `${analyte}_percent` }),
    cbc(`${analyte}-abs`, `${analyte[0]!.toUpperCase()}${analyte.slice(1)}, absolute (${abbreviation})`, "x10^9/L", { result: "resolved", measurementDefinitionKey: `${analyte}_abs` }),
    cbc(`${analyte}-ru-percent`, `${russian} (${abbreviation}%)`, "%", { result: "resolved", measurementDefinitionKey: `${analyte}_percent` }),
    cbc(`${analyte}-unit-conflict`, abbreviation, "%", { result: "resolved", measurementDefinitionKey: `${analyte}_percent` }),
  ]),
  cbc("retic-percent", "Reticulocytes (RETIC%)", "%", { result: "resolved", measurementDefinitionKey: "reticulocytes_percent" }), cbc("retic-abs", "Reticulocytes, absolute (RETIC)", "x10^9/L", { result: "resolved", measurementDefinitionKey: "reticulocytes_abs" }),
  cbc("segmented", "Segmented neutrophils", "%", { result: "resolved", measurementDefinitionKey: "segmented_neutrophils_percent" }, { method: "manual" }), cbc("band", "Band neutrophils", "%", { result: "resolved", measurementDefinitionKey: "band_neutrophils_percent" }, { method: "manual" }), cbc("segmented-missing-method", "Segmented neutrophils", "%", { result: "partial", measurementDefinitionKey: null, missingAxes: ["method"] }), cbc("band-automated-conflict", "Band neutrophils", "%", { result: "partial", measurementDefinitionKey: null, conflicts: ["method_conflict"] }, { method: "automated" }),
  cbc("missing-specimen", "NEU", "%", { result: "partial", measurementDefinitionKey: null, missingAxes: ["specimen"] }, { specimen: "unspecified" }), cbc("missing-value-kind", "NEU", "%", { result: "partial", measurementDefinitionKey: null, missingAxes: ["value_kind"] }, { valueKind: "unspecified" }),
  { id: "ocr-negative", rawLabel: "Neutrophils (NEU7)", rawUnit: "%", valueKind: "numeric", section: "CBC", specimen: "whole_blood", expected: { result: "unmapped", measurementDefinitionKey: null } },
  numeric("esr", "ESR, Westergren automated", "mm/hour", "CBC"),
  qualitative("giardia", "Giardia antibodies, total", "positivity coefficient"), qualitative("ascaris", "Ascaris IgG antibodies", "titer"), qualitative("toxocara", "anti-Toxocara IgG, qualitative ELISA", null), qualitative("opisthorchis", "anti-Opisthorchis felineus IgG, qualitative ELISA", null), qualitative("echinococcus", "anti-Echinococcus IgG, qualitative ELISA", null), qualitative("trichinella", "anti-Trichinella sp. IgG, qualitative ELISA", null), numeric("total-ige", "Total IgE", "IU/mL", "Serology, parasitology, allergy markers"), numeric("ecp", "Eosinophilic cationic protein (ECP)", "ng/mL", "Serology, parasitology, allergy markers"),
];

export function buildLaunchCoverageReport(fixtures = SAMPLE_NEWEST_LAUNCH_FIXTURES) {
  const rows = fixtures.map((fixture) => ({ fixture, resolution: resolveMeasurementDefinition(fixture) }));
  const count = (predicate: (row: (typeof rows)[number]) => boolean) => rows.filter(predicate).length;
  const cbcRows = rows.filter((row) => row.fixture.section === "CBC");
  const countCbc = (predicate: (row: (typeof rows)[number]) => boolean) => cbcRows.filter(predicate).length;
  const missingAxes = [...new Set(cbcRows.flatMap((row) => row.resolution.missingAxes))].sort();
  const aliasMatchCodes = [...new Set(cbcRows.flatMap((row) => row.resolution.candidateEvidence.flatMap((candidate) => candidate.accepted.filter((item) => item.source === "label").map((item) => item.code))))].sort();
  return {
    total: rows.length,
    recognized: count((row) => row.resolution.result !== "unmapped"),
    resolved: count((row) => row.resolution.result === "resolved"),
    ambiguous: count((row) => row.resolution.result === "ambiguous"),
    partial: count((row) => row.resolution.result === "partial"),
    unmapped: count((row) => row.resolution.result === "unmapped"),
    unitCompatible: count((row) => !row.resolution.conflicts.some((conflict) => conflict.startsWith("unit_"))),
    valueKindDeclared: count((row) => row.fixture.valueKind !== "unspecified"),
    assessmentEligible: count((row) => row.resolution.result === "resolved"),
    cbc: {
      total: countCbc(() => true),
      resolved: countCbc((row) => row.resolution.result === "resolved"),
      partial: countCbc((row) => row.resolution.result === "partial"),
      ambiguous: countCbc((row) => row.resolution.result === "ambiguous"),
      unmapped: countCbc((row) => row.resolution.result === "unmapped"),
      byMissingAxis: Object.fromEntries(missingAxes.map((axis) => [axis, countCbc((row) => row.resolution.missingAxes.includes(axis))])),
      byAliasMatch: Object.fromEntries(aliasMatchCodes.map((code) => [code, countCbc((row) => row.resolution.reasons.includes(code))])),
      byMaturity: {
        reviewed: countCbc((row) => row.resolution.measurementDefinitionKey !== null),
        incomplete: countCbc((row) => row.resolution.measurementDefinitionKey === null),
      },
    },
    rows,
  };
}
