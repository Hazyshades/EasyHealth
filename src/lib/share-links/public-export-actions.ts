import { applyPublicShareResponsePolicy } from "./public-response-policy";

export const PUBLIC_SHARE_EXPORT_FORMATS = ["pdf", "csv", "json"] as const;
export type PublicShareExportFormat =
  (typeof PUBLIC_SHARE_EXPORT_FORMATS)[number];

export type PublicShareExportAction = Readonly<{
  format: PublicShareExportFormat;
  label: string;
}>;

const EXPORT_LABELS: Record<PublicShareExportFormat, string> = {
  pdf: "PDF",
  csv: "CSV",
  json: "JSON",
};

export function getPublicShareExportActions(
  allowedFormats: readonly string[],
): readonly PublicShareExportAction[] {
  return PUBLIC_SHARE_EXPORT_FORMATS.filter((format) =>
    allowedFormats.includes(format),
  ).map((format) => ({ format, label: EXPORT_LABELS[format] }));
}

export function applyPublicShareExportResponsePolicy(
  response: Response,
): Response {
  return applyPublicShareResponsePolicy(response);
}
