"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCUMENT_TYPE_LABELS,
  normalizeDocumentType,
  type DocumentType,
} from "@/lib/health-systems";
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
  document_type: string;
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

  const [title, setTitle] = useState(buildDefaultReportTitle);
  const [reportType, setReportType] = useState<ReportType>("general_practice");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("standard");
  const [eligibleDocs, setEligibleDocs] = useState<EligibleDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const selectionTriggerRef = useRef<HTMLButtonElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState("");
  const [reportRangeStart, setReportRangeStart] = useState("");
  const [reportRangeEnd, setReportRangeEnd] = useState("");
  const [dynamicsStart, setDynamicsStart] = useState("");
  const [dynamicsEnd, setDynamicsEnd] = useState("");

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

  const parsedQuestions = useMemo(
    () =>
      questions
        .split("\n")
        .map((question) => question.trim())
        .filter((question) => question.length > 0)
        .slice(0, 5),
    [questions],
  );
  const reportDateRange =
    reportRangeStart && reportRangeEnd
      ? { start: reportRangeStart, end: reportRangeEnd }
      : null;
  const biomarkerDynamicsPeriod =
    dynamicsStart && dynamicsEnd
      ? { start: dynamicsStart, end: dynamicsEnd }
      : null;
  const reversedReportRange =
    reportDateRange !== null && reportDateRange.start > reportDateRange.end;
  const reversedDynamicsPeriod =
    biomarkerDynamicsPeriod !== null &&
    biomarkerDynamicsPeriod.start > biomarkerDynamicsPeriod.end;

  function buildRequestBody() {
    return {
      title: title.trim(),
      report_type: reportType,
      detail_level: detailLevel,
      document_ids: selectedIds,
      abnormal_only: abnormalOnly,
      questions: parsedQuestions,
      report_date_range: reportDateRange,
      biomarker_dynamics_period: biomarkerDynamicsPeriod,
    };
  }

  async function submitReport() {
    if (!hasEligibleDocs) return;
    setSubmitting(true);
    setError(null);

    const body = buildRequestBody();

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(
          data.message ?? data.error ?? "Failed to create report",
        );
      }
      if (!data.id) {
        throw new Error("Report created but no id returned");
      }
      router.push(`/app/reports/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create report");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitReport();
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
          Educational clinician-ready summary across labs, imaging, and
          consultations — free
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
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
          <Select
            value={reportType}
            onValueChange={(v) => setReportType(v as ReportType)}
          >
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
          <Select
            value={detailLevel}
            onValueChange={(v) => setDetailLevel(v as DetailLevel)}
          >
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
            <p className="text-xs text-muted-foreground">
              {DETAIL_LEVEL_HINTS[detailLevel]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Selected records</label>
          <Button
            ref={selectionTriggerRef}
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
              Upload and process documents first.{" "}
              <Link
                href="/app/upload?type=lab_result"
                className="text-teal-700 hover:underline"
              >
                Upload records
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="questions" className="text-sm font-medium">
            Questions for your clinician
          </label>
          <Textarea
            id="questions"
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            rows={3}
            placeholder={
              "What should I discuss?\nWhen should I repeat this test?"
            }
            className="min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground">
            One question per line, up to five. Questions stay questions: the
            report never answers them.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Report date range</label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="Report range start"
              value={reportRangeStart}
              max={reportRangeEnd || undefined}
              onChange={(e) => setReportRangeStart(e.target.value)}
              className="w-full sm:w-40"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="Report range end"
              value={reportRangeEnd}
              min={reportRangeStart || undefined}
              onChange={(e) => setReportRangeEnd(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Only records dated inside this range are used. Leave empty to use
            every eligible record.
          </p>
          {reversedReportRange && (
            <p className="text-xs text-red-600">
              The start date must not be after the end date.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">How results changed</label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="Dynamics period start"
              value={dynamicsStart}
              max={dynamicsEnd || undefined}
              onChange={(e) => setDynamicsStart(e.target.value)}
              className="w-full sm:w-40"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="Dynamics period end"
              value={dynamicsEnd}
              min={dynamicsStart || undefined}
              onChange={(e) => setDynamicsEnd(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Optional. Compares repeated results from the selected records and
            shows numeric movement only, never a clinical conclusion.
          </p>
          {reversedDynamicsPeriod && (
            <p className="text-xs text-red-600">
              The start date must not be after the end date.
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={
            submitting ||
            !hasEligibleDocs ||
            reversedReportRange ||
            reversedDynamicsPeriod ||
            (selectedIds !== null && selectedIds.length === 0)
          }
          className="w-full"
        >
          {submitting ? "Generating…" : "Create report"}
        </Button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            selectionTriggerRef.current?.focus();
          }}
        >
          <div className="border-b p-4">
            <DialogTitle>Select documents for report</DialogTitle>
            <DialogDescription>
              Choose lab results, imaging studies, and consultation notes to
              include.
            </DialogDescription>
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
                      <p className="text-sm font-medium">
                        {doc.original_filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[
                          (normalizeDocumentType(doc.document_type) ??
                            "lab_result") as DocumentType
                        ] ?? doc.document_type}
                        {" · "}
                        {doc.lab_name ?? "Unknown provider"}
                        {doc.observed_at
                          ? ` · ${formatDocDate(doc.observed_at)}`
                          : ""}
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
                <span>
                  Include only out-of-range biomarkers (imaging and consultation
                  content is still included)
                </span>
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmModal}>
              Add selected ({modalSelection.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
