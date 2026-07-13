"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HandHeartIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

type OverallAssessmentCardProps = {
  overallStateScore: number | null;
  overallDataConfidence: number;
  recordsUsedCount: number;
  scoreableNamedSystemCount: number;
  scoreableNamedSystemTotal: number;
  dismissalKey?: string;
  dismissible?: boolean;
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
  scoreableNamedSystemCount,
  scoreableNamedSystemTotal,
  dismissalKey,
  dismissible = true,
  lastUpdated,
  showProfileLink = false,
  variant = "detailed",
}: OverallAssessmentCardProps) {
  const isCompact = variant === "compact";
  const { iconRef, hoverProps } = useAnimatedIconHover();
  const storageKey = dismissalKey ? `easyhealth:overall-assessment:${dismissalKey}` : null;
  const canDismiss = dismissible && storageKey != null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!canDismiss || !storageKey) {
      setDismissed(false);
      return;
    }
    if (overallStateScore != null) {
      localStorage.removeItem(storageKey);
      setDismissed(false);
      return;
    }
    setDismissed(localStorage.getItem(storageKey) === "dismissed");
  }, [overallStateScore, storageKey]);

  if (overallStateScore == null) {
    if (canDismiss && dismissed) return null;
    return (
      <SurfaceCard padding="lg" className={cn("flex h-full flex-col", !isCompact && "shadow-sm")}>
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">
          Insufficient data for overall assessment
        </p>
        <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
          A numeric overall assessment appears after at least three named systems have complete lab evidence.
        </p>
        <p className="mt-4 text-sm font-medium text-[var(--eh-text-primary)]">
          Based on {scoreableNamedSystemCount} of {scoreableNamedSystemTotal} systems
        </p>
        {canDismiss ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-4 w-fit px-0 text-[var(--eh-text-secondary)]"
            onClick={() => {
              localStorage.setItem(storageKey, "dismissed");
              setDismissed(true);
            }}
          >
            Dismiss
          </Button>
        ) : null}
      </SurfaceCard>
    );
  }

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
        <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
          Based on {scoreableNamedSystemCount} of {scoreableNamedSystemTotal} systems
        </p>
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
      <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
        Based on {scoreableNamedSystemCount} of {scoreableNamedSystemTotal} systems
      </p>
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
