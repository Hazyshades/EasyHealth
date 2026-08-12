import { analyzeMeasurementLabel, normalizeMeasurementLabel } from "./normalize";
import type { AliasDefinition, MeasurementDefinition } from "./types";

/** Locales admitted by the multilingual lab pipeline. */
export type MeasurementAliasLocale = "en" | "ru" | "es";

/**
 * First multilingual launch slice: every key here must carry reviewed
 * active aliases for en, ru, and es.
 */
export const MULTILINGUAL_LAUNCH_SLICE_KEYS: readonly string[] = [
  // Glucose / HbA1c
  "glucose_serum",
  "glucose_plasma",
  "glucose_whole_blood",
  "fasting_glucose",
  "post_prandial_glucose_plasma",
  "glucose_urine_dipstick",
  "hba1c_whole_blood",
  // Lipids
  "ldl_serum",
  "non_hdl_cholesterol_serum",
  "hdl_serum",
  "triglycerides_serum",
  "total_cholesterol_serum",
  // Thyroid
  "tsh_serum",
  "free_t4_serum",
  // Liver
  "alt_serum_catalytic_activity",
  "alt_plasma_catalytic_activity",
  "ast_serum_catalytic_activity",
  "ast_plasma_catalytic_activity",
  "alp_serum_catalytic_activity",
  "alp_plasma_catalytic_activity",
  "ggt_serum_catalytic_activity",
  "ggt_plasma_catalytic_activity",
  "bilirubin_serum",
  "albumin_serum",
  // Kidney / electrolytes
  "egfr",
  "creatinine_serum",
  "uacr_urine",
  "bun_serum",
  "urea_serum",
  "sodium_serum",
  "potassium_serum",
  "chloride_serum",
  "bicarbonate_serum",
  "calcium_serum",
  // CBC core + common differentials already in launch catalog
  "hemoglobin_whole_blood",
  "hematocrit_whole_blood",
  "rbc_whole_blood",
  "wbc_whole_blood",
  "platelets_whole_blood",
  "mcv_whole_blood",
  "mch_whole_blood",
  "mchc_whole_blood",
  "mpv_whole_blood",
  "pdw_cv",
  "plateletcrit_percent",
  "rdw_cv",
  "rdw_sd",
  "neutrophils_percent",
  "neutrophils_abs",
  "lymphocytes_percent",
  "lymphocytes_abs",
  "monocytes_percent",
  "monocytes_abs",
  "eosinophils_percent",
  "eosinophils_abs",
  "basophils_percent",
  "basophils_abs",
  "reticulocytes_percent",
  "reticulocytes_abs",
  "segmented_neutrophils_percent",
  "band_neutrophils_percent",
  // Inflammation / nutrients present in reviewed set
  "crp_serum",
  "vitamin_d_serum",
  "b12_serum",
  "folate_serum",
] as const;

const SLICE_KEY_SET: Record<string, true> = Object.fromEntries(
  MULTILINGUAL_LAUNCH_SLICE_KEYS.map((key) => [key, true as const]),
);

export function isMultilingualLaunchSliceKey(key: string): boolean {
  return SLICE_KEY_SET[key] === true;
}

