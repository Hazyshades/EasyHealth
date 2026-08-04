import {
  MEASUREMENT_CATALOG_MANIFEST_RELEASE,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
} from "@/lib/biomarkers";
import type { DeployedRegistryRelease } from "./types";

/**
 * Capture the deployed Registry 2.0 release identifiers from the runtime
 * constants. The digest is content-addressed: two independently compiled
 * deployments with identical registry content produce the same digest.
 *
 * This function is pure and synchronous; the release is a compile-time
 * constant at runtime.
 */
export function captureDeployedRelease(): DeployedRegistryRelease {
  return {
    catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
    resolverVersion: MEASUREMENT_RESOLVER_VERSION,
    normalizationVersion: MEASUREMENT_NORMALIZATION_VERSION,
    compatibilityPolicyVersion: MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
  };
}
