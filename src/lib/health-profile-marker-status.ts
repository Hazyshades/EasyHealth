import type { ValueKind } from "@/lib/biomarkers";

export type MarkerStatus = "in_range" | "out_of_range" | "unknown";

/** Classifies a factual value against the reference range printed with it. */
export function getMarkerStatus(
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
  valueKind: ValueKind = "numeric",
): MarkerStatus {
  if (valueKind !== "numeric" || value == null) return "unknown";
  if (refLow == null && refHigh == null) return "unknown";
  if (refLow != null && value < refLow) return "out_of_range";
  if (refHigh != null && value > refHigh) return "out_of_range";
  return "in_range";
}