/** Shared RU/ES literals keyed by analyte (applied to each specimen variant). */
const ANALYTE_LOCALE_PACKS: Record<string, { ru: readonly string[]; es: readonly string[] }> = {
  glucose: {
    ru: ["глюкоза", "сахар крови", "глюкоза крови", "глюкоза (glucose)"],
    es: ["glucosa", "glucosa en sangre", "glucosa (glu)"],
  },
  fasting_glucose: {
    ru: ["глюкоза натощак", "глюкоза натощак (fpg)"],
    es: ["glucosa en ayunas", "glucosa basal", "glicemia en ayunas"],
  },
  hba1c: {
    ru: ["гликированный гемоглобин", "гликогемоглобин", "hb a1c", "гликированный hb"],
    es: ["hemoglobina glucosilada", "hemoglobina glicosilada", "hba1c", "hb a1c"],
  },
  ldl: {
    ru: ["лпнп", "хс лпнп", "холестерин лпнп", "лдл"],
    es: ["colesterol ldl", "ldl", "c-ldl"],
  },
  hdl: {
    ru: ["лпвп", "хс лпвп", "холестерин лпвп"],
    es: ["colesterol hdl", "hdl", "c-hdl"],
  },
  triglycerides: {
    ru: ["триглицериды", "тг", "триглицериды (tg)"],
    es: ["triglicéridos", "trigliceridos", "tg"],
  },
  total_cholesterol: {
    ru: ["общий холестерин", "холестерин общий", "охс"],
    es: ["colesterol total", "colesterol"],
  },
  non_hdl_cholesterol: {
    ru: ["холестерин не лпвп", "не лпвп"],
    es: ["colesterol no hdl", "colesterol non-hdl"],
  },
  tsh: {
    ru: ["ттг", "тиреотропный гормон", "тш"],
    es: ["tsh", "tirotropina", "hormona estimulante de la tiroides"],
  },
  free_t4: {
    ru: ["свободный т4", "св т4", "т4 свободный", "свободный тироксин"],
    es: ["t4 libre", "tiroxina libre", "ft4"],
  },
  alt: {
    ru: ["алт", "аланинаминотрансфераза", "алат"],
    es: ["alt", "alat", "alanina aminotransferasa"],
  },
  ast: {
    ru: ["аст", "аспартатаминотрансфераза", "асат"],
    es: ["ast", "asat", "aspartato aminotransferasa"],
  },
  alp: {
    ru: ["щелочная фосфатаза", "щф", "alp"],
    es: ["fosfatasa alcalina", "fa", "alp"],
  },
  ggt: {
    ru: ["ггт", "гамма гт", "гамма-глутамилтрансфераза"],
    es: ["ggt", "gamma gt", "gamma glutamil transferasa"],
  },
  bilirubin: {
    ru: ["билирубин", "билирубин общий", "общий билирубин"],
    es: ["bilirrubina", "bilirrubina total"],
  },
  albumin: {
    ru: ["альбумин", "альбумин сыворотки"],
    es: ["albúmina", "albumina"],
  },
  egfr: {
    ru: ["скф", "рскф", "скорость клубочковой фильтрации"],
    es: ["tfg", "fg", "filtración glomerular estimada"],
  },
  creatinine: {
    ru: ["креатинин", "креатинин сыворотки"],
    es: ["creatinina", "creatinina sérica"],
  },
  uacr: {
    ru: ["альбумин креатинин", "соотношение альбумин креатинин", "а/кр"],
    es: ["cociente albumina creatinina", "rac", "uacr"],
  },
  bun: {
    ru: ["азот мочевины", "bun"],
    es: ["nitrogeno ureico", "bun", "nitrógeno ureico"],
  },
  urea: {
    ru: ["мочевина"],
    es: ["urea"],
  },
  sodium: {
    ru: ["натрий", "na"],
    es: ["sodio", "na"],
  },
  potassium: {
    ru: ["калий", "k"],
    es: ["potasio", "k"],
  },
  chloride: {
    ru: ["хлор", "хлориды", "cl"],
    es: ["cloro", "cloruro", "cl"],
  },
  bicarbonate: {
    ru: ["бикарбонат", "гидрокарбонат", "со2"],
    es: ["bicarbonato", "co2"],
  },
  calcium: {
    ru: ["кальций", "ca"],
    es: ["calcio", "ca"],
  },
  hemoglobin: {
    ru: ["гемоглобин", "гемоглобин (hgb)", "hb"],
    es: ["hemoglobina", "hemoglobina (hgb)", "hb"],
  },
  hematocrit: {
    ru: ["гематокрит", "гематокрит (hct)"],
    es: ["hematocrito", "hematocrito (hct)"],
  },
  rbc: {
    ru: ["эритроциты", "эритроциты (rbc)"],
    es: ["eritrocitos", "glóbulos rojos", "rbc"],
  },
  wbc: {
    ru: ["лейкоциты", "лейкоциты (wbc)"],
    es: ["leucocitos", "glóbulos blancos", "wbc"],
  },
  platelets: {
    ru: ["тромбоциты", "тромбоциты (plt)"],
    es: ["plaquetas", "plaquetas (plt)"],
  },
  mcv: {
    ru: ["средний объем эритроцита", "mcv"],
    es: ["volumen corpuscular medio", "vcm", "mcv"],
  },
  mch: {
    ru: ["среднее содержание hb", "mch"],
    es: ["hemoglobina corpuscular media", "hcm", "mch"],
  },
  mchc: {
    ru: ["средняя концентрация hb", "mchc"],
    es: ["concentración de hb corpuscular", "chcm", "mchc"],
  },
  mpv: {
    ru: ["средний объем тромбоцита", "mpv"],
    es: ["volumen plaquetario medio", "vpm", "mpv"],
  },
  pdw: {
    ru: ["ширина распределения тромбоцитов", "pdw"],
    es: ["ancho de distribución plaquetaria", "pdw"],
  },
  plateletcrit: {
    ru: ["тромбокрит", "pct"],
    es: ["plaquetocrito", "pct"],
  },
  red_cell_distribution_width: {
    ru: ["рдв", "ширина распределения эритроцитов", "rdw"],
    es: ["ancho de distribución eritrocitaria", "rdw", "ade"],
  },
  neutrophils: {
    ru: ["нейтрофилы", "нейтрофилы (neu)", "нейтрофилы %"],
    es: ["neutrófilos", "neutrofilos", "neu"],
  },
  lymphocytes: {
    ru: ["лимфоциты", "лимфоциты (lym)", "лимфоциты %"],
    es: ["linfocitos", "lym"],
  },
  monocytes: {
    ru: ["моноциты", "моноциты (mon)"],
    es: ["monocitos", "mon"],
  },
  eosinophils: {
    ru: ["эозинофилы", "эозинофилы (eos)"],
    es: ["eosinófilos", "eosinofilos", "eos"],
  },
  basophils: {
    ru: ["базофилы", "базофилы (bas)"],
    es: ["basófilos", "basofilos", "bas"],
  },
  reticulocytes: {
    ru: ["ретикулоциты", "ретикулоциты %"],
    es: ["reticulocitos", "reticulocitos %"],
  },
  crp: {
    ru: ["срб", "с-реактивный белок", "c реактивный белок"],
    es: ["pcr", "proteína c reactiva", "proteina c reactiva"],
  },
  vitamin_d: {
    ru: ["витамин d", "25 он витамин d", "25-oh d"],
    es: ["vitamina d", "25 oh vitamina d", "25-hidroxivitamina d"],
  },
  b12: {
    ru: ["витамин b12", "b12", "цианокобаламин"],
    es: ["vitamina b12", "b12", "cobalamina"],
  },
  folate: {
    ru: ["фолаты", "фолиевая кислота"],
    es: ["folato", "ácido fólico", "acido folico"],
  },
};

