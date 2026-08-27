import Link from "next/link";
import { HandHeartIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { OverallAssessmentCard } from "@/components/overall-assessment-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import type { DashboardWidgetProps } from "@/components/dashboard/types";

function EmptyAssessmentCard({
  assessmentState,
  assessmentError,
  processingDocuments,
}: {
  assessmentState?: DashboardWidgetProps["data"]["assessmentState"];
  assessmentError?: string | null;
  processingDocuments: boolean;
}) {
  const { iconRef, hoverProps } = useAnimatedIconHover();
  const isUpdating =
    processingDocuments || assessmentState === "processing" || assessmentState === "outdated";
  const isError = assessmentState === "error";

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Health assessment</p>
        <DashboardCardIcon icon={HandHeartIcon} iconRef={iconRef} />
      </div>
      {isUpdating || isError ? (
        <>
          <p className="mt-3 text-sm font-medium text-[var(--eh-text-primary)]">
            {isError ? "Health assessment could not be updated" : "Health assessment is processing"}
          </p>
          <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
            {isError
              ? assessmentError ?? "Try again from your health profile."
              : "Your document is being prepared before a current score can be shown."}
          </p>
          <div className="mt-auto pt-6">
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link href="/app/profile">Open health profile</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
            Upload lab records to see your health profile score.
          </p>
          <div className="mt-auto pt-6">
            <Button asChild className="w-full rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
              <Link href="/app/upload?type=lab_result">Upload lab results</Link>
            </Button>
          </div>
        </>
      )}
    </SurfaceCard>
  );
}

function NoRecognizedAssessmentCard() {
  const { iconRef, hoverProps } = useAnimatedIconHover();
  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Health assessment</p>
        <DashboardCardIcon icon={HandHeartIcon} iconRef={iconRef} />
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--eh-text-primary)]">
        No recognized lab results yet
      </p>
      <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
        Your processed records are available, but they did not yield recognized biomarker observations.
      </p>
      <div className="mt-auto flex gap-2 pt-6">
        <Button asChild variant="outline" className="flex-1 rounded-xl">
          <Link href="/app/documents">Review records</Link>
        </Button>
        <Button asChild className="flex-1 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/upload?type=lab_result">Upload lab results</Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}

function ReportedOnlyAssessmentCard({ healthProfile }: { healthProfile: NonNullable<DashboardWidgetProps["data"]["healthProfile"]> }) {
  const { iconRef, hoverProps } = useAnimatedIconHover();
  const { reported_results: reportedResults } = healthProfile;
  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col border-amber-200 bg-amber-50/70" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-amber-900">Health assessment</p>
        <DashboardCardIcon icon={HandHeartIcon} iconRef={iconRef} />
      </div>
      <p className="mt-3 text-sm font-semibold text-amber-950">Report found, scoring not ready</p>
      <p className="mt-2 text-sm text-amber-900">
        Reported values are preserved, but excluded from scoring until they pass the existing safety and assessment eligibility checks.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-amber-950">
        <div><dt>Reported results</dt><dd className="font-medium tabular-nums">{reportedResults.reported_count}</dd></div>
        <div><dt>Ready for scoring</dt><dd className="font-medium tabular-nums">{reportedResults.ready_for_scoring_count}</dd></div>
        <div><dt>Need document details</dt><dd className="font-medium tabular-nums">{reportedResults.needs_document_details_count}</dd></div>
        <div><dt>Await catalog review</dt><dd className="font-medium tabular-nums">{reportedResults.awaiting_catalog_review_count}</dd></div>
      </dl>
      <div className="mt-auto flex gap-2 pt-6">
        <Button asChild variant="outline" className="flex-1 rounded-xl border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
          <Link href="/app/documents">Review results</Link>
        </Button>
        <Button asChild className="flex-1 rounded-xl bg-amber-900 text-white hover:bg-amber-800">
          <Link href="/app/upload?type=lab_result">Upload a clearer report</Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}

export function HealthAssessmentWidget({ data }: DashboardWidgetProps) {
  const { healthProfile, lastUpdated, assessmentState, assessmentError, processingDocuments } = data;

  if (!healthProfile) {
    return (
      <EmptyAssessmentCard
        assessmentState={assessmentState}
        assessmentError={assessmentError}
        processingDocuments={processingDocuments}
      />
    );
  }

  if (healthProfile.profile_display_state === "no_recognized_biomarkers") {
    return <NoRecognizedAssessmentCard />;
  }

  if (healthProfile.profile_display_state === "reported_but_not_scoreable") {
    return <ReportedOnlyAssessmentCard healthProfile={healthProfile} />;
  }

  const pendingReportedResults = Math.max(
    0,
    healthProfile.reported_results.reported_count -
      healthProfile.reported_results.ready_for_scoring_count,
  );

  return (
    <div className="space-y-3">
      <OverallAssessmentCard
        overallStateScore={healthProfile.overall_state_score}
        overallDataConfidence={healthProfile.overall_data_confidence}
        recordsUsedCount={healthProfile.records_used_count}
        scoreableNamedSystemCount={healthProfile.scoreable_named_system_count}
        scoreableNamedSystemTotal={healthProfile.scoreable_named_system_total}
        assessmentFreshness={healthProfile.assessment_freshness}
        dismissible={false}
        lastUpdated={lastUpdated}
        variant="compact"
        showProfileLink
        assessmentState={assessmentState}
        assessmentError={assessmentError}
      />
      {pendingReportedResults > 0 ? (
        <SurfaceCard padding="md" className="border-amber-200 bg-amber-50/70">
          <p className="text-sm font-medium text-amber-950">
            Some reported results need review
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-amber-900">
            <div>
              <dt>Reported results</dt>
              <dd className="font-medium tabular-nums">{healthProfile.reported_results.reported_count}</dd>
            </div>
            <div>
              <dt>Ready for scoring</dt>
              <dd className="font-medium tabular-nums">{healthProfile.reported_results.ready_for_scoring_count}</dd>
            </div>
          </dl>
          <Button asChild variant="link" className="mt-2 h-auto p-0 text-amber-900">
            <Link href="/app/documents">Review results</Link>
          </Button>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
