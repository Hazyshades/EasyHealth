"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Clipboard,
  Clock3,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import type {
  OwnerShare,
  ShareAccessEvent,
  ShareAccessResult,
  ShareStatus,
} from "@/lib/share-management/projection";

const STATUS_LABELS: Record<ShareStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

const STATUS_VARIANTS: Record<ShareStatus, "success" | "warning" | "neutral"> =
  {
    active: "success",
    expired: "warning",
    revoked: "neutral",
  };

const RESULT_LABELS: Record<ShareAccessResult, string> = {
  allowed: "Allowed",
  denied: "Denied",
  expired: "Expired",
  revoked: "Revoked",
  rate_limited: "Rate limited",
};

const RESULT_VARIANTS: Record<
  ShareAccessResult,
  "success" | "warning" | "error" | "neutral"
> = {
  allowed: "success",
  denied: "error",
  expired: "warning",
  revoked: "neutral",
  rate_limited: "warning",
};

const POLICY_LABELS = {
  none: "View only",
  report: "Report and approved exports",
  documents: "Report and selected documents",
} as const;
type ShareableReport = {
  id: string;
  title: string;
  created_at: string;
};

function isShareableReport(value: unknown): value is ShareableReport {
  return (
    typeof readProperty(value, "id") === "string" &&
    typeof readProperty(value, "title") === "string" &&
    typeof readProperty(value, "created_at") === "string"
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function readProperty(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object" || !(key in value))
    return undefined;
  return Reflect.get(value, key);
}

function isShareAccessResult(value: unknown): value is ShareAccessResult {
  return typeof value === "string" && Object.hasOwn(RESULT_LABELS, value);
}

function isShareAccessEvent(value: unknown): value is ShareAccessEvent {
  return (
    typeof readProperty(value, "occurred_at") === "string" &&
    isShareAccessResult(readProperty(value, "result")) &&
    typeof readProperty(value, "resource_kind") === "string" &&
    typeof readProperty(value, "client_class") === "string"
  );
}

function isOwnerShare(value: unknown): value is OwnerShare {
  const status = readProperty(value, "status");
  const formats = readProperty(value, "allowed_export_formats");
  const policy = readProperty(value, "download_policy");
  const outcomes = readProperty(value, "outcomes");
  const accessHistory = readProperty(value, "access_history");
  return (
    typeof readProperty(value, "id") === "string" &&
    typeof readProperty(value, "resource_scope_label") === "string" &&
    typeof readProperty(value, "created_at") === "string" &&
    typeof readProperty(value, "expires_at") === "string" &&
    (status === "active" || status === "expired" || status === "revoked") &&
    typeof policy === "string" &&
    Object.hasOwn(POLICY_LABELS, policy) &&
    Array.isArray(formats) &&
    formats.every(
      (format) =>
        typeof format === "string" &&
        (format === "pdf" || format === "csv" || format === "json"),
    ) &&
    (readProperty(value, "last_accessed_at") === null ||
      typeof readProperty(value, "last_accessed_at") === "string") &&
    outcomes !== null &&
    typeof outcomes === "object" &&
    (Object.keys(RESULT_LABELS) as ShareAccessResult[]).every(
      (result) => typeof readProperty(outcomes, result) === "number",
    ) &&
    Array.isArray(accessHistory) &&
    accessHistory.every(isShareAccessEvent)
  );
}

function parseShares(value: unknown): OwnerShare[] | null {
  const shares = readProperty(value, "shares");
  return Array.isArray(shares) && shares.every(isOwnerShare) ? shares : null;
}

function responseError(value: unknown, fallback: string): string {
  const message = readProperty(value, "error");
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

function responseLink(value: unknown): string | null {
  const link = readProperty(value, "link");
  if (typeof link === "string" && link.length > 0) return link;
  const shareUrl = readProperty(value, "share_url");
  return typeof shareUrl === "string" && shareUrl.length > 0 ? shareUrl : null;
}
function parseReports(value: unknown): ShareableReport[] | null {
  const reports = readProperty(value, "reports");
  return Array.isArray(reports) && reports.every(isShareableReport)
    ? reports
    : null;
}

function groupedShares(
  shares: OwnerShare[],
): Record<ShareStatus, OwnerShare[]> {
  return {
    active: shares.filter((share) => share.status === "active"),
    expired: shares.filter((share) => share.status === "expired"),
    revoked: shares.filter((share) => share.status === "revoked"),
  };
}

function displayOutcomeCount(
  share: OwnerShare,
  result: ShareAccessResult,
): string {
  const count = share.outcomes?.[result] ?? 0;
  return `${RESULT_LABELS[result]} ${count}`;
}

function AccessEvent({ event }: { event: ShareAccessEvent }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--eh-border-soft)] py-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <StatusChip variant={RESULT_VARIANTS[event.result]}>
          {RESULT_LABELS[event.result]}
        </StatusChip>
        <span className="text-[var(--eh-text-secondary)]">
          {event.resource_kind}
        </span>
      </div>
      <span className="text-xs text-[var(--eh-text-secondary)]">
        {formatDate(event.occurred_at)} · {event.client_class}
      </span>
    </li>
  );
}