type LocaleAliasSeed = {
  value: string;
  locale: MeasurementAliasLocale;
  matchType: "normalized";
  source: "laboratory" | "registry";
};

function localeSeeds(
  values: readonly string[],
  locale: MeasurementAliasLocale,
): LocaleAliasSeed[] {
  return [...new Set(values)].map((value) => ({
    value,
    locale,
    matchType: "normalized" as const,
    source: locale === "en" ? ("registry" as const) : ("laboratory" as const),
  }));
}

/** Definition keys whose wording must not inherit the generic analyte pack. */
const DEFINITION_LOCALE_PACKS: Record<string, { ru: readonly string[]; es: readonly string[] }> = {
  rdw_cv: {
    ru: ["рдв cv", "rdw cv", "ширина распределения эритроцитов cv"],
    es: ["rdw cv", "ade cv"],
  },
  rdw_sd: {
    ru: ["рдв sd", "rdw sd", "ширина распределения эритроцитов sd"],
    es: ["rdw sd", "ade sd"],
  },
  segmented_neutrophils_percent: {
    ru: ["сегментоядерные нейтрофилы", "сегментоядерные"],
    es: ["neutrófilos segmentados", "segmentados"],
  },
  band_neutrophils_percent: {
    ru: ["палочкоядерные нейтрофилы", "палочкоядерные"],
    es: ["neutrófilos en banda", "cayados"],
  },
  post_prandial_glucose_plasma: {
    ru: ["глюкоза после еды", "постпрандиальная глюкоза", "ппг"],
    es: ["glucosa postprandial", "glucemia postprandial"],
  },
  fasting_glucose: {
    ru: ["глюкоза натощак", "гликемия натощак"],
    es: ["glucosa en ayunas", "glucosa basal", "glicemia en ayunas"],
  },
  glucose_urine_dipstick: {
    ru: ["глюкоза мочи", "сахар в моче"],
    es: ["glucosa en orina", "glucosuria"],
  },
  reticulocytes_percent: {
    ru: ["ретикулоциты процент", "ретикулоциты %"],
    es: ["reticulocitos porcentaje", "reticulocitos %"],
  },
  reticulocytes_abs: {
    ru: ["ретикулоциты абсолютное", "ретикулоциты абс"],
    es: ["reticulocitos absolutos", "reticulocitos abs"],
  },
};

