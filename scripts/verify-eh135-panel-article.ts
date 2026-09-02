import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CBC_PANEL_ARTICLE,
  getPanelArticleBySlug,
  PANEL_ARTICLES,
  selectPanelArticleResults,
  validateKnowledgeBaseArticle,
  validatePanelArticle,
  type PanelArticle,
  type PanelArticleObservation,
} from "../src/lib/knowledge-base";
import { getPanelDefinition } from "../src/lib/biomarkers";

const cbcPanel = getPanelDefinition("cbc");
assert.ok(cbcPanel, "the CBC panel must exist in Registry 2.0");

const articleValidation = validatePanelArticle(CBC_PANEL_ARTICLE, cbcPanel);
assert.equal(PANEL_ARTICLES.length, 1);
assert.deepEqual(
  articleValidation.errors,
  [],
  "the checked-in CBC article must be valid",
);
assert.equal(validateKnowledgeBaseArticle(CBC_PANEL_ARTICLE).valid, true);
assert.equal(CBC_PANEL_ARTICLE.reviewStatus, "in_review");
assert.equal(CBC_PANEL_ARTICLE.reviewedBy, null);
assert.equal(CBC_PANEL_ARTICLE.reviewedAt, null);
assert.equal(getPanelArticleBySlug(" CBC ")?.slug, "cbc");
assert.deepEqual(
  CBC_PANEL_ARTICLE.subgroups.map((subgroup) => subgroup.title),
  ["Red-cell measurements", "White-cell measurements", "Platelet measurements"],
);
assert.match(CBC_PANEL_ARTICLE.compositionNote, /not one fixed checklist/i);
assert.match(CBC_PANEL_ARTICLE.compositionNote, /not a finding by itself/i);
assert.match(CBC_PANEL_ARTICLE.disclaimer, /not medical advice/i);
assert.equal(CBC_PANEL_ARTICLE.sources.length >= 2, true);
assert.ok(
  CBC_PANEL_ARTICLE.sources.every((source) =>
    source.url.startsWith("https://"),
  ),
  "article sources must be HTTPS links",
);

const articleMemberKeys = CBC_PANEL_ARTICLE.subgroups.flatMap((subgroup) =>
  subgroup.members.map((member) => member.measurementDefinitionKey),
);
assert.equal(new Set(articleMemberKeys).size, cbcPanel.members.length);
assert.deepEqual(
  [...new Set(articleMemberKeys)].sort(),
  cbcPanel.members.map((member) => member.measurementDefinitionKey).sort(),
  "every CBC Registry member must appear exactly once in the article",
);
assert.equal(CBC_PANEL_ARTICLE.relatedMarkers.length > 0, true);
assert.ok(
  CBC_PANEL_ARTICLE.relatedMarkers.every((member) => member.role === "related"),
);

function articleWithMemberChange(
  change: (
    member: PanelArticle["subgroups"][number]["members"][number],
  ) => PanelArticle["subgroups"][number]["members"][number],
): PanelArticle {
  return {
    ...CBC_PANEL_ARTICLE,
    subgroups: CBC_PANEL_ARTICLE.subgroups.map((subgroup, subgroupIndex) =>
      subgroupIndex === 0
        ? {
            ...subgroup,
            members: subgroup.members.map((member, memberIndex) =>
              memberIndex === 0 ? change(member) : member,
            ),
          }
        : subgroup,
    ),
  };
}

const duplicateValidation = validatePanelArticle(
  articleWithMemberChange((member) => ({
    ...member,
    measurementDefinitionKey:
      CBC_PANEL_ARTICLE.subgroups[0]!.members[1]!.measurementDefinitionKey,
  })),
  cbcPanel,
);
assert.equal(duplicateValidation.valid, false);
assert.ok(
  duplicateValidation.errors.some((error) =>
    error.includes("Duplicate article member"),
  ),
);

const unknownValidation = validatePanelArticle(
  articleWithMemberChange((member) => ({
    ...member,
    measurementDefinitionKey: "not_a_registry_definition",
  })),
  cbcPanel,
);
assert.equal(unknownValidation.valid, false);
assert.ok(unknownValidation.errors.some((error) => error.includes("unknown")));
const unknownDeclaredRelatedKeyValidation = validatePanelArticle(
  {
    ...CBC_PANEL_ARTICLE,
    relatedMeasurementKeys: [
      ...CBC_PANEL_ARTICLE.relatedMeasurementKeys,
      "not_a_registry_definition",
    ],
  },
  cbcPanel,
);
assert.equal(unknownDeclaredRelatedKeyValidation.valid, false);
assert.ok(
  unknownDeclaredRelatedKeyValidation.errors.some((error) =>
    error.includes("Related measurement key"),
  ),
);

