"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BodyMap, BodyMapLegend } from "@/components/body-map";
import { PageHeader } from "@/components/layout/page-header";
import { FilterChip } from "@/components/ui/filter-chip";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { resolveBodyMapLayout } from "@/lib/health-systems";
import type { BodySystemId, HealthProfileResult } from "@/lib/health-systems";

export default function HealthProfilePage() {
  const [profile, setProfile] = useState<HealthProfileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChip, setActiveChip] = useState<BodySystemId | null>(null);

  useEffect(() => {
    fetch("/api/health-profile")
      .then((r) => r.json())
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-[var(--eh-text-secondary)]">Loading health profile…</p>;
  }

  if (!profile || profile.records_used_count === 0) {
    return (
      <div>
        <PageHeader
          title="Health Profile"
          subtitle="Educational overview based on your uploaded records"
          compact
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--eh-text-primary)]">No data yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--eh-text-secondary)]">
            Upload lab results to see current state assessments across body systems.
          </p>
          <Button asChild className="mt-6 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
            <Link href="/app/upload?type=lab">Upload your lab</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>
      </div>
    );
  }

  const layouts = resolveBodyMapLayout(profile.systems.map((s) => s.id));
  const lastUpdated = profile.sources[0]?.observed_at ?? null;

  return (
    <div className="profile-page flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <PageHeader
          title="Health Profile"
          subtitle="Current state assessments and factual insights from your records"
          compact
        />
      </div>

      <div className="mb-5 flex shrink-0 flex-wrap gap-2">
        {profile.systems.map((system) => {
          const layout = layouts.get(system.id);
          return (
            <FilterChip
              key={system.id}
              active={activeChip === system.id}
              onClick={() => setActiveChip((prev) => (prev === system.id ? null : system.id))}
            >
              {layout?.label ?? system.name}: {system.state_score}
            </FilterChip>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 min-[1100px]:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-[1099px]:h-[560px] min-[1100px]:h-[calc(100vh-260px)] min-[1100px]:min-h-[560px] min-[1100px]:max-h-[720px]">
          <BodyMap
            systems={profile.systems}
            overallStateScore={profile.overall_state_score}
            overallDataConfidence={profile.overall_data_confidence}
            embedded
            externalSelectedId={activeChip}
            onExternalSelect={setActiveChip}
          />
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto min-[1100px]:max-h-[calc(100vh-260px)] min-[1100px]:min-h-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
              Overall assessment
            </p>
            <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight text-[var(--eh-text-primary)]">
              {profile.overall_state_score}
            </p>
            <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">Current state assessment</p>
            <div className="mt-4 space-y-2 border-t border-[var(--eh-border-soft)] pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--eh-text-secondary)]">Data confidence</span>
                <StatusChip variant="success">{profile.overall_data_confidence}%</StatusChip>
              </div>
              {lastUpdated && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--eh-text-secondary)]">Last record</span>
                  <span className="font-medium text-[var(--eh-text-primary)]">{lastUpdated}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--eh-text-secondary)]">Records used</span>
                <span className="font-medium text-[var(--eh-text-primary)]">
                  {profile.records_used_count}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--eh-text-primary)]">Source records</p>
            <ul className="mt-3 space-y-3">
              {profile.sources.map((source) => (
                <li
                  key={source.id}
                  className="border-b border-[var(--eh-border-soft)] pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-[var(--eh-text-primary)]">
                    {source.original_filename}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--eh-text-muted)]">
                    {[source.lab_name, source.observed_at].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <BodyMapLegend />
          <p className="text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>
        </div>
      </div>
    </div>
  );
}
