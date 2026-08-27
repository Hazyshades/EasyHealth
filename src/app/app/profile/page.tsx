"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BodyMap, BodyMapLegend } from "@/components/body-map";
import { PageHeader } from "@/components/layout/page-header";
import { FilterChip } from "@/components/ui/filter-chip";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { OverallAssessmentCard } from "@/components/overall-assessment-card";
import { ExcludedObservationsPanel } from "@/components/score-provenance-panel";
import {
  assessmentDisplayStateDescription,
  assessmentDisplayStateLabel,
  resolveAssessmentDisplayState,
  type HealthProfileAssessmentDisplayState,
} from "@/lib/health-profile-assessment-state";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { buildHealthNavigationPath, readHealthNavigationContext } from "@/lib/health-navigation";
import { normalizeBodySystemId, resolveBodyMapLayout } from "@/lib/health-systems";
import type { BodySystemId, HealthProfileResult } from "@/lib/health-systems";
import type { HealthProfileReportedResults } from "@/lib/health-profile-reported-results";

type AssessmentStatus = {
  status: "queued" | "processing" | "retryable_failed" | "failed" | "succeeded";
  display_state?: HealthProfileAssessmentDisplayState;
  has_current_version?: boolean;
  version_id?: string | null;
  generated_at?: string | null;
  error_code?: string | null;
  error_message: string | null;
  fallback: boolean;
};

type HealthProfileResponse = HealthProfileResult & {
  reported_results: HealthProfileReportedResults;
  assessment?: AssessmentStatus;
};

