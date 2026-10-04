export const SHARE_ACCESS_RESULTS = [
  "allowed",
  "denied",
  "expired",
  "revoked",
  "rate_limited",
] as const;

export type ShareAccessResult = (typeof SHARE_ACCESS_RESULTS)[number];
export type ShareStatus = "active" | "expired" | "revoked";
export type ShareDownloadPolicy = "none" | "report" | "documents";
export type ShareExportFormat = "pdf" | "csv" | "json";

export type ShareLinkSource = {
  id: string;
  profile_id: string;
  report_id: string;
  expires_at: string;
  revoked_at: string | null;
  download_policy: string;
  allowed_export_formats: unknown;
  created_at: string;
  last_accessed_at: string | null;
  reports?: { title: string | null } | { title: string | null }[] | null;
};

export type ShareAccessEventSource = {
  share_id: string;
  occurred_at: string;
  result: string;
  resource_kind: string;
  client_class: string;
  retention_expires_at: string;
};

export type ShareAccessEvent = {
  occurred_at: string;
  result: ShareAccessResult;
  resource_kind: string;
  client_class: string;
};

export type OwnerShare = {
  id: string;
  resource_scope_label: string;
  created_at: string;
  expires_at: string;
  status: ShareStatus;
  download_policy: ShareDownloadPolicy;
  allowed_export_formats: ShareExportFormat[];
  last_accessed_at: string | null;
  outcomes: Record<ShareAccessResult, number>;
  access_history: ShareAccessEvent[];
};

const SHARE_DOWNLOAD_POLICIES: Record<ShareDownloadPolicy, true> = {
  none: true,
  report: true,
  documents: true,
};

const SHARE_EXPORT_FORMATS: Record<ShareExportFormat, true> = {
  pdf: true,
  csv: true,
  json: true,
};

const SHARE_ACCESS_RESULT_SET: Record<ShareAccessResult, true> = {
  allowed: true,
  denied: true,
  expired: true,
  revoked: true,
  rate_limited: true,
};

function asSafeLabel(value: string, fallback: string): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 160) : fallback;
}

function reportTitle(source: ShareLinkSource): string {
  const report = source.reports;
  if (Array.isArray(report)) return report[0]?.title ?? "";
  return report?.title ?? "";
}

function shareStatus(source: ShareLinkSource, nowMs: number): ShareStatus {
  if (source.revoked_at) return "revoked";
  const expiresMs = Date.parse(source.expires_at);
  return Number.isFinite(expiresMs) && expiresMs > nowMs ? "active" : "expired";
}

function downloadPolicy(value: string): ShareDownloadPolicy {
  return Object.hasOwn(SHARE_DOWNLOAD_POLICIES, value)
    ? (value as ShareDownloadPolicy)
    : "none";
}

function exportFormats(value: unknown): ShareExportFormat[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (format): format is ShareExportFormat =>
      typeof format === "string" && Object.hasOwn(SHARE_EXPORT_FORMATS, format),
  );
}

function emptyOutcomes(): Record<ShareAccessResult, number> {
  return {
    allowed: 0,
    denied: 0,
    expired: 0,
    revoked: 0,
    rate_limited: 0,
  };
}

function projectEvent(
  event: ShareAccessEventSource,
  nowMs: number,
): ShareAccessEvent | null {
  if (Date.parse(event.retention_expires_at) <= nowMs) return null;

  // EH-151 records invalid PIN submissions separately; the owner projection
  // exposes only the approved aggregate outcome vocabulary.
  const result = event.result === "pin_invalid" ? "denied" : event.result;
  if (!Object.hasOwn(SHARE_ACCESS_RESULT_SET, result)) return null;

  return {
    occurred_at: event.occurred_at,
    result: result as ShareAccessResult,
    resource_kind: asSafeLabel(event.resource_kind, "resource"),
    client_class: asSafeLabel(event.client_class, "unknown"),
  };
}

export function projectOwnerShares(
  profileId: string,
  links: ShareLinkSource[],
  events: ShareAccessEventSource[],
  now = new Date(),
): OwnerShare[] {
  const nowMs = now.getTime();
  const eventsByShare = new Map<string, ShareAccessEvent[]>();

  for (const sourceEvent of events) {
    const event = projectEvent(sourceEvent, nowMs);
    if (!event) continue;
    const shareEvents = eventsByShare.get(sourceEvent.share_id) ?? [];
    shareEvents.push(event);
    eventsByShare.set(sourceEvent.share_id, shareEvents);
  }

  return links
    .filter((link) => link.profile_id === profileId)
    .map((link) => {
      const accessHistory = eventsByShare.get(link.id) ?? [];
      const outcomes = emptyOutcomes();
      for (const event of accessHistory) outcomes[event.result] += 1;

      return {
        id: link.id,
        resource_scope_label: asSafeLabel(reportTitle(link), "Shared report"),
        created_at: link.created_at,
        expires_at: link.expires_at,
        status: shareStatus(link, nowMs),
        download_policy: downloadPolicy(link.download_policy),
        allowed_export_formats: exportFormats(link.allowed_export_formats),
        last_accessed_at: link.last_accessed_at,
        outcomes,
        access_history: accessHistory,
      };
    });
}
