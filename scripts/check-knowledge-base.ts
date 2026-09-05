import { KNOWLEDGE_BASE_ARTICLES } from "../content/knowledge-base/articles";
import {
  buildKnowledgeBaseStaleReport,
  validateKnowledgeBaseArticles,
} from "../src/lib/knowledge-base/publication";
import { validateKnowledgeBaseArticleCatalog } from "../src/lib/knowledge-base";

function readAsOf(args: readonly string[]): Date {
  const index = args.indexOf("--as-of");
  if (index === -1) return new Date();
  const value = args[index + 1];
  if (!value) throw new Error("--as-of requires an ISO-8601 timestamp");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error(`Invalid --as-of timestamp: ${value}`);
  return date;
}

function usage(): never {
  throw new Error(
    "Usage: tsx scripts/check-knowledge-base.ts [--report] [--as-of <ISO timestamp>]",
  );
}

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--report") continue;
  if (argument === "--as-of") {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) usage();
    index += 1;
    continue;
  }
  usage();
}
const asOf = readAsOf(args);
const staleReport = buildKnowledgeBaseStaleReport(KNOWLEDGE_BASE_ARTICLES, {
  asOf,
});
const catalogValidation = validateKnowledgeBaseArticleCatalog();
const publicationValidation = validateKnowledgeBaseArticles(
  KNOWLEDGE_BASE_ARTICLES,
  { asOf },
);
const errors = [
  ...catalogValidation.errors,
  ...publicationValidation.errors,
];
const validation = {
  valid: catalogValidation.valid && publicationValidation.valid,
  errors,
};

if (args.includes("--report")) {
  console.log(JSON.stringify(staleReport, null, 2));
} else {
  console.log(
    `Knowledge Base check: ${KNOWLEDGE_BASE_ARTICLES.length} articles, ${staleReport.publishedArticleCount} published, ${staleReport.staleArticles.length} stale`,
  );
  if (validation.errors.length > 0) {
    console.error("Knowledge Base publication errors:");
    for (const message of validation.errors) console.error(`- ${message}`);
  }
  console.log(JSON.stringify(staleReport, null, 2));
}

if (!validation.valid) process.exitCode = 1;
