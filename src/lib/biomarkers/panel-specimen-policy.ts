/**
 * Reviewed panel specimen policies: a captured section heading may supply a
 * specimen only through a digest-covered catalog entity, never a per-row guess.
 */
import type { MeasurementSourceProvenance, SpecimenKey } from "./types";
import { normalizeMeasurementLabel } from "./normalize";

export type PanelSpecimenPolicyMaturity = "reviewed" | "provisional";

export type PanelSpecimenPolicy = {
  key: string;
  displayName: string;
  headingForms: readonly string[];
  specimen: SpecimenKey;
  appliesToAnalytes: readonly string[];
  maturity: PanelSpecimenPolicyMaturity;
  sourceProvenance: MeasurementSourceProvenance;
  reviewReference: string;
};

/**
 * Complete-blood-count constituents only. `glucose` and `hba1c` are excluded
 * deliberately: both have reviewed whole-blood definitions and both affect
 * scoring, so an unnarrowed CBC heading must never select them.
 */
const CBC_ANALYTES = [
  "basophils",
  "eosinophils",
  "hematocrit",
  "hemoglobin",
  "lymphocytes",
  "mch",
  "mchc",
  "mcv",
  "monocytes",
  "mpv",
  "neutrophils",
  "pdw",
  "plateletcrit",
  "platelets",
  "rbc",
  "red_cell_distribution_width",
  "reticulocytes",
  "wbc",
] as const;

export const PANEL_SPECIMEN_POLICY_SCORE_AFFECTING_KEYS = [
  "hemoglobin_whole_blood",
  "hematocrit_whole_blood",
  "rbc_whole_blood",
  "wbc_whole_blood",
  "platelets_whole_blood",
  "rdw_cv",
  "rdw_sd",
] as const;

export const CBC_WHOLE_BLOOD_PANEL_POLICY: PanelSpecimenPolicy = {
  key: "cbc_whole_blood",
  displayName: "Complete blood count implies whole blood",
  headingForms: [
    "complete blood count",
    "cbc",
    "full blood count",
    "fbc",
    "общий анализ крови",
    "оак",
  ],
  specimen: "whole_blood",
  appliesToAnalytes: CBC_ANALYTES,
  maturity: "reviewed",
  sourceProvenance: {
    kind: "registry_v2_review",
    sourceRecordKey: "panel-specimen-policy:cbc_whole_blood",
  },
  reviewReference: "issue-111",
};

export const PANEL_SPECIMEN_POLICIES: readonly PanelSpecimenPolicy[] = [
  CBC_WHOLE_BLOOD_PANEL_POLICY,
];

function headingTokens(value: string): string[] {
  return normalizeMeasurementLabel(value).split(" ").filter((token) => token.length > 0);
}

export function headingMatchesForm(heading: string, form: string): boolean {
  const headingToks = headingTokens(heading);
  const formToks = headingTokens(form);
  if (headingToks.length === 0 || formToks.length === 0) return false;
  if (headingToks.length < formToks.length) return false;
  for (let i = 0; i <= headingToks.length - formToks.length; i++) {
    if (formToks.every((token, offset) => headingToks[i + offset] === token)) return true;
  }
  return false;
}

export function headingVerifiedInPageText(heading: string, ocrText: string | null | undefined): boolean {
  const captured = heading.trim();
  if (!captured) return false;
  if (!ocrText) return false;
  return ocrText.includes(captured);
}

/** Persistable `document_pages` rows → the map the worker uses at insert time. */
export function pageOcrTextByNumber(
  pages: ReadonlyArray<{ page_number: number; ocr_text: string | null | undefined }>,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const page of pages) {
    map.set(page.page_number, page.ocr_text ?? "");
  }
  return map;
}

/**
 * Worker insert seam: keep a transcribed heading only when it occurs in the
 * OCR of that row's own page. A heading copied from another page is dropped.
 */
export function groundCapturedHeadingToPageOcr(
  heading: string | null | undefined,
  pageNumber: number | null | undefined,
  pageTextByNumber: ReadonlyMap<number, string>,
): string | null {
  const captured = heading?.trim() || null;
  if (!captured) return null;
  if (pageNumber == null) return null;
  const pageOcr = pageTextByNumber.get(pageNumber) ?? "";
  return headingVerifiedInPageText(captured, pageOcr) ? captured : null;
}

