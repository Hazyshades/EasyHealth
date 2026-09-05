import {
  getPublishedMeasurementHrefByDefinitionKey,
} from "./markdown-adapter";
import type { KnowledgeBasePolicyOptions } from "./admission";

export function getKnowledgeArticleHref(
  measurementDefinitionKey: string | null | undefined,
  options: KnowledgeBasePolicyOptions = {},
): string | null {
  return getPublishedMeasurementHrefByDefinitionKey(
    measurementDefinitionKey,
    options,
  );
}
