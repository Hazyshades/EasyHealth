import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CBC_PANEL_ARTICLE,
  getPublicPanelEducationArticle,
  panelEducationEligibleForPublicRoute,
} from "../src/lib/knowledge-base";
import {
  getKnowledgePanel,
  listKnowledgePanels,
} from "../src/lib/knowledge-base/navigation";

const publicPanelPagePath = path.join(
  "src",
  "app",
  "knowledge",
  "panels",
  "[key]",
  "page.tsx",
);
const publicPanelPage = readFileSync(publicPanelPagePath, "utf8");
const authenticatedCbcPage = readFileSync(
  path.join("src", "app", "app", "knowledge", "panels", "cbc", "page.tsx"),
  "utf8",
);
const panelTemplate = readFileSync(
  path.join("src", "components", "knowledge", "panel-article-template.tsx"),
  "utf8",
);

assert.match(
  publicPanelPage,
  /getPublicPanelEducationArticle/,
  "the public panel route must overlay education articles",
);
assert.match(
  publicPanelPage,
  /PanelArticleTemplate/,
  "the public panel route must reuse the panel education template",
);
assert.match(
  publicPanelPage,
  /href:\s*"\/knowledge"/,
  "the public education overlay must breadcrumb to /knowledge",
);
assert.doesNotMatch(publicPanelPage, /["']use client["']/);
assert.doesNotMatch(publicPanelPage, /\/api\/biomarkers/);
assert.doesNotMatch(publicPanelPage, /\bfetch\s*\(/);

assert.match(
  authenticatedCbcPage,
  /resultState/,
  "authenticated CBC must still pass result state",
);
assert.match(
  authenticatedCbcPage,
  /\/api\/biomarkers/,
  "authenticated CBC may still fetch private results",
);
assert.match(
  panelTemplate,
  /resultState\?:/,
  "the template must omit results when resultState is not provided",
);

assert.equal(getPublicPanelEducationArticle("cbc"), null);
assert.equal(getPublicPanelEducationArticle(" CBC "), null);
assert.equal(CBC_PANEL_ARTICLE.reviewStatus, "in_review");
assert.equal(CBC_PANEL_ARTICLE.reviewedBy, null);
assert.equal(CBC_PANEL_ARTICLE.reviewedAt, null);
assert.ok(CBC_PANEL_ARTICLE.sources.length >= 1);
assert.ok(
  CBC_PANEL_ARTICLE.sources.every((source) =>
    source.url.startsWith("https://"),
  ),
);
assert.match(CBC_PANEL_ARTICLE.disclaimer, /not medical advice/i);
assert.equal(
  panelEducationEligibleForPublicRoute(CBC_PANEL_ARTICLE, "cbc"),
  false,
);
assert.equal(
  panelEducationEligibleForPublicRoute(CBC_PANEL_ARTICLE, "thyroid"),
  false,
);
assert.equal(
  panelEducationEligibleForPublicRoute(
    {
      ...CBC_PANEL_ARTICLE,
      reviewStatus: "deprecated",
      deprecatedAt: "2026-09-01T00:00:00Z",
    },
    "cbc",
  ),
  false,
);
assert.equal(
  panelEducationEligibleForPublicRoute(
    { ...CBC_PANEL_ARTICLE, reviewStatus: "draft" },
    "cbc",
  ),
  false,
);

const registryOnlyPanels = listKnowledgePanels().filter(
  (panel) => getPublicPanelEducationArticle(panel.key) === null,
);
assert.ok(
  registryOnlyPanels.length > 0,
  "at least one Registry panel must keep the composition fallback",
);
assert.ok(
  getKnowledgePanel(registryOnlyPanels[0]?.key),
  "registry-only panels must still resolve through getKnowledgePanel",
);
assert.equal(getPublicPanelEducationArticle("thyroid"), null);
assert.ok(getKnowledgePanel("thyroid"));
assert.equal(getPublicPanelEducationArticle("not-a-panel"), null);
assert.equal(getKnowledgePanel("not-a-panel"), null);

console.log("public panel education overlay contract passed");
