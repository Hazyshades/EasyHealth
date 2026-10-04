import type {
  BiomarkerDynamicsPoint,
  BiomarkerDynamicsReport,
  BiomarkerDynamicsSeries,
} from "@/lib/biomarker-dynamics";
import {
  type DoctorVisitBrief,
  type ReportClaim,
  type ReportSource,
  type ReportSourceSnapshot,
} from "@/lib/report-contract";
import type { ExportableReport, ExportLimitation } from "./types";

export type ExportDynamicsPoint = Readonly<{
  id: string;
  observedAt: string;
  documentId: string;
  nativeValue: number | null;
  nativeUnit: string | null;
  displayValue: number | null;
  displayUnit: string | null;
  nativeReferenceLow: number | null;
  nativeReferenceHigh: number | null;
  displayReferenceLow: number | null;
  displayReferenceHigh: number | null;
  conversionMetadata: Readonly<{
    converted: boolean;
    originalValue: number | null;
    originalUnit: string | null;
    conversionEligible: boolean;
  }> | null;
  source: Readonly<{
    documentId: string;
    filename: string;
    laboratory: string | null;
  }> | null;
}>;

export type ExportDynamicsSeries = Readonly<{
  id: string;
  measurementDefinitionKey: string;
  label: string;
  specimen: string | null;
  modifier: string | null;
  method: string | null;
  scale: string | null;
  unit: string | null;
  direction: Readonly<{
    value: BiomarkerDynamicsSeries["direction"]["value"];
    tolerance: Readonly<{ absolute: number; relative: number }> | null;
    limitation: Readonly<{
      type: string;
      message: string;
      detail?: string;
      observationId?: string;
    }> | null;
  }>;
  statistics: Readonly<{
    pointCount: number;
    min: number | null;
    max: number | null;
    latest: ExportDynamicsPoint | null;
    nativeUnit: string | null;
    displayUnit: string | null;
  }>;
  points: readonly ExportDynamicsPoint[];
  limitations: readonly Readonly<{
    type: string;
    message: string;
    detail?: string;
    observationId?: string;
  }>[];
  tolerance: Readonly<{ absolute: number; relative: number }> | null;
}>;

export type ExportDynamics = Readonly<{
  schemaVersion: string;
  directionPolicyVersion: string;
  period: Readonly<{ start: string; end: string }> | null;
  series: readonly ExportDynamicsSeries[];
  incompatibilities: readonly Readonly<{
    groupingReason: string;
    affectedSeriesLabels: readonly string[];
  }>[];
  limitations: readonly Readonly<{
    type: string;
    message: string;
    detail?: string;
    observationId?: string;
  }>[];
  disclaimer: string;
  generationMetadata: Readonly<{
    scopeKind: "profile_current" | "report_immutable";
    scopeDocumentIds: readonly string[];
    generatedAt: string;
  }>;
}>;

export type ExportProjection = Readonly<{
  exportVersion: "eh153.v1";
  report: Readonly<{
    id: string;
    title: string;
    reportType: string;
    detailLevel: string;
    abnormalOnly: boolean;
    schemaVersion: DoctorVisitBrief["schema_version"];
    reportKind: DoctorVisitBrief["report_kind"];
    generatedAt: string;
    requestedScope: DoctorVisitBrief["requested_scope"];
    sourceDocumentIds: readonly string[];
    sections: DoctorVisitBrief["sections"];
    claims: readonly ReportClaim[];
    sourceLedger: readonly ReportSource[];
    limitations: readonly ExportLimitation[];
    disclaimer: DoctorVisitBrief["disclaimer"];
    overview: string;
    validation: Readonly<{
      status: DoctorVisitBrief["validation"]["status"];
      version: string;
    }>;
  }>;
  dynamics: ExportDynamics | null;
}>;

function projectSnapshot(snapshot: ReportSourceSnapshot): ReportSourceSnapshot {
  switch (snapshot.kind) {
    case "observation":
      return {
        kind: snapshot.kind,
        label: snapshot.label,
        observed_at: snapshot.observed_at,
        value: snapshot.value,
        value_text: snapshot.value_text,
        unit: snapshot.unit,
        ref_low: snapshot.ref_low,
        ref_high: snapshot.ref_high,
      };
    case "finding":
      return {
        kind: snapshot.kind,
        label: snapshot.label,
        observed_at: snapshot.observed_at,
        finding_text: snapshot.finding_text,
        impression: snapshot.impression,
      };
    case "clinical_note":
      return {
        kind: snapshot.kind,
        label: snapshot.label,
        observed_at: snapshot.observed_at,
        provider_name: snapshot.provider_name,
        summary: snapshot.summary,
      };
    case "prescription":
      return {
        kind: snapshot.kind,
        label: snapshot.label,
        observed_at: snapshot.observed_at,
        prescriber_name: snapshot.prescriber_name,
        summary: snapshot.summary,
      };
    case "referral":
      return {
        kind: snapshot.kind,
        label: snapshot.label,
        observed_at: snapshot.observed_at,
        referring_provider: snapshot.referring_provider,
        referred_to_specialty: snapshot.referred_to_specialty,
        summary: snapshot.summary,
      };
    case "document_summary":
      return {
        kind: snapshot.kind,
        label: snapshot.label,
        observed_at: snapshot.observed_at,
        document_type: snapshot.document_type,
        summary: snapshot.summary,
      };
  }
}

function projectSource(source: ReportSource): ReportSource {
  return {
    source_id: source.source_id,
    kind: source.kind,
    document_id: source.document_id,
    snapshot: projectSnapshot(source.snapshot),
  };
}

