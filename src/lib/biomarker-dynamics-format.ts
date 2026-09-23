import type { BiomarkerDynamicsSeries } from "@/lib/biomarker-dynamics";

export function formatBiomarkerDynamicsValue(
  value: number | null,
  unit: string | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return "Not available";
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function humanizeBiomarkerDynamicsIdentityValue(value: string): string {
  const words = value.replaceAll("_", " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown";
}

export function formatBiomarkerDynamicsSeriesLabel(
  series: Pick<BiomarkerDynamicsSeries, "label" | "displayUnit" | "identity">,
): string {
  const identity = series.identity;
  const identityParts = [
    `Definition: ${humanizeBiomarkerDynamicsIdentityValue(identity.measurementDefinitionKey)}`,
    identity.specimen
      ? `Specimen: ${humanizeBiomarkerDynamicsIdentityValue(identity.specimen)}`
      : null,
    identity.modifier
      ? `Modifier: ${humanizeBiomarkerDynamicsIdentityValue(identity.modifier)}`
      : null,
    identity.method
      ? `Method: ${humanizeBiomarkerDynamicsIdentityValue(identity.method)}`
      : null,
    identity.scale
      ? `Scale: ${humanizeBiomarkerDynamicsIdentityValue(identity.scale)}`
      : null,
  ].filter((part): part is string => part !== null);

  return [series.label, series.displayUnit, ...identityParts]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
