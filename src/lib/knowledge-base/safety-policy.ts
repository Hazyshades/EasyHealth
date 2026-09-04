export type KnowledgeBaseSafetyFindingCode =
  | "prohibited_claim"
  | "external_reference_range"
  | "assessment_coupling";

export type KnowledgeBaseSafetyTarget = {
  id: string;
  content: string;
  metadata?: unknown;
  metadataText?: string;
};

export type KnowledgeBaseSafetyFinding = {
  code: KnowledgeBaseSafetyFindingCode;
  rule: string;
  targetId: string;
  excerpt: string;
  field?: string;
};

type TextRule = {
  rule: string;
  pattern: RegExp;
};

/**
 * These patterns intentionally cover only high-confidence claims. The policy
 * is a release-gate tripwire, not a clinical language classifier; every
 * finding must still be reviewed by the clinical/editorial owner.
 */
const PROHIBITED_CLAIM_RULES: readonly TextRule[] = [
  {
    rule: "personal_diagnosis_or_certainty",
    pattern:
      /\b(?:you|your\s+(?:result|level|value|test))\s+(?:(?:(?:do|does)\s+not|(?:don't|doesn't))\s+)?(?:have|has|show(?:s)?|confirm(?:s)?|prove(?:s)?|rule(?:s)?\s+out|diagnos(?:e|es|ed)|indicat(?:e|es))\b/i,
  },
  {
    rule: "diagnostic_conclusion",
    pattern:
      /\b(?:diagnostic of|diagnoses?\s+you|confirms?\s+(?:that\s+)?you|rules?\s+out\s+(?:a|the)\s+diagnosis)\b/i,
  },
  {
    rule: "treatment_or_medication_instruction",
    pattern:
      /\b(?:you|your)\s+(?:should|must|need to)\s+(?:start|stop|change|adjust|increase|decrease|take|skip|replace)\s+(?:your\s+)?(?:medication|medicine|dose|treatment|supplement)\b/i,
  },
  {
    rule: "test_order_instruction",
    pattern:
      /\b(?:you\s+(?:should|must|need to)\s+)?(?:order|book|schedule|request|get)\s+(?:a|an|your\s+)?(?:lab\s+)?(?:test|panel|screening|blood\s+work)\b/i,
  },
  {
    rule: "universal_interpretation",
    pattern:
      /\b(?:normal|abnormal|healthy|unhealthy|safe)\s+(?:range|level|value|result|cut[- ]?off)\b/i,
  },
];

