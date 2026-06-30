"use client";

import { ChartLineIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";

import type { DashboardWidgetProps } from "@/components/dashboard/types";

export function WeightTrendWidget(_props: DashboardWidgetProps) {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Weight trend</p>
          <span className="mt-1 inline-block rounded-full bg-[var(--eh-brand-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--eh-brand)]">
            Coming soon
          </span>
        </div>
        <DashboardCardIcon icon={ChartLineIcon} iconRef={iconRef} />
      </div>
      <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">Add weight</p>
      <div className="mt-auto pt-6">
        <Button
          type="button"
          disabled
          variant="outline"
          className="w-full rounded-xl border-[var(--eh-border)] bg-white"
        >
          Log weight -coming soon
        </Button>
      </div>
    </SurfaceCard>
  );
}
