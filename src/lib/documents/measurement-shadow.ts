import { getBiomarkerDefinition } from "@/lib/biomarkers";
import type { MeasurementResolution } from "@/lib/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";

export type MeasurementShadowEventType =
  | "resolution"
  | "manual_correction"
  | "promotion_rejected"
  | "processing_error";

export function isScoreImpactingResolutionDifference(options: {
  legacyBiomarkerKey: string;
  resolution: MeasurementResolution;
}): boolean {
  const legacy = getBiomarkerDefinition(options.legacyBiomarkerKey);
  if (legacy?.scoreRole !== "core") return false;
  const definitionKey = options.resolution.measurementDefinitionKey;
  if (!definitionKey || options.resolution.result !== "resolved") return true;
  const resolvedKey = options.resolution.canonicalKey;
  return resolvedKey !== options.legacyBiomarkerKey;
}

export async function recordMeasurementShadowEvent(options: {
  profileId: string;
  documentId: string;
  extractedBiomarkerId: string;
  eventType: MeasurementShadowEventType;
  legacyBiomarkerKey: string;
  resolution: MeasurementResolution;
  promotionRejectionReason?: string | null;
  context?: Record<string, string | null>;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("measurement_resolution_shadow_events").insert({
    profile_id: options.profileId,
    document_id: options.documentId,
    extracted_biomarker_id: options.extractedBiomarkerId,
    event_type: options.eventType,
    legacy_biomarker_key: options.legacyBiomarkerKey,
    measurement_definition_key: options.resolution.measurementDefinitionKey,
    resolver_result: options.resolution.result,
    mapping_confidence_band: options.resolution.mappingConfidenceBand,
    score_impacting_difference: isScoreImpactingResolutionDifference({
      legacyBiomarkerKey: options.legacyBiomarkerKey,
      resolution: options.resolution,
    }),
    promotion_rejection_reason: options.promotionRejectionReason ?? null,
    context: options.context ?? {},
  });
  if (error) throw error;
}

export async function getMeasurementShadowMetrics(options?: { since?: string }): Promise<{
  total: number;
  byResolverResult: Record<string, number>;
  scoreImpactingDifferences: number;
  manualCorrections: number;
  processingErrors: number;
  promotionRejections: Record<string, number>;
  confidenceBands: Record<string, number>;
}> {
  const supabase = createAdminClient();
  let query = supabase
    .from("measurement_resolution_shadow_events")
    .select("event_type, resolver_result, mapping_confidence_band, score_impacting_difference, promotion_rejection_reason");
  if (options?.since) query = query.gte("created_at", options.since);
  const { data, error } = await query;
  if (error) throw error;

  const metrics = {
    total: 0,
    byResolverResult: {} as Record<string, number>,
    scoreImpactingDifferences: 0,
    manualCorrections: 0,
    processingErrors: 0,
    promotionRejections: {} as Record<string, number>,
    confidenceBands: {} as Record<string, number>,
  };
  for (const event of data ?? []) {
    metrics.total += 1;
    if (event.resolver_result) {
      metrics.byResolverResult[event.resolver_result] = (metrics.byResolverResult[event.resolver_result] ?? 0) + 1;
    }
    if (event.mapping_confidence_band) {
      metrics.confidenceBands[event.mapping_confidence_band] =
        (metrics.confidenceBands[event.mapping_confidence_band] ?? 0) + 1;
    }
    if (event.score_impacting_difference) metrics.scoreImpactingDifferences += 1;
    if (event.event_type === "manual_correction") metrics.manualCorrections += 1;
    if (event.event_type === "processing_error") metrics.processingErrors += 1;
    if (event.promotion_rejection_reason) {
      metrics.promotionRejections[event.promotion_rejection_reason] =
        (metrics.promotionRejections[event.promotion_rejection_reason] ?? 0) + 1;
    }
  }
  return metrics;
}
