"use client";

import { DropletsIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";

import type { DashboardWidgetProps } from "@/components/dashboard/types";

const DAILY_GOAL_ML = 2000;

export function WaterBalanceWidget(_props: DashboardWidgetProps) {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Water balance</p>
          <span className="mt-1 inline-block rounded-full bg-[var(--eh-brand-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--eh-brand)]">
            Coming soon
          </span>
        </div>
        <DashboardCardIcon icon={DropletsIcon} iconRef={iconRef} />
      </div>
      <p className="mt-4 text-2xl font-semibold text-[var(--eh-text-primary)]">
        0 ml
        <span className="ml-2 text-sm font-normal text-[var(--eh-text-secondary)]">
          of {(DAILY_GOAL_ML / 1000).toFixed(1)} L
        </span>
      </p>
      <div className="mt-auto pt-6">
        <Button
          type="button"
          disabled
          variant="outline"
          className="w-full rounded-xl border-[var(--eh-border)] bg-white"
        >
          Log water -coming soon
        </Button>
      </div>
    </SurfaceCard>
  );
}
