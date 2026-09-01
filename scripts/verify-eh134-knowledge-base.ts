import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildMeasurementArticleViewModel,
  buildMeasurementBiomarkersHref,
  buildMeasurementObservationSourceHref,
  getPublishedMeasurementArticleBySlug,
  getPublishedMeasurementArticleForDefinition,
  parseMeasurementResultsResponse,
  selectMeasurementObservations,
  validateMeasurementArticleCatalog,
  validateMeasurementEducationArticle,
  type MeasurementEducationArticle,
} from "../src/lib/knowledge-base";
import { getMeasurementDefinition } from "../src/lib/biomarkers";

const source = {
  title: "Synthetic clinical reference",
  publisher: "EasyHealth test fixture",
  url: "https://example.invalid/measurement-reference",
  accessedAt: "2026-08-01T00:00:00Z",
};

const publishedArticle: MeasurementEducationArticle = {
  type: "measurement",
  measurementDefinitionKey: "hemoglobin_whole_blood",
  slug: "hemoglobin",
  locale: "en",
  contentVersion: "1.0.0",
  reviewStatus: "published",
  reviewedBy: "Synthetic clinical reviewer",
  reviewedAt: "2026-08-01T00:00:00Z",
  deprecatedAt: null,
  replacementSlug: null,
  title: "Hemoglobin",
  summary: "A factual guide to the hemoglobin measurement in a blood report.",
  whatItMeasures: [
    "Hemoglobin is the oxygen-carrying protein measured in a blood sample.",
  ],
  interpretationFactors: [
    "Interpretation depends on the person's context and the laboratory's own report.",
  ],
  sources: [source],
  relatedMeasurementKeys: ["hematocrit_whole_blood", "unknown-definition"],
};

const relatedArticle: MeasurementEducationArticle = {
  ...publishedArticle,
  measurementDefinitionKey: "hematocrit_whole_blood",
  slug: "hematocrit",
  title: "Hematocrit",
};

const draftArticle: MeasurementEducationArticle = {
  ...publishedArticle,
  reviewStatus: "draft",
  reviewedBy: null,
  reviewedAt: null,
};

const deprecatedArticle: MeasurementEducationArticle = {
  ...publishedArticle,
  reviewStatus: "deprecated",
  reviewedBy: null,
  reviewedAt: null,
  deprecatedAt: "2026-08-15T00:00:00Z",
};

const httpSourceArticle: MeasurementEducationArticle = {
  ...publishedArticle,
  sources: [{ ...source, url: "http://example.invalid/insecure" }],
};

const provisionalArticle: MeasurementEducationArticle = {
  ...publishedArticle,
  measurementDefinitionKey: "sample_total_protein",
  slug: "total-protein",
};

assert.equal(
  validateMeasurementArticleCatalog().valid,
  true,
  "empty EH-134 catalog is valid before EH-136 content",
);
assert.equal(validateMeasurementEducationArticle(publishedArticle).valid, true);
assert.equal(
  validateMeasurementEducationArticle(httpSourceArticle).valid,
  false,
);
assert.equal(
  validateMeasurementEducationArticle(provisionalArticle).valid,
  false,
);
assert.equal(
  getPublishedMeasurementArticleBySlug("hemoglobin", {
    articles: [draftArticle],
  }),
  null,
);
assert.equal(
  getPublishedMeasurementArticleBySlug("hemoglobin", {
    articles: [deprecatedArticle],
  }),
  null,
);
assert.equal(
  getPublishedMeasurementArticleBySlug("hemoglobin", {
    articles: [publishedArticle],
  })?.measurementDefinitionKey,
  "hemoglobin_whole_blood",
);

const model = buildMeasurementArticleViewModel(publishedArticle, [
  publishedArticle,
  relatedArticle,
]);
assert.ok(model);
assert.equal(model.definition.key, "hemoglobin_whole_blood");
assert.ok(model.aliases.includes("hemoglobin"));
assert.ok(model.commonUnits.includes("g/dl"));
assert.equal(model.specimenLabel, "Whole blood");
assert.deepEqual(
  model.panelMembership.map((panel) => panel.key),
  ["cbc", "iron_studies"],
);
assert.equal(
  model.relatedMeasurements.find(
    (measurement) => measurement.key === "hematocrit_whole_blood",
  )?.slug,
  "hematocrit",
);
assert.equal(
  model.relatedMeasurements.some(
    (measurement) => measurement.key === "unknown-definition",
  ),
  false,
  "unknown related keys never become guessed links",
);
assert.equal(
  getPublishedMeasurementArticleForDefinition("hematocrit_whole_blood", {
    articles: [publishedArticle, relatedArticle],
  })?.slug,
  "hematocrit",
);

