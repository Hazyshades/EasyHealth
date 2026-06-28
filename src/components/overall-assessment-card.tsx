"use client";

import Link from "next/link";
import { HandHeartIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

type OverallAssessmentCardProps = {
  overallStateScore: number;
  overallDataConfidence: number;
  recordsUsedCount: number;
  lastUpdated?: string | null;
  showProfileLink?: boolean;
  variant?: "compact" | "detailed";
};

function AssessmentStats({
  overallDataConfidence,
  recordsUsedCount,
  lastUpdated,
  compact,
}: {
  overallDataConfidence: number;
  recordsUsedCount: number;
  lastUpdated?: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-2",
        compact ? "mt-4 text-sm" : "mt-4 border-t border-[var(--eh-border-soft)] pt-4"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[var(--eh-text-secondary)]">Data confidence</span>
        {compact ? (
          <span className="font-medium text-[var(--eh-text-primary)]">{overallDataConfidence}%</span>
        ) : (
          <StatusChip variant="success">{overallDataConfidence}%</StatusChip>
        )}
      </div>
      {lastUpdated && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--eh-text-secondary)]">Last record</span>
          <span className="font-medium text-[var(--eh-text-primary)]">{lastUpdated}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[var(--eh-text-secondary)]">Records used</span>
        <span className="font-medium text-[var(--eh-text-primary)]">{recordsUsedCount}</span>
      </div>
    </div>
  );
}

export function OverallAssessmentCard({
  overallStateScore,
  overallDataConfidence,
  recordsUsedCount,
  lastUpdated,
  showProfileLink = false,
  variant = "detailed",
}: OverallAssessmentCardProps) {
  const isCompact = variant === "compact";
  const { iconRef, hoverProps } = useAnimatedIconHover();

  if (isCompact) {
    return (
      <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Overall assessment</p>
          <DashboardCardIcon icon={HandHeartIcon} iconRef={iconRef} />
        </div>
        <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-[var(--eh-text-primary)]">
          {overallStateScore}
        </p>
        <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">Current state assessment</p>
        <AssessmentStats
          overallDataConfidence={overallDataConfidence}
          recordsUsedCount={recordsUsedCount}
          lastUpdated={lastUpdated}
          compact
        />
        {showProfileLink && (
          <div className="mt-auto pt-6">
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-[var(--eh-border)] bg-white"
            >
              <Link href="/app/profile">View health profile</Link>
            </Button>
          </div>
        )}
      </SurfaceCard>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
        Overall assessment
      </p>
      <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight text-[var(--eh-text-primary)]">
        {overallStateScore}
      </p>
      <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">Current state assessment</p>
      <AssessmentStats
        overallDataConfidence={overallDataConfidence}
        recordsUsedCount={recordsUsedCount}
        lastUpdated={lastUpdated}
      />
      {showProfileLink && (
        <div className="mt-6">
          <Button asChild variant="outline" className="w-full rounded-xl border-[var(--eh-border)] bg-white">
            <Link href="/app/profile">View health profile</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
