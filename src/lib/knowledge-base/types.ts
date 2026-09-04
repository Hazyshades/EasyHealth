import { z } from "zod";

export const knowledgeBaseArticleTypeSchema = z.enum(["measurement", "panel"]);
export type KnowledgeBaseArticleType = z.infer<
  typeof knowledgeBaseArticleTypeSchema
>;

export const knowledgeBaseReviewStatusSchema = z.enum([
  "draft",
  "in_review",
  "published",
  "deprecated",
]);
export type KnowledgeBaseReviewStatus = z.infer<
  typeof knowledgeBaseReviewStatusSchema
>;

const nonEmptyText = z.string().trim().min(1);
const articleSlug = nonEmptyText.regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "must use lowercase kebab-case",
);
const reviewDate = z.string().datetime({ offset: true });

export const knowledgeBaseSourceSchema = z
  .object({
    title: nonEmptyText,
    publisher: nonEmptyText,
    url: nonEmptyText
      .url()
      .refine(
        (value) => new URL(value).protocol === "https:",
        "must use HTTPS",
      ),
    accessedAt: reviewDate.nullable().optional(),
  })
  .strict();

export type KnowledgeBaseSource = z.infer<typeof knowledgeBaseSourceSchema>;
export function formatKnowledgeBaseSchemaErrors(
  errors: readonly {
    path: readonly (string | number)[];
    message: string;
  }[],
): string[] {
  return errors.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "article";
    return `${path}: ${issue.message}`;
  });
}

const commonArticleShape = {
  slug: articleSlug,
  locale: nonEmptyText,
  contentVersion: nonEmptyText,
  reviewStatus: knowledgeBaseReviewStatusSchema,
  reviewedBy: nonEmptyText.nullable(),
  reviewedAt: reviewDate.nullable(),
  deprecatedAt: reviewDate.nullable(),
  replacementSlug: articleSlug.nullable(),
  title: nonEmptyText,
  summary: nonEmptyText,
  sources: z.array(knowledgeBaseSourceSchema).min(1),
  relatedMeasurementKeys: z.array(nonEmptyText),
} as const;

type KnowledgeBaseLifecycleFields = {
  reviewStatus: KnowledgeBaseReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  deprecatedAt: string | null;
  replacementSlug: string | null;
};

function addLifecycleValidation(
  article: KnowledgeBaseLifecycleFields,
  context: z.RefinementCtx,
): void {
  if (article.reviewStatus === "published") {
    if (!article.reviewedBy) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewedBy"],
        message: "published article requires reviewedBy",
      });
    }
    if (!article.reviewedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewedAt"],
        message: "published article requires reviewedAt",
      });
    }
    if (article.deprecatedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deprecatedAt"],
        message: "published article cannot have deprecatedAt",
      });
    }
  }

  if (article.reviewStatus === "deprecated" && !article.deprecatedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["deprecatedAt"],
      message: "deprecated article requires deprecatedAt",
    });
  }
  if (article.reviewStatus !== "deprecated" && article.deprecatedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["deprecatedAt"],
      message: "only deprecated articles may have deprecatedAt",
    });
  }
  if (article.reviewStatus !== "deprecated" && article.replacementSlug) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["replacementSlug"],
      message: "only deprecated articles may have replacementSlug",
    });
  }
}

/**
 * Editorial content only. Registry-owned identity metadata is deliberately
 * resolved from the measurement and panel registries at render time.
 */
export const measurementEducationArticleSchema = z
  .object({
    ...commonArticleShape,
    type: z.literal("measurement"),
    measurementDefinitionKey: nonEmptyText,
    whatItMeasures: z.array(nonEmptyText).min(1),
    interpretationFactors: z.array(nonEmptyText).min(1),
  })
  .strict()
  .superRefine((article, context) => {
    addLifecycleValidation(article, context);
  });

export type MeasurementEducationArticle = z.infer<
  typeof measurementEducationArticleSchema
>;
export const panelEducationArticleSchema = z
  .object({
    ...commonArticleShape,
    type: z.literal("panel"),
    panelKey: nonEmptyText,
  })
  .strict()
  .superRefine((article, context) => {
    addLifecycleValidation(article, context);
  });

export type PanelEducationArticle = z.infer<typeof panelEducationArticleSchema>;

export const panelArticleMemberRoleSchema = z.enum([
  "core",
  "optional",
  "related",
]);
export type PanelArticleMemberRole = z.infer<
  typeof panelArticleMemberRoleSchema
>;

const panelArticleMemberSchema = z
  .object({
    measurementDefinitionKey: nonEmptyText,
    role: panelArticleMemberRoleSchema,
    explanation: nonEmptyText,
  })
  .strict();

export type PanelArticleMember = z.infer<typeof panelArticleMemberSchema>;

const panelArticleSubgroupSchema = z
  .object({
    key: articleSlug,
    title: nonEmptyText,
    summary: nonEmptyText,
    members: z.array(panelArticleMemberSchema).min(1),
  })
  .strict();

export type PanelArticleSubgroup = z.infer<typeof panelArticleSubgroupSchema>;

/** EH-135's richer panel presentation record extends the canonical panel shape. */
export const panelArticleSchema = z
  .object({
    ...commonArticleShape,
    type: z.literal("panel"),
    panelKey: nonEmptyText,
    purpose: nonEmptyText,
    compositionNote: nonEmptyText,
    subgroups: z.array(panelArticleSubgroupSchema).min(1),
    relatedMarkers: z.array(panelArticleMemberSchema),
    disclaimer: nonEmptyText,
  })
  .strict()
  .superRefine((article, context) => {
    addLifecycleValidation(article, context);
  });

export type PanelArticle = z.infer<typeof panelArticleSchema>;

/** Shared strict article contract; each variant retains its subject key. */
export const knowledgeBaseArticleSchema = z.union([
  measurementEducationArticleSchema,
  panelArticleSchema,
  panelEducationArticleSchema,
]);

export type KnowledgeBaseArticle = z.infer<typeof knowledgeBaseArticleSchema>;

export type KnowledgeBaseValidation = Readonly<{
  valid: boolean;
  errors: readonly string[];
}>;

export type MeasurementArticlePanel = Readonly<{
  key: string;
  displayName: string;
  role: "required" | "optional";
}>;

export type RelatedMeasurementArticle = Readonly<{
  key: string;
  displayName: string;
  slug: string | null;
}>;

export type MeasurementArticleViewModel = Readonly<{
  article: MeasurementEducationArticle;
  definition: Readonly<{
    key: string;
    displayName: string;
  }>;
  aliases: readonly string[];
  commonUnits: readonly string[];
  specimenLabel: string;
  panelMembership: readonly MeasurementArticlePanel[];
  relatedMeasurements: readonly RelatedMeasurementArticle[];
}>;
