import { listPublicationKnowledgeBaseArticles } from "@/lib/knowledge-base/publication-catalog";

/**
 * Publication-governance view of the Knowledge Base catalog.
 * Admission and identity live in the catalog module; this file remains a
 * compatibility export for release-check scripts.
 */
export const KNOWLEDGE_BASE_ARTICLES = listPublicationKnowledgeBaseArticles();
