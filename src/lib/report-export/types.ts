import type { FrozenBiomarkerDynamicsExtension } from "@/lib/biomarker-dynamics";
import type {
  DoctorVisitBrief,
  ReportLimitation,
  ReportSource,
  ReportValidationEnvelope,
} from "@/lib/report-contract";

export const REPORT_EXPORT_FORMATS = ["pdf", "csv", "json"] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export type ReportDownloadPolicy = "none" | "report" | "documents";

export type ReportShareExportCapability = Readonly<{
  reportId: string;
  ownerProfileId: string;
  reportScopeDocumentIds: readonly string[];
  rawDocumentIds: readonly string[];
  downloadPolicy: ReportDownloadPolicy;
  allowedExportFormats: readonly ReportExportFormat[];
}>;

export type ReportExportAccessContext =
  | Readonly<{
      kind: "owner";
      profileId: string;
    }>
  | Readonly<{
      kind: "share";
      capability: ReportShareExportCapability;
    }>;

export type ExportableReport = Readonly<{
  format: ReportExportFormat;
  reportId: string;
  report: Readonly<{
    id: string;
    title: string;
    report_type: string;
    detail_level: string;
    abnormal_only: boolean;
    created_at: string;
  }>;
  brief: DoctorVisitBrief;
  sourceLedger: readonly ReportSource[];
  validation: ReportValidationEnvelope;
  dynamics: FrozenBiomarkerDynamicsExtension | null;
  reportScopeDocumentIds: readonly string[];
  rawDocumentIds: readonly string[];
}>;

export type ReportExportFile = Readonly<{
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}>;

export type ExportLimitation = Pick<ReportLimitation, "id" | "message">;
