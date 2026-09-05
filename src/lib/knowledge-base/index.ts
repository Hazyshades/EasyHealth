/**
 * Server-oriented Knowledge Base barrel. Client modules must import leaf
 * files (panel-articles, admission, links, measurement-results) instead:
 * this barrel re-exports publication-catalog, which hydrates markdown via node:fs.
 */
export type {
  KnowledgeBaseArticleType,
  KnowledgeBaseReviewStatus,
  KnowledgeBaseSource,
  KnowledgeBaseArticle,
  MeasurementEducationArticle,
  PanelEducationArticle,
  PanelArticle,
  PanelArticleMember,
  PanelArticleMemberRole,
  PanelArticleSubgroup,
  KnowledgeBaseValidation,
  MeasurementArticlePanel,
  RelatedMeasurementArticle,
  MeasurementArticleViewModel,
} from "./types";

export {
  knowledgeBaseArticleTypeSchema,
  knowledgeBaseReviewStatusSchema,
  knowledgeBaseSourceSchema,
  knowledgeBaseArticleSchema,
  measurementEducationArticleSchema,
  panelEducationArticleSchema,
  panelArticleSchema,
} from "./types";

export {
  getPublishedMeasurementArticleBySlug,
  getPublishedMeasurementArticleForDefinition,
  listPublishedMeasurementArticles,
  validateMeasurementArticleCatalog,
  validateMeasurementEducationArticle,
} from "./measurement-articles";

export {
  PANEL_ARTICLES,
  validatePanelEducationArticle,
} from "./panel-articles";

export {
  CBC_PANEL_ARTICLE,
  getPanelArticleBySlug,
  getPublicPanelEducationArticle,
  panelEducationEligibleForPublicRoute,
} from "./panel-articles";

export {
  validatePanelArticle,
  type PanelArticleValidation,
} from "./validation";

export {
  selectPanelArticleResults,
  type PanelArticleObservation,
} from "./panel-results";

export {
  listKnowledgeBaseCatalogArticles,
  mapMarkdownLifecycle,
} from "./catalog";
export type { KnowledgeBasePolicyOptions } from "./admission";

export {
  KNOWLEDGE_BASE_ARTICLES,
  getPublishedKnowledgeBaseArticleBySlug,
  getPublishedKnowledgeBaseArticleForMeasurementDefinition,
  getPublishedKnowledgeBaseArticleForPanel,
  listPublishedKnowledgeBaseArticles,
  validateKnowledgeBaseArticle,
  validateKnowledgeBaseArticleCatalog,
} from "./knowledge-base-articles";

export {
  KNOWLEDGE_BASE_ROUTE,
  getDeprecatedKnowledgeBaseRedirect,
  getKnowledgeBaseArticle,
  getPublicKnowledgeBaseArticle,
  listKnowledgeBaseSlugs,
  listPublicKnowledgeBaseArticles,
  type PublicKnowledgeBaseArticle,
} from "./publication-catalog";
export {
  publicMeasurementArticlePath,
  publicPanelArticlePath,
  resolveLegacyKnowledgeBasePath,
} from "./article-routes";
export {
  buildKnowledgeBaseStaleReport,
  validateKnowledgeBaseArticles,
} from "./publication";

export { buildMeasurementArticleViewModel } from "./measurement-article-model";
export {
  buildMeasurementBiomarkersHref,
  buildMeasurementObservationSourceHref,
  formatMeasurementObservationValue,
  formatPanelArticleObservationValue,
  parseMeasurementResultsResponse,
  selectMeasurementObservations,
  type MeasurementObservation,
} from "./measurement-results";

export { getKnowledgeArticleHref } from "./links";
export type {
  KnowledgeArticle,
  KnowledgeArticleRecord,
  KnowledgeCategory,
  KnowledgeIndexFilters,
  KnowledgeSearchResult,
} from "./navigation-types";