export default function HealthProfilePage() {
  const [profile, setProfile] = useState<HealthProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChip, setActiveChip] = useState<BodySystemId | null>(null);
  const [requestedSystem, setRequestedSystem] = useState<string | null>(null);
  const [profileReturnTo, setProfileReturnTo] = useState<string | null>(null);
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncNavigationContext = () => {
      const context = readHealthNavigationContext(
        new URLSearchParams(window.location.search),
      );
      setRequestedSystem(context.system);
      setProfileReturnTo(context.returnTo);
    };

    syncNavigationContext();
    window.addEventListener("popstate", syncNavigationContext);
    return () => window.removeEventListener("popstate", syncNavigationContext);
  }, []);

  useEffect(() => {
    if (!profile || !requestedSystem) return;
    const normalized = normalizeBodySystemId(requestedSystem);
    setActiveChip(
      profile.systems.some((system) => system.id === normalized) ? normalized : null,
    );
  }, [profile, requestedSystem]);

  function handleSystemSelection(next: BodySystemId | null) {
    setActiveChip(next);
    if (typeof window === "undefined") return;
    const context = readHealthNavigationContext(
      new URLSearchParams(window.location.search),
    );
    window.history.replaceState(
      null,
      "",
      buildHealthNavigationPath("/app/profile", {
        system: next,
        returnTo: context.returnTo,
      }),
    );
  }

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

  async function handleRetryAssessment() {
    setRefreshError(null);
    try {
      const res = await fetch("/api/health-profile/recalculate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Retry failed");
      await loadProfile();
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "Retry failed");
    }
  }



  if (loading) {

    return <p className="text-sm text-[var(--eh-text-secondary)]">Loading health profile…</p>;

  }



  if (!profile || profile.profile_display_state === "onboarding") {

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
  const assessment = profile!.assessment;
  const hasCurrentVersion = assessment?.has_current_version ?? !assessment?.fallback;
  const assessmentState =
    assessment?.display_state ??
    resolveAssessmentDisplayState(assessment?.status, hasCurrentVersion);
  const assessmentDescription = assessmentDisplayStateDescription(assessmentState);
  const lastUpdated = profile.sources[0]?.observed_at ?? null;
  const reportedResults = profile.reported_results;
  const pendingReportedResults = Math.max(
    0,
    reportedResults.reported_count - reportedResults.ready_for_scoring_count,
  );



  return (

    <div className="profile-page space-y-6 pb-8">

      <div>

        <PageHeader

          subtitle="Current state assessments and holistic synthesis from your records"

          compact

        />

      </div>

      {assessmentState !== "current" ? (
        <div
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip variant={assessmentState === "error" ? "warning" : "info"}>
              {assessmentDisplayStateLabel(assessmentState)}
            </StatusChip>
          </div>
          <p className="mt-2">{assessmentDescription}</p>
          {assessment?.error_message ? (
            <p className="mt-2 text-slate-600">{assessment.error_message}</p>
          ) : null}
          {assessment?.status === "failed" || assessment?.status === "retryable_failed" ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => handleRetryAssessment()}
            >
              Retry update
            </Button>
          ) : null}
        </div>
      ) : null}

      {pendingReportedResults > 0 ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm"
          aria-live="polite"
          data-testid="health-profile-reported-results-notice"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-amber-950">
              {profile.profile_display_state === "reported_but_not_scoreable"
                ? "Report found, scoring not ready"
                : "Some reported results need review"}
            </h2>
            <Link
              href="/app/documents"
              className="text-sm font-medium text-amber-900 underline underline-offset-2"
            >
              Review results
            </Link>
          </div>
          <p className="mt-2 text-sm text-amber-900">
            Reported values are preserved, but excluded from scoring until they pass the existing
            safety and assessment eligibility checks.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-amber-950 sm:grid-cols-4">
            <div>
              <dt className="font-medium">Reported results</dt>
              <dd className="tabular-nums">{reportedResults.reported_count}</dd>
            </div>
            <div>
              <dt className="font-medium">Ready for scoring</dt>
              <dd className="tabular-nums">{reportedResults.ready_for_scoring_count}</dd>
            </div>
            <div>
              <dt className="font-medium">Need document details</dt>
              <dd className="tabular-nums">{reportedResults.needs_document_details_count}</dd>
            </div>
            <div>
              <dt className="font-medium">Await catalog review</dt>
              <dd className="tabular-nums">{reportedResults.awaiting_catalog_review_count}</dd>
            </div>
          </dl>
          {reportedResults.awaiting_verification_count > 0 ? (
            <p className="mt-2 text-xs text-amber-900">
              Awaiting verification: {reportedResults.awaiting_verification_count}
            </p>
          ) : null}
          <Button asChild variant="outline" className="mt-4 border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
            <Link href="/app/upload?type=lab_result">Upload a clearer report</Link>
          </Button>
        </div>
      ) : null}

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
                  title={
                    system.state_score == null
                      ? `${layout?.label ?? system.name}: insufficient data; select for readiness details`
                      : `${layout?.label ?? system.name}: ${system.state_score}/100 current state assessment`
                  }
                  aria-label={
                    system.state_score == null
                      ? `${layout?.label ?? system.name}: insufficient data; assessment unavailable`
                      : `${layout?.label ?? system.name}: ${system.state_score} of 100 current state assessment`
                  }
                  onClick={() => handleSystemSelection(activeChip === system.id ? null : system.id)}
                >
                  {layout?.label ?? system.name}: {system.state_score ?? "—"}
                </FilterChip>

              );

            })}

          </div>



          <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-[1fr_320px]">

            <div className="flex min-h-[460px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:min-h-[540px] min-[1100px]:min-h-[calc(100vh-260px)] min-[1100px]:max-h-[760px]">

              <BodyMap
                systems={profile!.systems}
                overallStateScore={profile!.overall_state_score}
                overallDataConfidence={profile!.overall_data_confidence}
                embedded
                externalSelectedId={activeChip}
                onExternalSelect={handleSystemSelection}
                navigationReturnTo={profileReturnTo}
                assessmentState={assessmentState}
                assessmentError={assessment?.error_message}
              />

            </div>



            <div className="space-y-5">

              <OverallAssessmentCard
                overallStateScore={profile!.overall_state_score}
                overallDataConfidence={profile!.overall_data_confidence}
                recordsUsedCount={profile!.records_used_count}
                scoreableNamedSystemCount={profile!.scoreable_named_system_count}
                scoreableNamedSystemTotal={profile!.scoreable_named_system_total}
                assessmentFreshness={profile!.assessment_freshness}
                dismissalKey={profile!.overall_assessment_dismissal_key}
                lastUpdated={lastUpdated}
                assessmentState={assessmentState}
                assessmentError={assessment?.error_message}
              />



              <BodyMapLegend />

              <p className="text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>

            </div>

          </div>

        </>

      ) : null}

      {profile!.profile_display_state === "no_recognized_biomarkers" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--eh-text-primary)]">
            No recognized lab markers yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--eh-text-secondary)]">
            Your uploaded records are available, but they did not yield recognized biomarker observations.
          </p>
          <Button asChild className="mt-6 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
            <Link href="/app/upload?type=lab_result">Upload lab results</Link>
          </Button>
        </div>
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

                {[source.lab_name, source.observed_at ?? "Date unavailable"].filter(Boolean).join(" · ")}

              </p>

            </li>

          ))}

        </ul>

      </div>

      <ExcludedObservationsPanel
        provenance={profile?.score_provenance}
        navigationReturnTo={profileReturnTo}
      />

    </div>

  );

}

