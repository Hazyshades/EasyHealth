"use client";

import Link from "next/link";
import { UploadIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import type { DashboardWidgetProps } from "@/components/dashboard/types";

export function UploadLabWidget({ data }: DashboardWidgetProps) {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Upload lab</p>
        <DashboardCardIcon icon={UploadIcon} iconRef={iconRef} />
      </div>
      <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
        {data.completedDocuments > 0
          ? `${data.completedDocuments} completed record${data.completedDocuments === 1 ? "" : "s"}. Add another lab.`
          : "Upload your first lab to extract biomarkers automatically."}
      </p>
      <div className="mt-auto pt-6">
        <Button asChild className="w-full rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/upload">Upload lab results</Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}