export function matchReviewedPanelSpecimenPolicy(
  heading: string | null | undefined,
  analyteKey: string | null | undefined,
  policies: readonly PanelSpecimenPolicy[] = PANEL_SPECIMEN_POLICIES,
): PanelSpecimenPolicy | null {
  const captured = heading?.trim() ?? "";
  const analyte = analyteKey?.trim() ?? "";
  if (!captured || !analyte) return null;
  const matches = policies.filter((policy) => {
    if (policy.maturity !== "reviewed") return false;
    if (!policy.appliesToAnalytes.includes(analyte)) return false;
    return policy.headingForms.some((form) => headingMatchesForm(captured, form));
  });
  if (matches.length !== 1) return null;
  return matches[0] ?? null;
}

export type PanelSpecimenPolicyValidation = { valid: boolean; errors: string[] };

export function validatePanelSpecimenPolicies(
  policies: readonly PanelSpecimenPolicy[] = PANEL_SPECIMEN_POLICIES,
  knownAnalytes: ReadonlySet<string>,
): PanelSpecimenPolicyValidation {
  const errors: string[] = [];
  const keys = new Set<string>();
  const formOwners = new Map<string, string>();
  for (const policy of policies) {
    if (!policy.key) errors.push("panel specimen policy is missing a key");
    if (keys.has(policy.key)) errors.push(`duplicate panel specimen policy key: ${policy.key}`);
    keys.add(policy.key);
    if (policy.maturity !== "reviewed" && policy.maturity !== "provisional") {
      errors.push(`panel specimen policy ${policy.key} has an invalid maturity`);
    }
    if (!policy.headingForms.length) {
      errors.push(`panel specimen policy ${policy.key} has no heading forms`);
    }
    if (policy.specimen === "unspecified") {
      errors.push(`panel specimen policy ${policy.key} must supply a concrete specimen`);
    }
    if (!policy.appliesToAnalytes.length) {
      errors.push(`panel specimen policy ${policy.key} has an empty analyte allowlist`);
    }
    for (const analyte of policy.appliesToAnalytes) {
      if (!knownAnalytes.has(analyte)) {
        errors.push(`panel specimen policy ${policy.key} lists unknown analyte ${analyte}`);
      }
    }
    if (policy.key === "cbc_whole_blood") {
      if (policy.appliesToAnalytes.includes("glucose") || policy.appliesToAnalytes.includes("hba1c")) {
        errors.push("cbc_whole_blood must exclude glucose and hba1c");
      }
    }
    for (const form of policy.headingForms) {
      const normalized = normalizeMeasurementLabel(form);
      if (!normalized) {
        errors.push(`panel specimen policy ${policy.key} has an empty heading form`);
        continue;
      }
      const owner = formOwners.get(normalized);
      if (owner && owner !== policy.key) {
        errors.push(`heading form "${normalized}" is claimed by ${owner} and ${policy.key}`);
      }
      formOwners.set(normalized, policy.key);
    }
    if (!policy.sourceProvenance?.sourceRecordKey) {
      errors.push(`panel specimen policy ${policy.key} lacks source provenance`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function uncoveredCapturedHeadings(
  headings: ReadonlyArray<{ heading: string | null | undefined; count?: number }>,
  policies: readonly PanelSpecimenPolicy[] = PANEL_SPECIMEN_POLICIES,
): Array<{ heading: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of headings) {
    const heading = row.heading?.trim() ?? "";
    if (!heading) continue;
    const reviewed = policies.filter((policy) => policy.maturity === "reviewed");
    const matched = reviewed.some((policy) =>
      policy.headingForms.some((form) => headingMatchesForm(heading, form)),
    );
    if (matched) continue;
    counts.set(heading, (counts.get(heading) ?? 0) + (row.count ?? 1));
  }
  return [...counts.entries()]
    .map(([heading, count]) => ({ heading, count }))
    .sort((left, right) => right.count - left.count || left.heading.localeCompare(right.heading));
}
