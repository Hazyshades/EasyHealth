import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SurfaceCard } from "@/components/ui/surface-card";

type MetricCardProps = {
  label: string;
  value?: React.ReactNode;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
  href?: string;
};

export function MetricCard({ label, value, icon: Icon, children, className, href }: MetricCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">{label}</p>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      {value != null && (
        <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-[var(--eh-text-primary)]">
          {value}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("block focus-visible:outline-none", className)}>
        <SurfaceCard padding="lg" hoverable className="h-full">
          {content}
        </SurfaceCard>
      </Link>
    );
  }

  return (
    <SurfaceCard padding="lg" className={cn("h-full", className)}>
      {content}
    </SurfaceCard>
  );
}
