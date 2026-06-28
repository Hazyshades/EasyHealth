"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ensureGatewayFunded,
  isPaidRequestFailedError,
  payForResource,
  retryWithEntitlement,
} from "@/lib/payments/gateway-client";
import { useWallet } from "@/components/wallet-provider";
import {
  buildDefaultReportTitle,
  DETAIL_LEVEL_HINTS,
  DETAIL_LEVEL_LABELS,
  DETAIL_LEVELS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  type DetailLevel,
  type ReportType,
} from "@/lib/report-prompts";

type EligibleDocument = {
  id: string;
  original_filename: string;
  observed_at: string | null;
  lab_name: string | null;
};

function formatDocDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CreateReportPage() {
  const router = useRouter();
  const { fundGatewayWallet } = useWallet();

  const [title, setTitle] = useState(buildDefaultReportTitle);
  const [reportType, setReportType] = useState<ReportType>("general_practice");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("standard");
  const [eligibleDocs, setEligibleDocs] = useState<EligibleDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const [entitlementId, setEntitlementId] = useState<string | null>(null);

  const loadEligibleDocs = useCallback(() => {
    setLoadingDocs(true);
    fetch("/api/documents?eligible_for_report=1")
      .then((r) => r.json())
      .then((data) => setEligibleDocs(data.documents ?? []))
      .finally(() => setLoadingDocs(false));
  }, []);

  useEffect(() => {
    loadEligibleDocs();
  }, [loadEligibleDocs]);

  const hasEligibleDocs = eligibleDocs.length > 0;
  const modalSelection = selectedIds ?? eligibleDocs.map((d) => d.id);
  const selectedCount =
    selectedIds === null ? eligibleDocs.length : selectedIds.length;

  function buildRequestBody() {
    return {
      title: title.trim(),
      report_type: reportType,
      detail_level: detailLevel,
      document_ids: selectedIds,
      abnormal_only: abnormalOnly,
    };
  }

  async function submitReport(options?: { entitlementId?: string; autoRetry?: boolean }) {
    if (!hasEligibleDocs) return;

    setSubmitting(true);
    setError(null);
    if (!options?.entitlementId) {
      setPaidAmount(null);
    }

    const body = buildRequestBody();
    const url = `${window.location.origin}/api/reports`;

    try {
      if (options?.entitlementId) {
        const result = await retryWithEntitlement(url, options.entitlementId, {
          method: "POST",
          body,
        });
        setEntitlementId(null);
        const data = result.data as { id: string };
        router.push(`/app/reports/${data.id}`);
        return;
      }

      await ensureGatewayFunded("0.06", fundGatewayWallet);

      const result = await payForResource(url, {
        method: "POST",
        body,
      });

      setPaidAmount(result.formattedAmount);
      setEntitlementId(null);
      const data = result.data as { id: string };
      router.push(`/app/reports/${data.id}`);
    } catch (e) {
      if (
        options?.autoRetry !== false &&
        isPaidRequestFailedError(e) &&
        e.entitlementId &&
        e.retryWithoutPayment
      ) {
        await submitReport({ entitlementId: e.entitlementId, autoRetry: false });
        return;
      }

      if (isPaidRequestFailedError(e) && e.entitlementId && e.retryWithoutPayment) {
        setEntitlementId(e.entitlementId);
      } else {
        setEntitlementId(null);
      }

      setError(e instanceof Error ? e.message : "Failed to create report");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitReport();
  }

  async function handleEntitlementRetry() {
    if (!entitlementId) return;
    await submitReport({ entitlementId });
  }

  function toggleDoc(id: string) {
    setSelectedIds((prev) => {
      const base = prev ?? eligibleDocs.map((d) => d.id);
      if (base.includes(id)) {
        return base.filter((x) => x !== id);
      }
      return [...base, id];
    });
  }

  function selectAll() {
    setSelectedIds(eligibleDocs.map((d) => d.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function confirmModal() {
    setModalOpen(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/app/reports" className="hover:underline">
            Health reports
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold">New health report</h1>
        <p className="text-muted-foreground">
          Educational clinician-ready summary · $0.05 USDC 
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Report name
          </label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Report type</label>
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {REPORT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Report detail level</label>
          <Select value={detailLevel} onValueChange={(v) => setDetailLevel(v as DetailLevel)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DETAIL_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {DETAIL_LEVEL_LABELS[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {DETAIL_LEVEL_HINTS[detailLevel] && (
            <p className="text-xs text-muted-foreground">{DETAIL_LEVEL_HINTS[detailLevel]}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Selected records</label>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={!hasEligibleDocs || loadingDocs}
            onClick={() => setModalOpen(true)}
          >
            {loadingDocs
              ? "Loading documents…"
              : !hasEligibleDocs
                ? "No eligible documents"
                : selectedIds === null
                  ? `All eligible records (${eligibleDocs.length})`
                  : `${selectedCount} of ${eligibleDocs.length} selected`}
          </Button>
          {!hasEligibleDocs && !loadingDocs && (
            <p className="text-xs text-muted-foreground">
              Upload and process lab results first.{" "}
              <Link href="/app/upload?type=lab" className="text-teal-700 hover:underline">
                Upload your lab
              </Link>
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={
            submitting ||
            !hasEligibleDocs ||
            (selectedIds !== null && selectedIds.length === 0)
          }
          className="w-full"
        >
          {submitting ? "Paying & generating…" : "Create report - $0.05"}
        </Button>

        {paidAmount && (
          <p className="text-sm text-teal-700">Paid {paidAmount} USDC via Arc Gateway</p>
        )}
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{error}</p>
            {entitlementId && (
              <Button type="button" variant="outline" disabled={submitting} onClick={handleEntitlementRetry}>
                {submitting ? "Retrying…" : "Retry without additional charge"}
              </Button>
            )}
          </div>
        )}
      </form>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg">
            <div className="border-b p-4">
              <h2 className="font-semibold">Select documents for report</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose lab records to include in this health report.
              </p>
              <div className="mt-3 flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  className="text-teal-700 hover:underline"
                  onClick={selectAll}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-teal-700 hover:underline"
                  onClick={clearSelection}
                >
                  Clear selection
                </button>
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto p-4 space-y-2">
              {eligibleDocs.map((doc) => {
                const checked = modalSelection.includes(doc.id);
                return (
                  <li key={doc.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleDoc(doc.id)}
                      />
                      <div>
                        <p className="text-sm font-medium">{doc.original_filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.lab_name ?? "Unknown lab"}
                          {doc.observed_at ? ` · ${formatDocDate(doc.observed_at)}` : ""}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="border-t p-4">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-sm font-medium text-slate-800"
                onClick={() => setSettingsOpen((o) => !o)}
              >
                <span className={settingsOpen ? "rotate-90" : ""}>›</span>
                Additional settings
              </button>
              {settingsOpen && (
                <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={abnormalOnly}
                    onChange={(e) => setAbnormalOnly(e.target.checked)}
                  />
                  <span>Include only out-of-range indicators</span>
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmModal}>
                Add selected ({modalSelection.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
