"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type LabUnitSystem = "us" | "si";
type ReviewMode = "easy" | "pro";

export default function SettingsPage() {
  const [labUnitSystem, setLabUnitSystem] = useState<LabUnitSystem>("si");
  const [reviewModeDefault, setReviewModeDefault] =
    useState<ReviewMode>("pro");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReviewMode, setSavingReviewMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewModeMessage, setReviewModeMessage] = useState<string | null>(
    null,
  );
  const [reviewModeError, setReviewModeError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.lab_unit_system === "us" || data.lab_unit_system === "si") {
          setLabUnitSystem(data.lab_unit_system);
        }
        if (
          data.review_mode_default === "easy" ||
          data.review_mode_default === "pro"
        ) {
          setReviewModeDefault(data.review_mode_default);
        }
      })
      .catch(() => {
        /* keep default */
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveLabUnits(next: LabUnitSystem) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lab_unit_system: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setLabUnitSystem(data.lab_unit_system ?? next);
      setMessage("Lab units preference saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }
  async function saveReviewModeDefault(next: ReviewMode) {
    setSavingReviewMode(true);
    setReviewModeError(null);
    setReviewModeMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_mode_default: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setReviewModeDefault(data.review_mode_default ?? next);
      setReviewModeMessage("Default review mode saved.");
    } catch (e) {
      setReviewModeError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingReviewMode(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          title="Settings"
          subtitle="Manage your EasyHealth preferences"
          compact
        />
        <SurfaceCard className="space-y-4 p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-40" />
        </SurfaceCard>
        <SurfaceCard className="space-y-4 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-48" />
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Settings"
        subtitle="Manage your EasyHealth preferences"
        compact
      />

      <SurfaceCard className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
            Lab units
          </p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            Choose how biomarker values are displayed. Stored lab results are
            never rewritten; only the on-screen presentation changes (US
            conventional vs SI).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={saving}
            variant={labUnitSystem === "si" ? "default" : "outline"}
            className={
              labUnitSystem === "si"
                ? "rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
                : "rounded-xl"
            }
            onClick={() => saveLabUnits("si")}
          >
            SI (EU / international)
          </Button>
          <Button
            type="button"
            disabled={saving}
            variant={labUnitSystem === "us" ? "default" : "outline"}
            className={
              labUnitSystem === "us"
                ? "rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
                : "rounded-xl"
            }
            onClick={() => saveLabUnits("us")}
          >
            US conventional
          </Button>
        </div>
        <p className="text-xs text-[var(--eh-text-secondary)]">
          Current:{" "}
          <span className="font-medium text-[var(--eh-text-primary)]">
            {labUnitSystem === "us" ? "US (mg/dL, …)" : "SI (mmol/L, …)"}
          </span>
        </p>
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </SurfaceCard>
      <SurfaceCard className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
            Default review mode
          </p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            New laboratory uploads start in this mode. Existing Documents keep
            their current mode.
          </p>
        </div>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="group"
          aria-label="Default laboratory review mode"
        >
          <Button
            type="button"
            disabled={savingReviewMode}
            aria-pressed={reviewModeDefault === "easy"}
            variant={reviewModeDefault === "easy" ? "default" : "outline"}
            className="h-auto min-h-12 justify-between gap-3 rounded-xl px-4 py-3 text-left"
            onClick={() => saveReviewModeDefault("easy")}
          >
            <span className="min-w-0">
              <span className="block font-semibold">Easy</span>
              <span className="mt-0.5 block whitespace-normal text-xs font-normal opacity-80">
                Read extracted evidence, then accept or reject.
              </span>
            </span>
            {reviewModeDefault === "easy" && (
              <span className="shrink-0 text-xs font-semibold">Selected</span>
            )}
          </Button>
          <Button
            type="button"
            disabled={savingReviewMode}
            aria-pressed={reviewModeDefault === "pro"}
            variant={reviewModeDefault === "pro" ? "default" : "outline"}
            className="h-auto min-h-12 justify-between gap-3 rounded-xl px-4 py-3 text-left"
            onClick={() => saveReviewModeDefault("pro")}
          >
            <span className="min-w-0">
              <span className="block font-semibold">Pro</span>
              <span className="mt-0.5 block whitespace-normal text-xs font-normal opacity-80">
                Review mappings, correct values, and verify in detail.
              </span>
            </span>
            {reviewModeDefault === "pro" && (
              <span className="shrink-0 text-xs font-semibold">Selected</span>
            )}
          </Button>
        </div>
        <p
          className="text-sm text-emerald-700"
          role="status"
          aria-live="polite"
        >
          {reviewModeMessage}
        </p>
        {reviewModeError && (
          <p className="text-sm text-red-600" role="alert">
            {reviewModeError}
          </p>
        )}
      </SurfaceCard>

      <SurfaceCard className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
            AI Settings
          </p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            Choose whether EasyHealth uses ChatGPT, DeepSeek, or Tencent Hy3 for
            document extraction and reports.
          </p>
        </div>
        <Button
          asChild
          className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
        >
          <Link href="/app/settings/ai">Open AI Settings</Link>
        </Button>
      </SurfaceCard>
    </div>
  );
}