const EXTERNAL_RANGE_TEXT_RULES: readonly TextRule[] = [
  {
    rule: "reference_range_language",
    pattern: /\b(?:reference|normal|healthy|expected)\s+range\b/i,
  },
  {
    rule: "numeric_range_with_unit",
    pattern:
      /\b(?:\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(?:\d+(?:\.\d+)?)\s*(?:mg\/?dL|mmol\/?L|g\/?L|µ?mol\/?L|U\/?L|%|mmHg|mL\/?min(?:\/?1\.73m2)?)\b/i,
  },
  {
    rule: "contextual_numeric_range",
    pattern:
      /\b(?:normal|reference|healthy|expected)\b[^.!?\n]{0,48}\b\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\b/i,
  },
];

const EXTERNAL_RANGE_METADATA_KEYS: Readonly<Record<string, true>> = {
  reference_range: true,
  normal_range: true,
  healthy_range: true,
  expected_range: true,
  ref_low: true,
  ref_high: true,
  lower_bound: true,
  upper_bound: true,
};

const ASSESSMENT_METADATA_KEYS: Readonly<Record<string, true>> = {
  assessment: true,
  assessment_input: true,
  assessment_inputs: true,
  eligibility: true,
  score: true,
  score_input: true,
  scoring: true,
};

function excerptAround(value: string, index: number, length: number): string {
  const radius = 56;
  const start = Math.max(0, index - radius);
  const end = Math.min(value.length, index + length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < value.length ? "…" : "";
  return `${prefix}${value.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

function normalizeMetadataKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/gi, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

type MetadataRule = {
  code: "external_reference_range" | "assessment_coupling";
  rule: string;
};

function metadataRuleForKey(normalized: string): MetadataRule | null {
  if (EXTERNAL_RANGE_METADATA_KEYS[normalized]) {
    return {
      code: "external_reference_range",
      rule: "forbidden_range_metadata",
    };
  }
  if (ASSESSMENT_METADATA_KEYS[normalized]) {
    return {
      code: "assessment_coupling",
      rule: "forbidden_assessment_metadata",
    };
  }
  return null;
}

const SOURCE_METADATA_KEY_PATTERN =
  /(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*))\s*\??\s*(?::|=)/g;

function scanMetadataText(
  source: string,
  targetId: string,
  findings: KnowledgeBaseSafetyFinding[],
): void {
  for (const match of source.matchAll(SOURCE_METADATA_KEY_PATTERN)) {
    const rawKey = match[1] ?? match[2] ?? match[3];
    if (!rawKey) continue;
    const metadataRule = metadataRuleForKey(normalizeMetadataKey(rawKey));
    if (!metadataRule) continue;
    const matchIndex = match.index ?? 0;
    findings.push({
      ...metadataRule,
      targetId,
      field: rawKey,
      excerpt: excerptAround(source, matchIndex, rawKey.length),
    });
  }
}

function addTextFinding(
  findings: KnowledgeBaseSafetyFinding[],
  targetId: string,
  code: KnowledgeBaseSafetyFindingCode,
  rule: string,
  content: string,
  match: RegExpExecArray,
): void {
  findings.push({
    code,
    rule,
    targetId,
    excerpt: excerptAround(content, match.index, match[0].length),
  });
}

function scanText(
  target: Pick<KnowledgeBaseSafetyTarget, "id" | "content">,
): KnowledgeBaseSafetyFinding[] {
  const findings: KnowledgeBaseSafetyFinding[] = [];
  for (const rule of PROHIBITED_CLAIM_RULES) {
    const match = rule.pattern.exec(target.content);
    if (match) {
      addTextFinding(
        findings,
        target.id,
        "prohibited_claim",
        rule.rule,
        target.content,
        match,
      );
    }
  }
  for (const rule of EXTERNAL_RANGE_TEXT_RULES) {
    const match = rule.pattern.exec(target.content);
    if (match) {
      addTextFinding(
        findings,
        target.id,
        "external_reference_range",
        rule.rule,
        target.content,
        match,
      );
    }
  }
  return findings;
}

function scanMetadata(
  value: unknown,
  targetId: string,
  path: string,
  findings: KnowledgeBaseSafetyFinding[],
  seen: Set<object>,
): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanMetadata(item, targetId, `${path}[${index}]`, findings, seen),
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const keyPath = path === "$" ? key : `${path}.${key}`;
    const metadataRule = metadataRuleForKey(normalizeMetadataKey(key));
    if (metadataRule) {
      findings.push({
        ...metadataRule,
        targetId,
        field: keyPath,
        excerpt: `metadata field ${keyPath}`,
      });
    }
    scanMetadata(child, targetId, keyPath, findings, seen);
  }
}

/**
 * Audits rendered Knowledge Base copy and optional article metadata.
 *
 * The function is deliberately pure: callers decide whether a finding blocks
 * publication, while the returned evidence remains suitable for CI output or
 * a clinical/editorial review record.
 */
export function auditKnowledgeBaseSafety(
  target: KnowledgeBaseSafetyTarget,
): readonly KnowledgeBaseSafetyFinding[] {
  const findings = scanText(target);
  if (target.metadata !== undefined) {
    scanMetadata(target.metadata, target.id, "$", findings, new Set<object>());
  }
  if (target.metadataText !== undefined) {
    scanMetadataText(target.metadataText, target.id, findings);
  }
  return findings;
}

export const KNOWLEDGE_BASE_SAFETY_RULES = Object.freeze({
  prohibitedClaimRules: PROHIBITED_CLAIM_RULES.map(({ rule }) => rule),
  externalRangeTextRules: EXTERNAL_RANGE_TEXT_RULES.map(({ rule }) => rule),
  externalRangeMetadataKeys: Object.keys(EXTERNAL_RANGE_METADATA_KEYS),
  assessmentMetadataKeys: Object.keys(ASSESSMENT_METADATA_KEYS),
});
