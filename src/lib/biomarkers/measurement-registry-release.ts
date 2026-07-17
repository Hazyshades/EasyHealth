import { createHash } from "node:crypto";
import {
  MEASUREMENT_DEFINITIONS,
  ANALYTES,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
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
    aliases: definition.aliases.map((alias) => ({
      value: alias.value,
      normalizedValue: alias.normalizedValue,
      source: alias.source,
      matchType: alias.matchType,
      locale: alias.locale ?? null,
      laboratory: alias.laboratory ?? null,
    })),
    unitPolicy: definition.unitPolicy,
    allowedSpecimens: definition.allowedSpecimens ?? [],
    requiredModifiers: definition.requiredModifiers ?? [],
    assessmentBindings: definition.assessmentBindings,
  };
}

export function serializeMeasurementRegistryManifest(
  definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS
): string {
  return stableValue({
    registryModel: "launch-catalog-v2",
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
    stableValue(previous.allowedSpecimens ?? []) !== stableValue(next.allowedSpecimens ?? []) ||
    stableValue(previous.requiredModifiers ?? []) !== stableValue(next.requiredModifiers ?? []);
  if (identityChanged) {
    return {
      definitionKey: next.key,
      classification: "breaking",
      reason: "Identity, context, unit, or assessment compatibility changed",
    };
  }
  if (stableValue(previous.aliases) !== stableValue(next.aliases)) {
    return {
      definitionKey: next.key,
      classification: "review_required",
      reason: "Alias policy changed",
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
    manifestDigest: digestMeasurementRegistryManifest(),
    changelog: options?.changelog ?? ["Registry 2.1 measurement governance baseline"],
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
