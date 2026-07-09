"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BodyMap, BodyMapLegend } from "@/components/body-map";
import { PageHeader } from "@/components/layout/page-header";
import { FilterChip } from "@/components/ui/filter-chip";
import { Button } from "@/components/ui/button";
import { OverallAssessmentCard } from "@/components/overall-assessment-card";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { resolveBodyMapLayout } from "@/lib/health-systems";
import type { BodySystemId, HealthProfileResult } from "@/lib/health-systems";

export default function HealthProfilePage() {
  const [profile, setProfile] = useState<HealthProfileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChip, setActiveChip] = useState<BodySystemId | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const loadProfile = useCallback(() => {
    return fetch("/api/health-profile")
      .then((r) => r.json())
      .then(setProfile);
  }, []);

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
  }, [loadProfile]);

  async function handleRefreshSynthesis() {
    setRefreshError(null);
    setRefreshing(true);
    try {
      const res = await fetch("/api/health-profile/synthesis", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ?? "Refresh failed"
        );
      }
      await loadProfile();
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }



  if (loading) {

    return <p className="text-sm text-[var(--eh-text-secondary)]">Loading health profile…</p>;

  }



  const hasData =

    profile &&

    (profile.records_used_count > 0 ||

      profile.systems.length > 0 ||

      Boolean(profile.holistic_synthesis?.text));



  if (!hasData) {

    return (

      <div>

        <PageHeader

          subtitle="Educational overview based on your uploaded records"

          compact

        />

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">

          <h2 className="text-lg font-semibold text-[var(--eh-text-primary)]">No data yet</h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--eh-text-secondary)]">

            Upload lab results, imaging studies, or consultation notes to build your health profile.

          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">

            <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">

              <Link href="/app/upload?type=lab_result">Upload lab results</Link>

            </Button>

            <Button asChild variant="outline" className="rounded-xl">

              <Link href="/app/upload?type=instrumental_report">Upload imaging</Link>

            </Button>

          </div>

        </div>

        <p className="mt-6 text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>

      </div>

    );

  }



  const layouts = resolveBodyMapLayout(profile!.systems.map((s) => s.id));

  const lastUpdated = profile!.sources[0]?.observed_at ?? null;



  return (

    <div className="profile-page space-y-6 pb-8">

      <div>

        <PageHeader

          subtitle="Current state assessments and holistic synthesis from your records"

          compact

        />

      </div>



      {profile!.holistic_synthesis?.text ? (
        <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--eh-text-primary)]">Holistic synthesis</p>
            {profile!.synthesis_stale ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Update available
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
            {profile!.holistic_synthesis.text}
          </p>
          <p className="mt-3 text-xs text-[var(--eh-text-muted)]">
            {profile!.holistic_synthesis.disclaimer}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 rounded-xl"
            disabled={refreshing}
            onClick={() => handleRefreshSynthesis()}
          >
            {refreshing ? "Refreshing…" : "Refresh synthesis"}
          </Button>
          {refreshError ? (
            <p className="mt-2 text-sm text-red-600">{refreshError}</p>
          ) : null}
        </div>
      ) : profile!.records_used_count > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--eh-text-secondary)]">
            Holistic synthesis will appear after your documents finish processing.
          </p>
        </div>
      ) : null}



      {profile!.systems.length > 0 ? (

        <>

          <div className="flex flex-wrap gap-2">

            {profile!.systems.map((system) => {

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



          <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-[1fr_320px]">

            <div className="flex min-h-[600px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-[1100px]:min-h-[calc(100vh-260px)] min-[1100px]:max-h-[760px]">

              <BodyMap

                systems={profile!.systems}

                overallStateScore={profile!.overall_state_score}

                overallDataConfidence={profile!.overall_data_confidence}

                embedded

                externalSelectedId={activeChip}

                onExternalSelect={setActiveChip}

              />

            </div>



            <div className="space-y-5">

              <OverallAssessmentCard

                overallStateScore={profile!.overall_state_score}

                overallDataConfidence={profile!.overall_data_confidence}

                recordsUsedCount={profile!.records_used_count}

                lastUpdated={lastUpdated}

              />



              <BodyMapLegend />

              <p className="text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>

            </div>

          </div>

        </>

      ) : null}



      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <p className="text-sm font-semibold text-[var(--eh-text-primary)]">Source records</p>

        <ul className="mt-3 space-y-3">

          {profile!.sources.map((source) => (

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

    </div>

  );

}