function projectPoint(point: BiomarkerDynamicsPoint): ExportDynamicsPoint {
  return {
    id: point.id,
    observedAt: point.observedAt,
    documentId: point.documentId,
    nativeValue: point.nativeValue,
    nativeUnit: point.nativeUnit,
    displayValue: point.displayValue,
    displayUnit: point.displayUnit,
    nativeReferenceLow: point.nativeReferenceLow,
    nativeReferenceHigh: point.nativeReferenceHigh,
    displayReferenceLow: point.displayReferenceLow,
    displayReferenceHigh: point.displayReferenceHigh,
    conversionMetadata: point.conversionMetadata
      ? {
          converted: point.conversionMetadata.converted,
          originalValue: point.conversionMetadata.originalValue,
          originalUnit: point.conversionMetadata.originalUnit,
          conversionEligible: point.conversionMetadata.conversionEligible,
        }
      : null,
    source: point.source
      ? {
          documentId: point.source.documentId,
          filename: point.source.filename,
          laboratory: point.source.laboratory,
        }
      : null,
  };
}

function projectDynamicsReport(
  report: BiomarkerDynamicsReport,
): ExportDynamics {
  const projectLimitation = (
    limitation: BiomarkerDynamicsReport["limitations"][number],
  ) => ({
    type: limitation.type,
    message: limitation.message,
    ...(limitation.detail ? { detail: limitation.detail } : {}),
    ...(limitation.observationId
      ? { observationId: limitation.observationId }
      : {}),
  });

  const projectSeries = (
    series: BiomarkerDynamicsSeries,
  ): ExportDynamicsSeries => {
    const points = series.points.map(projectPoint);
    return {
      id: series.id,
      measurementDefinitionKey: series.measurementDefinitionKey,
      label: series.label,
      specimen: series.specimen,
      modifier: series.modifier,
      method: series.method,
      scale: series.scale,
      unit: series.unit,
      direction: {
        value: series.direction.value,
        tolerance: series.direction.tolerance
          ? {
              absolute: series.direction.tolerance.absolute,
              relative: series.direction.tolerance.relative,
            }
          : null,
        limitation: series.direction.limitation
          ? projectLimitation(series.direction.limitation)
          : null,
      },
      statistics: {
        pointCount: series.statistics.pointCount,
        min: series.statistics.min,
        max: series.statistics.max,
        latest: series.statistics.latest
          ? projectPoint(series.statistics.latest)
          : null,
        nativeUnit: series.statistics.nativeUnit,
        displayUnit: series.statistics.displayUnit,
      },
      points,
      limitations: series.limitations.map(projectLimitation),
      tolerance: series.tolerance
        ? {
            absolute: series.tolerance.absolute,
            relative: series.tolerance.relative,
          }
        : null,
    };
  };

  return {
    schemaVersion: report.schemaVersion,
    directionPolicyVersion: report.directionPolicyVersion,
    period: report.period ? { ...report.period } : null,
    series: report.series.map(projectSeries),
    incompatibilities: report.incompatibilities.map((item) => ({
      groupingReason: item.groupingReason,
      affectedSeriesLabels: [...item.affectedSeriesLabels],
    })),
    limitations: report.limitations.map(projectLimitation),
    disclaimer: report.disclaimer,
    generationMetadata: {
      scopeKind: report.generationMetadata.scopeKind,
      scopeDocumentIds: [...report.generationMetadata.scopeDocumentIds],
      generatedAt: report.generationMetadata.generatedAt,
    },
  };
}
function projectClaim(claim: ReportClaim): ReportClaim {
  if (claim.kind === "clinician_question") {
    return {
      ...claim,
      citations: [],
    };
  }
  return {
    ...claim,
    citations: claim.citations.map((citation) => ({ ...citation })),
  };
}

export function buildExportProjection(
  exportable: ExportableReport,
): ExportProjection {
  const brief = exportable.brief;
  const visibleClaims = brief.claims
    .filter(
      (claim) => claim.status === "supported" || claim.status === "limited",
    )
    .map(projectClaim);
  const visibleClaimIds = new Set(visibleClaims.map((claim) => claim.id));
  const sections = brief.sections.map((section) => ({
    id: section.id,
    items: section.items.filter(
      (item) => item.type !== "claim_ref" || visibleClaimIds.has(item.claim_id),
    ),
    ...(section.empty_state ? { empty_state: section.empty_state } : {}),
  }));

  return {
    exportVersion: "eh153.v1",
    report: {
      id: exportable.report.id,
      title: exportable.report.title,
      reportType: exportable.report.report_type,
      detailLevel: exportable.report.detail_level,
      abnormalOnly: exportable.report.abnormal_only,
      schemaVersion: brief.schema_version,
      reportKind: brief.report_kind,
      generatedAt: brief.generated_at,
      requestedScope: brief.requested_scope,
      sourceDocumentIds: [...brief.source_document_ids],
      sections,
      claims: visibleClaims,
      sourceLedger: exportable.sourceLedger.map(projectSource),
      limitations: brief.limitations.map((limitation) => ({
        id: limitation.id,
        message: limitation.message,
      })),
      disclaimer: brief.disclaimer,
      overview: brief.overview,
      validation: {
        status: brief.validation.status,
        version: brief.validation.version,
      },
    },
    dynamics: exportable.dynamics
      ? projectDynamicsReport(exportable.dynamics.report)
      : null,
  };
}
