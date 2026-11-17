import type { AppIcon } from "@/lib/icon-types";
import { PageHeader } from "@/components/layout/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { SurfaceCard } from "@/components/ui/surface-card";

export function ClinicianPreviewPage({
  title,
  subtitle,
  icon,
  heading,
  description,
  emptyHeading,
  emptyDescription,
}: Readonly<{
  title: string;
  subtitle: string;
  icon: AppIcon;
  heading: string;
  description: string;
  emptyHeading: string;
  emptyDescription: string;
}>) {
  const Icon = icon;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <SurfaceCard className="flex min-h-[300px] flex-col justify-between p-6 sm:p-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
                <Icon size={26} className="text-current" aria-hidden />
              </span>
              <StatusChip variant="neutral">Coming soon</StatusChip>
            </div>
            <h2 className="mt-8 max-w-[22ch] text-2xl font-semibold tracking-[-0.02em] text-[var(--eh-text-primary)]">
              {heading}
            </h2>
            <p className="mt-3 max-w-[58ch] text-sm leading-6 text-[var(--eh-text-secondary)]">
              {description}
            </p>
          </div>

          <div className="mt-8 border-t border-[var(--eh-border)] pt-4">
            <p className="text-sm font-medium text-[var(--eh-text-primary)]">
              Clinician access is not enabled for this account.
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--eh-text-secondary)]">
              This preview does not read or change patient data.
            </p>
          </div>
        </SurfaceCard>

        <SurfaceCard className="min-h-[300px] p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
            Current state
          </p>
          <h2 className="mt-4 text-lg font-semibold text-[var(--eh-text-primary)]">
            {emptyHeading}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
            {emptyDescription}
          </p>
          <div className="mt-8 rounded-[10px] border border-dashed border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] p-4">
            <p className="text-sm font-medium text-[var(--eh-text-primary)]">
              No live workspace data
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--eh-text-secondary)]">
              The surface will remain empty until the access and processing
              contracts are enabled.
            </p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
