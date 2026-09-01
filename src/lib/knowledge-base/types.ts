import { z } from "zod";

export const knowledgeBaseArticleTypeSchema = z.literal("measurement");
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

/**
 * Editorial content only. Registry-owned identity metadata is deliberately
 * resolved from the measurement and panel registries at render time.
 */
export const measurementEducationArticleSchema = z
  .object({
    type: knowledgeBaseArticleTypeSchema,
    measurementDefinitionKey: nonEmptyText,
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
    whatItMeasures: z.array(nonEmptyText).min(1),
    interpretationFactors: z.array(nonEmptyText).min(1),
    sources: z.array(knowledgeBaseSourceSchema).min(1),
    relatedMeasurementKeys: z.array(nonEmptyText),
  })
  .strict()
  .superRefine((article, context) => {
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
  });

export type MeasurementEducationArticle = z.infer<
  typeof measurementEducationArticleSchema
>;

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
