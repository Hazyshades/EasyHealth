import Link from "next/link";
import { BookIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";

import type { DashboardWidgetProps } from "@/components/dashboard/types";

export function HealthReportsWidget(_props: DashboardWidgetProps) {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Health reports</p>
        <DashboardCardIcon icon={BookIcon} iconRef={iconRef} />
      </div>
      <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
        Generate educational health reports from your uploaded lab records.
      </p>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/reports/create">Generate report</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl border-[var(--eh-border)] bg-white">
          <Link href="/app/reports">View report history</Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}
