import Link from "next/link";
import { HandHeartIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { OverallAssessmentCard } from "@/components/overall-assessment-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import type { DashboardWidgetProps } from "@/components/dashboard/types";

function EmptyAssessmentCard() {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Health assessment</p>
        <DashboardCardIcon icon={HandHeartIcon} iconRef={iconRef} />
      </div>
      <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
        Upload lab records to see your health profile score.
      </p>
      <div className="mt-auto pt-6">
        <Button asChild className="w-full rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/upload">Upload your lab</Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}

export function HealthAssessmentWidget({ data }: DashboardWidgetProps) {
  const { healthProfile, lastUpdated } = data;

  if (!healthProfile) {
    return <EmptyAssessmentCard />;
  }

  return (
    <OverallAssessmentCard
      overallStateScore={healthProfile.overall_state_score}
      overallDataConfidence={healthProfile.overall_data_confidence}
      recordsUsedCount={healthProfile.records_used_count}
      scoreableNamedSystemCount={healthProfile.scoreable_named_system_count}
      scoreableNamedSystemTotal={healthProfile.scoreable_named_system_total}
      dismissible={false}
      lastUpdated={lastUpdated}
      variant="compact"
      showProfileLink
    />
  );
}
