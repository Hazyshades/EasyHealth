import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  getMeasurementDefinition,
  getPanelDefinition,
  listPanelsForMeasurementDefinition,
  type MeasurementDefinition,
  type PanelDefinition,
} from "@/lib/biomarkers";
import manifestJson from "../../../content/knowledge/biomarkers/manifest.json";

const CONTENT_ROOT = path.join(process.cwd(), "content", "knowledge", "biomarkers");
const ARTICLE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BODY_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const DEFINITION_KEY = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isoDateTimeSchema = z.string().refine((value) => {
  if (!ISO_DATE_TIME_PATTERN.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}, "reviewedAt must be a valid ISO timestamp");

const sourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url().refine((value) => value.startsWith("https://"), "source URL must use HTTPS"),
  accessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const articleSchema = z.object({
  type: z.literal("biomarker"),
  slug: z.string().regex(ARTICLE_SLUG),
  locale: z.literal("en"),
  contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().min(1),
  summary: z.string().min(1).max(320),
  status: z.enum(["draft", "review", "published", "deprecated"]),
  reviewStatus: z.enum(["pending", "reviewed"]),
  reviewedBy: z.string().min(1),
  reviewedAt: isoDateTimeSchema,
  bodyFile: z.string().regex(BODY_FILE),
  measurementDefinitionKeys: z.array(z.string().regex(DEFINITION_KEY)).min(1),
  panelKeys: z.array(z.string().regex(DEFINITION_KEY)),
  relatedMeasurementKeys: z.array(z.string().regex(DEFINITION_KEY)),
  sourceIds: z.array(z.string().min(1)).min(1),
});

const manifestSchema = z.object({
  schemaVersion: z.literal("1"),
  articles: z.array(articleSchema).min(1),
  sources: z.array(sourceSchema).min(1),
});

type KnowledgeBaseManifest = z.infer<typeof manifestSchema>;
export type KnowledgeBaseSource = z.infer<typeof sourceSchema>;
export type KnowledgeArticleStatus = KnowledgeBaseManifest["articles"][number]["status"];
export type KnowledgeArticleRecord = KnowledgeBaseManifest["articles"][number];

export type KnowledgeArticle = KnowledgeArticleRecord & {
  body: string;
  sources: readonly KnowledgeBaseSource[];
  measurementDefinitions: readonly MeasurementDefinition[];
  panels: readonly PanelDefinition[];
};

export const KNOWLEDGE_BASE_SCHEMA_VERSION = "1" as const;

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const location = issue.path.length > 0 ? issue.path.join(".") : "manifest";
    return `${location}: ${issue.message}`;
  });
}

function getManifest(input: unknown = manifestJson): KnowledgeBaseManifest {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid Knowledge Base manifest:\n${formatZodIssues(parsed.error).join("\n")}`);
  }
  return parsed.data;
}


export function validateKnowledgeBaseManifest(input: unknown = manifestJson): string[] {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) return formatZodIssues(parsed.error);

  const manifest = parsed.data;
  const errors: string[] = [];
  const sourceIds = new Set<string>();
  const articleSlugs = new Set<string>();

  for (const source of manifest.sources) {
    if (sourceIds.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
  }

  for (const article of manifest.articles) {
    if (articleSlugs.has(article.slug)) errors.push(`Duplicate article slug: ${article.slug}`);
    articleSlugs.add(article.slug);

    if (article.status === "published") {
      if (article.reviewStatus !== "reviewed") {
        errors.push(`${article.slug}: published article must be reviewed`);
      }
      if (!article.reviewedBy.trim()) errors.push(`${article.slug}: reviewer is required`);
    }

    for (const sourceId of article.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${article.slug}: unknown source id ${sourceId}`);
      }
    }

    const definitions: MeasurementDefinition[] = [];
    for (const key of article.measurementDefinitionKeys) {
      const definition = getMeasurementDefinition(key);
      if (!definition) {
        errors.push(`${article.slug}: unknown measurement definition ${key}`);
        continue;
      }
      definitions.push(definition);
      if (definition.maturity !== "reviewed") {
        errors.push(`${article.slug}: definition ${key} is not reviewed`);
      }
      if (definition.sourceProvenance.kind !== "registry_v2_review") {
        errors.push(`${article.slug}: definition ${key} is not Registry 2.0 sourced`);
      }
    }

    for (const key of article.relatedMeasurementKeys) {
      if (!getMeasurementDefinition(key)) {
        errors.push(`${article.slug}: unknown related measurement definition ${key}`);
      }
    }

    for (const panelKey of article.panelKeys) {
      const panel = getPanelDefinition(panelKey);
      if (!panel) {
        errors.push(`${article.slug}: unknown panel ${panelKey}`);
      } else if (!panel.members.some((member) => article.measurementDefinitionKeys.includes(member.measurementDefinitionKey))) {
        errors.push(`${article.slug}: panel ${panelKey} has no referenced article definition`);
      }
    }

    const derivedPanelKeys = new Set(
      definitions.flatMap((definition) =>
        listPanelsForMeasurementDefinition(definition.key).map((panel) => panel.key),
      ),
    );
    for (const panelKey of article.panelKeys) {
      if (!derivedPanelKeys.has(panelKey)) {
        errors.push(`${article.slug}: panel ${panelKey} is not a Registry membership for its definitions`);
      }
    }
  }

  return errors;
}

