import manifestJson from "../../../content/knowledge/biomarkers/manifest.json";

type ManifestArticle = {
  status: string;
  reviewStatus: string;
  slug: string;
  measurementDefinitionKeys: readonly string[];
};

const HREF_BY_MEASUREMENT_KEY: Record<string, string> = Object.fromEntries(
  (manifestJson.articles as ManifestArticle[])
    .filter(
      (article) =>
        article.status === "published" && article.reviewStatus === "reviewed",
    )
    .flatMap((article) =>
      article.measurementDefinitionKeys.map(
        (key) =>
          [
            key,
            `/knowledge/biomarkers/${encodeURIComponent(article.slug)}`,
          ] as const,
      ),
    ),
);

export function getKnowledgeArticleHref(
  measurementDefinitionKey: string | null | undefined,
): string | null {
  if (
    !measurementDefinitionKey ||
    !Object.hasOwn(HREF_BY_MEASUREMENT_KEY, measurementDefinitionKey)
  ) {
    return null;
  }
  return HREF_BY_MEASUREMENT_KEY[measurementDefinitionKey];
}