const parsedObservations = parseMeasurementResultsResponse({
  observations: [
    {
      id: "obs-1",
      name: "Hemoglobin",
      measurement_definition_key: "hemoglobin_whole_blood",
      value: 14.2,
      value_kind: "numeric",
      value_text: null,
      unit: "g/dL",
      observed_at: "2026-08-02",
      document_id: "doc-1",
      documents: { id: "doc-1", original_filename: "synthetic-lab.pdf" },
    },
    {
      id: "obs-2",
      name: "Hematocrit",
      measurement_definition_key: "hematocrit_whole_blood",
      value: 42,
      value_kind: "numeric",
      value_text: null,
      unit: "%",
      observed_at: "2026-08-02",
      document_id: "doc-2",
      documents: { id: "doc-2", original_filename: "other-lab.pdf" },
    },
    {
      id: "obs-3",
      name: "Hemoglobin",
      measurement_definition_key: "hemoglobin_whole_blood",
      value: 13.8,
      value_kind: "numeric",
      value_text: null,
      unit: "g/dL",
      observed_at: "2025-08-02",
      document_id: null,
      documents: null,
    },
  ],
});
const selectedObservations = selectMeasurementObservations(
  parsedObservations,
  publishedArticle.measurementDefinitionKey,
);
assert.equal(selectedObservations.length, 2);
assert.equal(selectedObservations[0]?.value, 14.2);
assert.equal(selectedObservations[1]?.document_id, null);
assert.throws(
  () => parseMeasurementResultsResponse({ observations: "not-an-array" }),
  /could not load/i,
);

const sourceHref = buildMeasurementObservationSourceHref(
  selectedObservations[0]!,
  "/app/knowledge/measurements/hemoglobin",
);
assert.ok(sourceHref);
const sourceUrl = new URL(sourceHref, "https://easyhealth.internal");
assert.equal(sourceUrl.pathname, "/app/documents/doc-1");
assert.equal(
  sourceUrl.searchParams.get("measurement"),
  "hemoglobin_whole_blood",
);
assert.equal(sourceUrl.searchParams.get("observation"), "obs-1");
assert.equal(
  sourceUrl.searchParams.get("returnTo"),
  "/app/knowledge/measurements/hemoglobin",
);
assert.equal(
  buildMeasurementObservationSourceHref(
    selectedObservations[1]!,
    "/app/knowledge/measurements/hemoglobin",
  ),
  null,
);
const biomarkersUrl = new URL(
  buildMeasurementBiomarkersHref("hemoglobin_whole_blood"),
  "https://easyhealth.internal",
);
assert.equal(biomarkersUrl.pathname, "/app/biomarkers");
assert.equal(
  biomarkersUrl.searchParams.get("measurement"),
  "hemoglobin_whole_blood",
);
assert.equal(
  getMeasurementDefinition("hemoglobin_whole_blood")?.assessmentBindings.length,
  1,
);

const renderer = readFileSync(
  "src/components/knowledge-base/measurement-article.tsx",
  "utf8",
);
for (const section of [
  "What it measures",
  "Aliases",
  "Common units",
  "Specimen",
  "Panel membership",
  "Related measurements",
  "Interpretation factors",
  "Sources",
  "Your results",
  "MEDICAL_DISCLAIMER",
]) {
  assert.match(
    renderer,
    new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
}
assert.match(renderer, /fetch\("\/api\/biomarkers"/);
assert.match(renderer, /not\s+a\s+diagnosis/);
assert.doesNotMatch(renderer, /ref_low|ref_high|score role|universal range/i);

const route = readFileSync(
  "src/app/app/knowledge/measurements/[slug]/page.tsx",
  "utf8",
);
assert.match(route, /getPublishedMeasurementArticleBySlug/);
assert.match(route, /buildMeasurementArticleViewModel/);
assert.match(route, /notFound\(\)/);

console.log("verify-eh134-knowledge-base: all checks passed");