const roleDriftValidation = validatePanelArticle(
  articleWithMemberChange((member) => ({ ...member, role: "optional" })),
  cbcPanel,
);
assert.equal(roleDriftValidation.valid, false);
assert.ok(roleDriftValidation.errors.some((error) => error.includes("role")));

function observation(
  id: string,
  measurementDefinitionKey: string | null,
  overrides: Partial<PanelArticleObservation> = {},
): PanelArticleObservation {
  return {
    id,
    measurement_definition_key: measurementDefinitionKey,
    name: measurementDefinitionKey ?? "CBC",
    value: 12,
    value_text: null,
    unit: "g/dL",
    observed_at: "2026-08-01",
    ordinal: 1,
    document_id: "document-1",
    source_page: 2,
    documents: {
      id: "document-1",
      original_filename: "synthetic-cbc.pdf",
      lab_name: "Synthetic Laboratory",
    },
    ...overrides,
  };
}

const observations = [
  observation("old-hgb", "hemoglobin_whole_blood", {
    observed_at: "2026-07-01",
  }),
  observation("new-rbc", "rbc_whole_blood", {
    observed_at: "2026-09-01",
    ordinal: 1,
  }),
  observation("new-hgb-2", "hemoglobin_whole_blood", {
    observed_at: "2026-09-01",
    ordinal: 2,
  }),
  observation("new-hgb-1", "hemoglobin_whole_blood", {
    observed_at: "2026-09-01",
    ordinal: 2,
  }),
  observation("non-cbc", "iron_serum", { name: "CBC iron" }),
  observation("unresolved", null, { name: "CBC" }),
];
const sourceOrder = observations.map((row) => row.id);
const selected = selectPanelArticleResults(observations, articleMemberKeys);
assert.deepEqual(
  selected.map((row) => row.id),
  ["new-rbc", "new-hgb-1", "new-hgb-2", "old-hgb"],
  "matching results use date, ordinal, and ID tie-breakers",
);
assert.deepEqual(
  observations.map((row) => row.id),
  sourceOrder,
  "selection does not mutate input order",
);
assert.equal(selected[0]!.documents?.original_filename, "synthetic-cbc.pdf");
assert.equal(selected[0]!.source_page, 2);
assert.equal(
  selected.some((row) => row.id === "non-cbc"),
  false,
);
assert.equal(
  selected.some((row) => row.id === "unresolved"),
  false,
);

function readRepo(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const template = readRepo(
  "src/components/knowledge/panel-article-template.tsx",
);
assert.match(template, /Panel composition varies/);
assert.match(template, /Your CBC results/);
assert.match(template, /Sources/);
assert.match(template, /article\.disclaimer/);
assert.doesNotMatch(template, /reference range|diagnos|abnormal/i);

const route = readRepo("src/app/app/knowledge/panels/cbc/page.tsx");
assert.match(route, /fetch\("\/api\/biomarkers"/);
assert.match(route, /selectPanelArticleResults/);
assert.match(route, /\/app\/biomarkers/);
assert.match(route, /ARTICLE_PATH/);

const index = readRepo("src/app/app/knowledge/page.tsx");
assert.match(index, /\/app\/knowledge\/panels\/cbc/);
const navigation = readRepo("src/lib/nav-items.ts");
assert.match(navigation, /label: "Knowledge"/);
const routeLabels = readRepo("src/lib/health-navigation.ts");
assert.match(routeLabels, /pathname === "\/app\/knowledge"/);

for (const relativePath of [
  "src/lib/knowledge-base/types.ts",
  "src/lib/knowledge-base/panel-articles.ts",
  "src/lib/knowledge-base/panel-results.ts",
  "src/lib/knowledge-base/validation.ts",
]) {
  assert.doesNotMatch(
    readRepo(relativePath),
    /health-profile-assessment|scoreRequiredGroups|resolveMeasurementDefinition/,
    `${relativePath} must stay outside assessment/resolver behavior`,
  );
}

console.log(
  `eh135-panel-article: ${CBC_PANEL_ARTICLE.subgroups.length} subgroups, ${selected.length} selected synthetic results`,
);