export default function SharedReportsPage() {
  const [shares, setShares] = useState<OwnerShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [replacementLink, setReplacementLink] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const [reports, setReports] = useState<ShareableReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [sharePin, setSharePin] = useState("");
  const [downloadPolicy, setDownloadPolicy] = useState<"none" | "report">(
    "none",
  );
  const [exportFormats, setExportFormats] = useState<string[]>([]);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdCopyState, setCreatedCopyState] = useState<
    "idle" | "copied" | "manual"
  >("idle");
  const [replacementKeys, setReplacementKeys] = useState<
    Record<string, string>
  >({});
  const createdInputRef = useRef<HTMLInputElement>(null);

  const loadShares = useCallback(
    async (showLoading: boolean): Promise<boolean> => {
      if (showLoading) setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/share-management", {
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            responseError(payload, "Share management is unavailable"),
          );
        }
        const nextShares = parseShares(payload);
        if (!nextShares)
          throw new Error("Share management returned an invalid response");
        setShares(nextShares);
        return true;
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Share management is unavailable",
        );
        return false;
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [],
  );
  const loadReports = useCallback(async (): Promise<void> => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const response = await fetch("/api/reports?range=all", {
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseError(payload, "Reports are unavailable"));
      }
      const nextReports = parseReports(payload);
      if (!nextReports) throw new Error("Reports returned an invalid response");
      setReports(nextReports);
      setSelectedReportId((current) => current || nextReports[0]?.id || "");
    } catch (error) {
      setReportsError(
        error instanceof Error ? error.message : "Reports are unavailable",
      );
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    void loadShares(true);
    return () => {
      setCreatedLink(null);
      setReplacementLink(null);
    };
  }, [loadShares]);

  const grouped = useMemo(() => groupedShares(shares), [shares]);
  async function createShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReportId) {
      setActionError("Choose a report before creating a share link.");
      return;
    }

    const expiresAt = new Date(expiresAtInput);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
      setActionError("Choose a future expiry time.");
      return;
    }

    setPendingAction("create");
    setActionError(null);
    setNotice(null);
    setCreatedLink(null);
    setCreatedCopyState("idle");

    try {
      const response = await fetch(`/api/reports/${selectedReportId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          expires_at: expiresAt.toISOString(),
          pin: sharePin.trim() || null,
          download_policy: downloadPolicy,
          allowed_export_formats:
            downloadPolicy === "report" ? exportFormats : [],
          document_ids: [],
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          responseError(payload, "A share link could not be created"),
        );
      }
      const link = responseLink(payload);
      if (!link) throw new Error("The share link response was incomplete");
      setCreatedLink(link);
      setNotice(
        "A share link was created. Copy it now; it will not be shown again here.",
      );
      setSharePin("");
      await loadShares(false);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "A share link could not be created",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function revokeShare(share: OwnerShare) {
    if (
      !window.confirm(
        `Revoke access to “${share.resource_scope_label}”? The shared link will stop working after confirmation.`,
      )
    ) {
      return;
    }

    setPendingAction(`revoke:${share.id}`);
    setActionError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/share-management/${share.id}/revoke`, {
        method: "POST",
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          responseError(payload, "The share could not be revoked"),
        );
      }
      if (await loadShares(false)) {
        setNotice("Access revoked. The list now reflects the server status.");
      } else {
        setActionError(
          "Access was revoked, but the refreshed status is unavailable. Try again.",
        );
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The share could not be revoked",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function createReplacement(share: OwnerShare) {
    const idempotencyKey = replacementKeys[share.id] ?? crypto.randomUUID();
    if (!replacementKeys[share.id]) {
      setReplacementKeys((current) => ({
        ...current,
        [share.id]: idempotencyKey,
      }));
    }
    setPendingAction(`replace:${share.id}`);
    setActionError(null);
    setNotice(null);
    setReplacementLink(null);
    setCopyState("idle");

    try {
      const response = await fetch(`/api/share-management/${share.id}/rotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ idempotency_key: idempotencyKey }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          setReplacementKeys((current) => {
            const next = { ...current };
            delete next[share.id];
            return next;
          });
        }
        throw new Error(
          responseError(payload, "A replacement link could not be created"),
        );
      }
      setReplacementKeys((current) => {
        const next = { ...current };
        delete next[share.id];
        return next;
      });
      const link = responseLink(payload);
      if (link) {
        setReplacementLink(link);
        setNotice(
          "A replacement link was created. Copy it now; it will not be shown again here.",
        );
      } else {
        setNotice(
          "This replacement was already completed. No second link was issued.",
        );
      }
      if (!(await loadShares(false))) {
        setShares((current) =>
          current.map((item) =>
            item.id === share.id ? { ...item, status: "revoked" } : item,
          ),
        );
        setActionError(
          "Replacement succeeded, but the refreshed list could not be loaded. Refresh to confirm the server status.",
        );
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "A replacement link could not be created",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function copyReplacementLink() {
    if (!replacementLink) return;

    if (!navigator.clipboard?.writeText) {
      setCopyState("manual");
      replacementInputRef.current?.focus();
      replacementInputRef.current?.select();
      return;
    }

    try {
      await navigator.clipboard.writeText(replacementLink);
      setReplacementLink(null);
      setCopyState("copied");
      setNotice("Replacement link copied. It has been cleared from this page.");
    } catch {
      setCopyState("manual");
      replacementInputRef.current?.focus();
      replacementInputRef.current?.select();
    }
  }

  async function copyCreatedLink() {
    if (!createdLink) return;

    if (!navigator.clipboard?.writeText) {
      setCreatedCopyState("manual");
      createdInputRef.current?.focus();
      createdInputRef.current?.select();
      return;
    }

    try {
      await navigator.clipboard.writeText(createdLink);
      setCreatedLink(null);
      setCreatedCopyState("copied");
      setNotice("Share link copied. It has been cleared from this page.");
    } catch {
      setCreatedCopyState("manual");
      createdInputRef.current?.focus();
      createdInputRef.current?.select();
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          title="Shared reports"
          subtitle="Review who can access your reports and stop access when needed."
          compact
        />
        <SurfaceCard className="space-y-4 p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-24 w-full" />
        </SurfaceCard>
        <SurfaceCard className="space-y-4 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 w-full" />
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Shared reports"
        subtitle="Review shared access, see privacy-minimized activity, and revoke links from one place."
        compact
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadShares(true)}
            disabled={pendingAction !== null}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <SurfaceCard className="flex items-start gap-3 border-[var(--eh-brand)]/20 bg-[var(--eh-brand-soft)] p-5">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--eh-brand)]"
        />
        <div className="min-w-0">
          <p className="font-medium text-[var(--eh-text-primary)]">
            Access history is minimized
          </p>
          <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[var(--eh-text-primary)]">
            Events show the time, outcome, resource type, and a coarse client
            class. Raw IP addresses, full browser details, tokens, PINs, and
            report contents are not shown here.
          </p>
        </div>
      </SurfaceCard>
      <SurfaceCard className="space-y-4 p-5">
        <div>
          <h2 className="text-balance text-base font-semibold text-[var(--eh-text-primary)]">
            Create a share link
          </h2>
          <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[var(--eh-text-secondary)]">
            Choose a validated report, an expiry, and the access settings. The
            plaintext link appears once and is cleared after copying.
          </p>
        </div>
        {reportsError ? (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-red-700">{reportsError}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadReports()}
              disabled={pendingAction !== null}
            >
              Load reports again
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => void createShare(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-[var(--eh-text-primary)]">
                Report
                <select
                  value={selectedReportId}
                  onChange={(event) => setSelectedReportId(event.target.value)}
                  disabled={reportsLoading || pendingAction !== null}
                  required
                  className="min-h-10 rounded-md border border-[var(--eh-border)] bg-white px-3 text-sm font-normal outline-none focus-visible:border-[var(--eh-brand)] focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/30"
                >
                  <option value="">
                    {reportsLoading ? "Loading reports..." : "Choose a report"}
                  </option>
                  {reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[var(--eh-text-primary)]">
                Expires
                <input
                  type="datetime-local"
                  value={expiresAtInput}
                  onChange={(event) => setExpiresAtInput(event.target.value)}
                  disabled={pendingAction !== null}
                  required
                  className="min-h-10 rounded-md border border-[var(--eh-border)] bg-white px-3 text-sm font-normal outline-none focus-visible:border-[var(--eh-brand)] focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/30"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-[var(--eh-text-primary)]">
                PIN (optional)
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={64}
                  value={sharePin}
                  onChange={(event) => setSharePin(event.target.value)}
                  disabled={pendingAction !== null}
                  placeholder="At least 4 characters"
                  className="min-h-10 rounded-md border border-[var(--eh-border)] bg-white px-3 text-sm font-normal outline-none focus-visible:border-[var(--eh-brand)] focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/30"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[var(--eh-text-primary)]">
                Download policy
                <select
                  value={downloadPolicy}
                  onChange={(event) => {
                    const nextPolicy = event.target.value as "none" | "report";
                    setDownloadPolicy(nextPolicy);
                    if (nextPolicy === "none") setExportFormats([]);
                  }}
                  disabled={pendingAction !== null}
                  className="min-h-10 rounded-md border border-[var(--eh-border)] bg-white px-3 text-sm font-normal outline-none focus-visible:border-[var(--eh-brand)] focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/30"
                >
                  <option value="none">View only</option>
                  <option value="report">Report and approved exports</option>
                </select>
              </label>
            </div>
            {downloadPolicy === "report" && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-[var(--eh-text-primary)]">
                  Allowed export formats
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(["pdf", "csv", "json"] as const).map((format) => (
                    <label
                      key={format}
                      className="flex min-h-10 items-center gap-2 rounded-md border border-[var(--eh-border)] px-3 text-sm text-[var(--eh-text-secondary)]"
                    >
                      <input
                        type="checkbox"
                        checked={exportFormats.includes(format)}
                        onChange={(event) => {
                          setExportFormats((current) =>
                            event.target.checked
                              ? [...current, format]
                              : current.filter((item) => item !== format),
                          );
                        }}
                        disabled={pendingAction !== null}
                      />
                      {format.toUpperCase()}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <Button
              type="submit"
              disabled={
                pendingAction !== null || reportsLoading || reports.length === 0
              }
            >
              Create share link
            </Button>
          </form>
        )}
      </SurfaceCard>

      {createdLink && (
        <SurfaceCard
          className="space-y-3 border-[var(--eh-brand)]/30 p-5"
          aria-live="polite"
        >
          <div>
            <p className="font-medium text-[var(--eh-text-primary)]">
              Share link ready
            </p>
            <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
              This plaintext link is available once. Copy it before leaving this
              page.
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              ref={createdInputRef}
              aria-label="Share link"
              readOnly
              value={createdLink}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-10 min-w-0 flex-1 rounded-md border border-[var(--eh-border)] bg-white px-3 text-sm text-[var(--eh-text-primary)] outline-none focus-visible:border-[var(--eh-brand)] focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/30"
            />
            <Button type="button" onClick={() => void copyCreatedLink()}>
              <Clipboard aria-hidden="true" />
              Copy link
            </Button>
          </div>
          {createdCopyState === "manual" && (
            <p className="text-sm text-amber-800" role="status">
              Clipboard access is unavailable. Select the link above and copy it
              manually.
            </p>
          )}
        </SurfaceCard>
      )}

      {replacementLink && (
        <SurfaceCard
          className="space-y-3 border-[var(--eh-brand)]/30 p-5"
          aria-live="polite"
        >
          <div>
            <p className="font-medium text-[var(--eh-text-primary)]">
              Replacement link ready
            </p>
            <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
              This plaintext link is available once. Copy it before leaving this
              page.
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              ref={replacementInputRef}
              aria-label="Replacement share link"
              readOnly
              value={replacementLink}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-10 min-w-0 flex-1 rounded-md border border-[var(--eh-border)] bg-white px-3 text-sm text-[var(--eh-text-primary)] outline-none focus-visible:border-[var(--eh-brand)] focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/30"
            />
            <Button type="button" onClick={() => void copyReplacementLink()}>
              <Clipboard aria-hidden="true" />
              Copy link
            </Button>
          </div>
          {copyState === "manual" && (
            <p className="text-sm text-amber-800" role="status">
              Clipboard access is unavailable. Select the link above and copy it
              manually.
            </p>
          )}
        </SurfaceCard>
      )}

      {copyState === "copied" && !replacementLink && (
        <p className="text-sm text-emerald-700" role="status">
          Replacement link copied and cleared from this page.
        </p>
      )}
      {notice && !replacementLink && (
        <p className="text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <SurfaceCard
          className="space-y-3 border-red-200 bg-red-50 p-5"
          role="alert"
        >
          <p className="font-medium text-red-900">
            Shared reports could not be loaded
          </p>
          <p className="text-sm text-red-800">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadShares(true)}
          >
            Try again
          </Button>
        </SurfaceCard>
      )}
      {actionError && (
        <p className="text-sm text-red-700" role="alert">
          {actionError}
        </p>
      )}

      {!loadError && shares.length === 0 && (
        <SurfaceCard className="space-y-3 p-8 text-center">
          <p className="font-medium text-[var(--eh-text-primary)]">
            No shared reports yet
          </p>
          <p className="mx-auto max-w-[58ch] text-sm leading-6 text-[var(--eh-text-secondary)]">
            Share links created from a report will appear here with their
            current status and privacy-minimized access history.
          </p>
          <Button asChild variant="outline">
            <Link href="/app/reports">Open reports</Link>
          </Button>
        </SurfaceCard>
      )}

      {!loadError &&
        (Object.keys(grouped) as ShareStatus[]).map((status) => {
          const sectionShares = grouped[status];
          return (
            <section
              key={status}
              aria-labelledby={`share-group-${status}`}
              className="space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id={`share-group-${status}`}
                    className="text-balance text-base font-semibold text-[var(--eh-text-primary)]"
                  >
                    {STATUS_LABELS[status]}
                  </h2>
                  <p className="text-sm text-[var(--eh-text-secondary)]">
                    {sectionShares.length === 0
                      ? "No links in this group"
                      : `${sectionShares.length} ${sectionShares.length === 1 ? "link" : "links"}`}
                  </p>
                </div>
                <StatusChip variant={STATUS_VARIANTS[status]}>
                  {STATUS_LABELS[status]}
                </StatusChip>
              </div>

              {sectionShares.length > 0 && (
                <div className="space-y-3">
                  {sectionShares.map((share) => (
                    <SurfaceCard key={share.id} className="space-y-4 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-balance truncate text-base font-semibold text-[var(--eh-text-primary)]">
                              {share.resource_scope_label}
                            </h3>
                            <StatusChip variant={STATUS_VARIANTS[share.status]}>
                              {STATUS_LABELS[share.status]}
                            </StatusChip>
                          </div>
                          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
                            Created {formatDate(share.created_at)} · Expires{" "}
                            {formatDate(share.expires_at)}
                          </p>
                        </div>
                        {share.status === "active" && (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={pendingAction !== null}
                              onClick={() => void createReplacement(share)}
                            >
                              <RefreshCw aria-hidden="true" />
                              Create replacement link
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              disabled={pendingAction !== null}
                              onClick={() => void revokeShare(share)}
                            >
                              <XCircle aria-hidden="true" />
                              {pendingAction === `revoke:${share.id}`
                                ? "Revoking..."
                                : "Revoke"}
                            </Button>
                          </div>
                        )}
                      </div>

                      <dl className="grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--eh-text-secondary)]">
                            Last successful access
                          </dt>
                          <dd className="mt-1 flex items-center gap-1.5 text-[var(--eh-text-secondary)]">
                            <Clock3
                              aria-hidden="true"
                              className="size-4 shrink-0"
                            />
                            {formatDate(share.last_accessed_at)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--eh-text-secondary)]">
                            Download policy
                          </dt>
                          <dd className="mt-1 text-[var(--eh-text-secondary)]">
                            {POLICY_LABELS[share.download_policy]}
                            {share.allowed_export_formats.length > 0 && (
                              <span className="block text-xs text-[var(--eh-text-secondary)]">
                                Formats:{" "}
                                {share.allowed_export_formats.join(", ")}
                              </span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--eh-text-secondary)]">
                            Recorded outcomes
                          </dt>
                          <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[var(--eh-text-secondary)]">
                            {(
                              [
                                "allowed",
                                "denied",
                                "expired",
                                "revoked",
                                "rate_limited",
                              ] as ShareAccessResult[]
                            ).map((result) => (
                              <span key={result}>
                                {displayOutcomeCount(share, result)}
                              </span>
                            ))}
                          </dd>
                        </div>
                      </dl>

                      <details className="group rounded-md border border-[var(--eh-border-soft)] px-3">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[var(--eh-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                          <span>Access history</span>
                          <CheckCircle2
                            aria-hidden="true"
                            className="size-4 text-[var(--eh-text-muted)] transition-transform group-open:rotate-90"
                          />
                        </summary>
                        {share.access_history.length === 0 ? (
                          <p className="border-t border-[var(--eh-border-soft)] py-3 text-sm text-[var(--eh-text-secondary)]">
                            No retained access events for this link.
                          </p>
                        ) : (
                          <ul>
                            {share.access_history.map((event, index) => (
                              <AccessEvent
                                key={`${event.occurred_at}-${event.result}-${index}`}
                                event={event}
                              />
                            ))}
                          </ul>
                        )}
                      </details>
                    </SurfaceCard>
                  ))}
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