function getSafeBodyPath(bodyFile: string): string {
  if (!BODY_FILE.test(bodyFile)) {
    throw new Error(`Unsafe Knowledge Base body file: ${bodyFile}`);
  }
  const bodyPath = path.resolve(CONTENT_ROOT, bodyFile);
  const relativePath = path.relative(CONTENT_ROOT, bodyPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Knowledge Base body file escapes content root: ${bodyFile}`);
  }
  return bodyPath;
}

function resolveArticleDefinitions(article: KnowledgeArticleRecord): readonly MeasurementDefinition[] {
  return article.measurementDefinitionKeys.map((key) => {
    const definition = getMeasurementDefinition(key);
    if (!definition || definition.maturity !== "reviewed") {
      throw new Error(`${article.slug}: published article references a non-reviewed definition ${key}`);
    }
    return definition;
  });
}

function resolveArticlePanels(article: KnowledgeArticleRecord): readonly PanelDefinition[] {
  return article.panelKeys.map((key) => {
    const panel = getPanelDefinition(key);
    if (!panel) throw new Error(`${article.slug}: published article references an unknown panel ${key}`);
    return panel;
  });
}

function hydrateArticle(manifest: KnowledgeBaseManifest, article: KnowledgeArticleRecord): KnowledgeArticle {
  const body = readFileSync(getSafeBodyPath(article.bodyFile), "utf8");
  const sources = article.sourceIds.map((sourceId) => {
    const source = manifest.sources.find((candidate) => candidate.id === sourceId);
    if (!source) throw new Error(`${article.slug}: missing source ${sourceId}`);
    return source;
  });

  return {
    ...article,
    body,
    sources,
    measurementDefinitions: resolveArticleDefinitions(article),
    panels: resolveArticlePanels(article),
  };
}

export function listKnowledgeArticleRecords(): readonly KnowledgeArticleRecord[] {
  const manifest = getManifest();
  const errors = validateKnowledgeBaseManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`Invalid Knowledge Base manifest:\n${errors.join("\n")}`);
  }
  return manifest.articles;
}

export function listPublishedKnowledgeArticleRecords(): readonly KnowledgeArticleRecord[] {
  return listKnowledgeArticleRecords().filter(
    (article) => article.status === "published" && article.reviewStatus === "reviewed",
  );
}

export function getKnowledgeArticle(slug: string): KnowledgeArticle | null {
  const manifest = getManifest();
  const article = manifest.articles.find(
    (candidate) =>
      candidate.slug === slug &&
      candidate.status === "published" &&
      candidate.reviewStatus === "reviewed",
  );
  return article ? hydrateArticle(manifest, article) : null;
}

export function getKnowledgeArticlePath(slug: string): string {
  return `/knowledge/biomarkers/${encodeURIComponent(slug)}`;
}


export function formatKnowledgeUnit(unit: string): string {
  const labels: Record<string, string> = {
    "g/l": "g/L",
    "g/dl": "g/dL",
    "%": "%",
    "10^9/l": "×10⁹/L",
    "10^12/l": "×10¹²/L",
    fl: "fL",
    pg: "pg",
    "mg/dl": "mg/dL",
    "mmol/l": "mmol/L",
    "umol/l": "µmol/L",
    "miu/l": "mIU/L",
    "uiu/ml": "µIU/mL",
    "ml/min/1.73m2": "mL/min/1.73 m²",
  };
  return labels[unit.toLocaleLowerCase("en-US")] ?? unit;
}

export function formatKnowledgeSpecimen(specimen: string): string {
  const labels: Record<string, string> = {
    serum: "Serum",
    plasma: "Plasma",
    whole_blood: "Whole blood",
    urine: "Urine",
    unspecified: "Not specified by this definition",
  };
  return labels[specimen] ?? specimen;
}
