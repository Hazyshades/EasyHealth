"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";

type LabUnitSystem = "us" | "si";

export default function SettingsPage() {
  const [labUnitSystem, setLabUnitSystem] = useState<LabUnitSystem>("si");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.lab_unit_system === "us" || data.lab_unit_system === "si") {
          setLabUnitSystem(data.lab_unit_system);
        }
      })
      .catch(() => {
        /* keep default */
      });
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

  return (
    <div className="space-y-6 pb-8">
      <PageHeader subtitle="Manage your EasyHealth preferences" compact />

      <SurfaceCard className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">Lab units</p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            Choose how biomarker values are displayed. Stored lab results are never rewritten —
            only the on-screen presentation changes (US conventional vs SI).
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
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">AI Settings</p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            Choose whether EasyHealth uses ChatGPT, DeepSeek, or Tencent Hy3 for document
            extraction and reports.
          </p>
        </div>
        <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/settings/ai">Open AI Settings</Link>
        </Button>
      </SurfaceCard>
    </div>
  );
}