function packForDefinition(definition: MeasurementDefinition): {
  ru: readonly string[];
  es: readonly string[];
} {
  return (
    DEFINITION_LOCALE_PACKS[definition.key] ??
    ANALYTE_LOCALE_PACKS[definition.analyteKey] ?? { ru: [], es: [] }
  );
}

function toAliasDefinition(
  definition: MeasurementDefinition,
  seed: LocaleAliasSeed,
  index: number,
): AliasDefinition {
  const analysis = analyzeMeasurementLabel(seed.value);
  return {
    key: `${definition.key}:${seed.locale}:${seed.source}:${index}`,
    measurementDefinitionKey: definition.key,
    value: seed.value,
    normalizedValue: analysis.primary,
    source: seed.source,
    matchType: seed.matchType,
    matchAuthority: "reviewed_resolution",
    approvalStatus: "reviewed",
    lifecycle: "active",
    provenance: definition.sourceProvenance,
    reviewReference: "multilingual-launch-slice-v1",
    locale: seed.locale,
  };
}

/**
 * Ensure every alias has a locale and attach RU/ES packs for the launch slice.
 * Existing EN aliases without locale default to `en`.
 */
export function applyMultilingualAliasEnrichment(
  definitions: readonly MeasurementDefinition[],
): MeasurementDefinition[] {
  return definitions.map((definition) => {
    const withLocales: AliasDefinition[] = definition.aliases.map((alias) => {
      const locale = (alias.locale as MeasurementAliasLocale | undefined) ?? "en";
      const normalizedValue = normalizeMeasurementLabel(alias.value);
      return {
        ...alias,
        locale,
        normalizedValue,
      };
    });

    if (definition.maturity !== "reviewed" || !isMultilingualLaunchSliceKey(definition.key)) {
      return { ...definition, aliases: withLocales };
    }

    const pack = packForDefinition(definition);
    const existingNorm = new Set(
      withLocales
        .filter((alias) => alias.lifecycle === "active")
        .map((alias) => `${alias.locale}|${alias.normalizedValue}`),
    );

    const extras: AliasDefinition[] = [];
    let index = withLocales.length + 1;
    for (const seed of [
      ...localeSeeds(pack.ru, "ru"),
      ...localeSeeds(pack.es, "es"),
    ]) {
      const analysis = analyzeMeasurementLabel(seed.value);
      if (analysis.isEmpty || analysis.isWeak) continue;
      const dedupeKey = `${seed.locale}|${analysis.primary}`;
      if (existingNorm.has(dedupeKey)) continue;
      existingNorm.add(dedupeKey);
      extras.push(toAliasDefinition(definition, seed, index));
      index += 1;
    }

    return { ...definition, aliases: [...withLocales, ...extras] };
  });
}

export function listMissingMultilingualSliceLocales(
  definitions: readonly MeasurementDefinition[],
): string[] {
  const missing: string[] = [];
  for (const key of MULTILINGUAL_LAUNCH_SLICE_KEYS) {
    const definition = definitions.find((item) => item.key === key);
    if (!definition) {
      missing.push(`${key}: missing definition`);
      continue;
    }
    for (const locale of ["en", "ru", "es"] as const) {
      const has = definition.aliases.some(
        (alias) =>
          alias.lifecycle === "active" &&
          alias.approvalStatus === "reviewed" &&
          alias.matchAuthority === "reviewed_resolution" &&
          alias.locale === locale &&
          !analyzeMeasurementLabel(alias.value).isEmpty &&
          !analyzeMeasurementLabel(alias.value).isWeak,
      );
      if (!has) missing.push(`${key}: missing reviewed ${locale} alias`);
    }
  }
  return missing;
}
