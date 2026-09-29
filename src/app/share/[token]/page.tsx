"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ReportBody, type ReportContent } from "@/components/report-body";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PublicShareExportAction } from "@/lib/share-links/public-export-actions";

type PublicReport = Readonly<{
  title: string;
  report_type: string;
  detail_level: string;
  abnormal_only: boolean;
  content: ReportContent;
  summary_preview: string;
  created_at: string;
}>;

type PublicDocument = Readonly<{
  id: string;
  filename: string;
}>;

type PublicShareExportActions = readonly PublicShareExportAction[];

type PublicSharePayload = Readonly<{
  status: "structured";
  report: PublicReport;
  download_policy: "none" | "report" | "documents";
  documents: PublicDocument[];
  allowed_export_formats: string[];
  export_actions: PublicShareExportActions;
}>;

type ShareErrorPayload = Readonly<{ error?: string }>;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function genericError(status: number): string {
  if (status === 404 || status === 401) return "This share is unavailable.";
  if (status === 429) return "Too many attempts. Try again later.";
  return "This share is temporarily unavailable. Try again later.";
}

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => {
    const value = params.token;
    return Array.isArray(value) ? value[0] : value;
  }, [params.token]);
  const [payload, setPayload] = useState<PublicSharePayload | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingPin, setSubmittingPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const loadShare = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/share/${encodeURIComponent(token)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        let responseError: ShareErrorPayload = {};
        try {
          responseError = (await response.json()) as ShareErrorPayload;
        } catch {
          responseError = {};
        }
        if (response.status === 401 && responseError.error === "PIN required") {
          setNeedsPin(true);
          return;
        }
        setError(genericError(response.status));
        return;
      }
      const next = (await response.json()) as PublicSharePayload;
      setPayload(next);
      setNeedsPin(false);
    } catch {
      setError("This share is temporarily unavailable. Try again later.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadShare();
  }, [loadShare]);
  async function submitPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingPin(true);
    setPinError(null);
    try {
      const response = await fetch(
        `/api/share/${encodeURIComponent(token)}/pin`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        },
      );
      if (!response.ok) {
        setPinError(
          response.status === 401
            ? "The PIN did not work. Try again."
            : genericError(response.status),
        );
        return;
      }
      setPin("");
      await loadShare();
    } catch {
      setPinError("This share is unavailable.");
    } finally {
      setSubmittingPin(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--eh-canvas)] px-4 py-12 text-[var(--eh-text)]">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-[var(--eh-text-secondary)]">
            Loading shared report
          </p>
        </div>
      </main>
    );
  }

  if (needsPin) {
    return (
      <main className="min-h-screen bg-[var(--eh-canvas)] px-4 py-12 text-[var(--eh-text)]">
        <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="mt-0 text-balance text-2xl font-semibold tracking-tight">
            Enter the access PIN
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
            This report requires the PIN provided by the person who shared it.
          </p>
          <form className="mt-6 space-y-4" onSubmit={submitPin}>
            <div>
              <label className="text-sm font-medium" htmlFor="share-pin">
                Access PIN
              </label>
              <input
                id="share-pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none ring-indigo-600 focus:ring-2"
                required
                minLength={4}
                maxLength={64}
                aria-describedby={pinError ? "share-pin-error" : undefined}
              />
            </div>
            {pinError && (
              <p
                id="share-pin-error"
                className="text-sm text-red-700"
                role="alert"
              >
                {pinError}
              </p>
            )}
            <Button
              className="h-11 w-full"
              type="submit"
              disabled={submittingPin || pin.length < 4}
            >
              {submittingPin ? "Checking PIN" : "Open report"}
            </Button>
          </form>
        </section>
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main className="min-h-screen bg-[var(--eh-canvas)] px-4 py-12 text-[var(--eh-text)]">
        <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="mt-0 text-balance text-2xl font-semibold tracking-tight">
            This share is unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
            {error ?? "The report could not be loaded."}
          </p>
        </section>
      </main>
    );
  }

  const { report } = payload;
  return (
    <main className="min-h-screen bg-[var(--eh-canvas)] px-4 py-10 text-[var(--eh-text)] sm:px-6">
      <div
        className="mx-auto max-w-3xl space-y-7"
        data-public-share-export-actions={JSON.stringify(
          payload.export_actions,
        )}
      >
        <header className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="mt-0 text-balance text-3xl font-semibold tracking-tight">
            {report.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{report.report_type}</Badge>
            <Badge variant="outline">{report.detail_level}</Badge>
            {report.abnormal_only && (
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-800"
              >
                Out-of-range only
              </Badge>
            )}
            <span className="text-sm text-[var(--eh-text-secondary)]">
              {formatDate(report.created_at)}
            </span>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-[var(--eh-text-secondary)]">
            {report.summary_preview}
          </p>
        </header>
        <ReportBody content={report.content} />
        {payload.documents.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-balance text-xl font-semibold tracking-tight">
              Shared documents
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
              Original documents selected for this share.
            </p>
            <ul className="mt-5 space-y-3">
              {payload.documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 break-words text-sm font-medium text-[var(--eh-text)]">
                    {document.filename}
                  </span>
                  <a
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                    href={`/api/share/${encodeURIComponent(token)}/documents/${encodeURIComponent(document.id)}`}
                    download
                  >
                    Download document
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
