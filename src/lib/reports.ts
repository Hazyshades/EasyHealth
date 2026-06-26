import { createAdminClient } from "@/lib/supabase/admin";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

type ObservationRow = {
  name: string;
  biomarker_key: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  documents?: { original_filename: string; observed_at: string | null } | null;
};

export type ReportContextItem = {
  biomarker: string;
  key: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  source: string;
};

export async function getEligibleDocumentIds(profileId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: observations, error: obsError } = await supabase
    .from("observations")
    .select("document_id")
    .eq("profile_id", profileId)
    .not("document_id", "is", null);

  if (obsError) throw new Error(obsError.message);

  const candidateIds = [
    ...new Set(
      (observations ?? [])
        .map((o) => o.document_id)
        .filter((id): id is string => typeof id === "string")
    ),
  ];

  if (candidateIds.length === 0) return [];

  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "completed")
    .in("id", candidateIds);

  if (docError) throw new Error(docError.message);

  return (documents ?? []).map((d) => d.id);
}

export function isAbnormalObservation(o: Pick<ObservationRow, "value" | "ref_low" | "ref_high">): boolean {
  if (o.ref_low != null && o.value < o.ref_low) return true;
  if (o.ref_high != null && o.value > o.ref_high) return true;
  return false;
}

export function filterAbnormalObservations<T extends ObservationRow>(observations: T[]): T[] {
  return observations.filter(isAbnormalObservation);
}

export function buildReportContext(observations: ObservationRow[]): ReportContextItem[] {
  return observations.map((o) => ({
    biomarker: o.name,
    key: o.biomarker_key,
    value: o.value,
    unit: o.unit,
    ref_low: o.ref_low,
    ref_high: o.ref_high,
    observed_at: o.observed_at,
    source: o.documents?.original_filename ?? "unknown",
  }));
}

export function buildSummaryPreview(overview: string): string {
  const trimmed = overview.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 120).trimEnd()}…`;
}

export function withDisclaimer<T extends { disclaimer?: string }>(content: T) {
  return { ...content, disclaimer: MEDICAL_DISCLAIMER };
}
