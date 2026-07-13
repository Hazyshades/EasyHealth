"use client";

import Link from "next/link";
import type { AppIcon } from "@/lib/icon-types";
import { cn } from "@/lib/utils";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { SurfaceCard } from "@/components/ui/surface-card";

type MetricCardProps = {
  label: string;
  value?: React.ReactNode;
  icon?: AppIcon;
  children?: React.ReactNode;
  className?: string;
  href?: string;
};

export function MetricCard({ label, value, icon: Icon, children, className, href }: MetricCardProps) {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">{label}</p>
        {Icon && <DashboardCardIcon icon={Icon} iconRef={iconRef} />}
      </div>
      {value != null && (
        <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-[var(--eh-text-primary)]">
          {value}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("block focus-visible:outline-none", className)}>
        <SurfaceCard padding="lg" hoverable className="h-full" {...hoverProps}>
          {content}
        </SurfaceCard>
      </Link>
    );
  }

  return (
    <SurfaceCard padding="lg" className={cn("h-full", className)} {...hoverProps}>
      {content}
    </SurfaceCard>
  );
}
