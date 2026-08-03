import { createHash } from "node:crypto";
import {
  MEASUREMENT_DEFINITIONS,
  ANALYTES,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
} from "./measurement-resolution";
import type { MeasurementDefinition } from "./types";

export type MappingChangeClassification =
  | "additive"
  | "compatibility_preserving"
  | "review_required"
  | "breaking";

export type MeasurementRegistryChange = {
  definitionKey: string;
  classification: MappingChangeClassification;
  reason: string;
};

export type MeasurementCatalogManifestRelease = {
  catalogManifestVersion: string;
  resolverVersion: string;
  normalizationVersion: string;
  compatibilityPolicyVersion: string;
  manifestDigest: string;
  changelog: string[];
  changedDefinitions: MeasurementRegistryChange[];
  regressionFixtures: Array<{ name: string; status: "declared" | "passed" | "failed" }>;
};

function stableValue(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableValue).sort().join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
    .join(",")}}`;
}

function manifestDefinition(definition: MeasurementDefinition) {
  return {
    key: definition.key,
    analyteKey: definition.analyteKey,
    maturity: definition.maturity,
    sourceProvenance: definition.sourceProvenance,
    specimen: definition.specimen,
    property: definition.property,
    scale: definition.scale,
    timing: definition.timing,
    method: definition.method,
    valueKind: definition.valueKind,
    aliases: definition.aliases,
    unitPolicy: definition.unitPolicy,
    requiredModifiers: definition.requiredModifiers ?? [],
    requiredMethods: definition.requiredMethods ?? [],
    assessmentBindings: definition.assessmentBindings,
  };
}

export function serializeMeasurementRegistryManifest(
  definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS
): string {
  return stableValue({
    registryModel: "launch-catalog-v2-alias-authority",
    analytes: ANALYTES,
    definitions: definitions.map(manifestDefinition),
  });
}

export function digestMeasurementRegistryManifest(
  definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS
): string {
  return createHash("sha256").update(serializeMeasurementRegistryManifest(definitions)).digest("hex");
}

export function classifyMeasurementDefinitionChange(
  previous: MeasurementDefinition | undefined,
  next: MeasurementDefinition
): MeasurementRegistryChange {
  if (!previous) {
    return { definitionKey: next.key, classification: "additive", reason: "New definition" };
  }

  const identityChanged =
    previous.analyteKey !== next.analyteKey ||
    previous.maturity !== next.maturity ||
    stableValue(previous.sourceProvenance) !== stableValue(next.sourceProvenance) ||
    previous.specimen !== next.specimen ||
    previous.property !== next.property ||
    previous.scale !== next.scale ||
    previous.timing !== next.timing ||
    previous.method !== next.method ||
    previous.valueKind !== next.valueKind ||
    stableValue(previous.assessmentBindings) !== stableValue(next.assessmentBindings) ||
    stableValue(previous.unitPolicy) !== stableValue(next.unitPolicy) ||
    stableValue(previous.requiredModifiers ?? []) !== stableValue(next.requiredModifiers ?? []);
  if (identityChanged) {
    return {
      definitionKey: next.key,
      classification: "breaking",
      reason: "Identity, context, unit, or assessment compatibility changed",
    };
  }
  if (stableValue(previous.aliases) !== stableValue(next.aliases)) {
    const previousReviewed = new Map(previous.aliases
      .filter((alias) => alias.lifecycle === "active" && alias.matchAuthority === "reviewed_resolution")
      .map((alias) => [alias.key, alias]));
    const nextReviewed = new Map(next.aliases
      .filter((alias) => alias.lifecycle === "active" && alias.matchAuthority === "reviewed_resolution")
      .map((alias) => [alias.key, alias]));
    const removedOrBroadened = [...previousReviewed.values()].some((alias) => {
      const replacement = nextReviewed.get(alias.key);
      return !replacement ||
        replacement.value !== alias.value ||
        replacement.matchType !== alias.matchType ||
        replacement.laboratory !== alias.laboratory ||
        replacement.matchAuthority !== alias.matchAuthority;
    });
    return {
      definitionKey: next.key,
      classification: removedOrBroadened ? "breaking" : "review_required",
      reason: removedOrBroadened ? "Reviewed alias admission changed" : "Alias authority policy changed",
    };
  }
  return {
    definitionKey: next.key,
    classification: "compatibility_preserving",
    reason: "Display-only metadata changed",
  };
}

export function buildMeasurementCatalogManifestRelease(options?: {
  previousDefinitions?: readonly MeasurementDefinition[];
  changelog?: string[];
  regressionFixtures?: MeasurementCatalogManifestRelease["regressionFixtures"];
}): MeasurementCatalogManifestRelease {
  const previousByKey = new Map(options?.previousDefinitions?.map((definition) => [definition.key, definition]));
  return {
    catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    resolverVersion: MEASUREMENT_RESOLVER_VERSION,
    normalizationVersion: MEASUREMENT_NORMALIZATION_VERSION,
    compatibilityPolicyVersion: MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
    manifestDigest: digestMeasurementRegistryManifest(),
    changelog: options?.changelog ?? ["EH-111 clinical compatibility policy cutover"],
    changedDefinitions: MEASUREMENT_DEFINITIONS.map((definition) =>
      classifyMeasurementDefinitionChange(previousByKey.get(definition.key), definition)
    ),
    regressionFixtures: options?.regressionFixtures ?? [
      { name: "verify-biomarkers-runner", status: "declared" },
    ],
  };
}

export const MEASUREMENT_CATALOG_MANIFEST_DIGEST = digestMeasurementRegistryManifest();
export const MEASUREMENT_CATALOG_MANIFEST_RELEASE = buildMeasurementCatalogManifestRelease();
