import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  compact?: boolean;
};

export function PageHeader({ title, subtitle, actions, compact = false }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        compact ? "mb-3" : "mb-6"
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--eh-text-primary)]">{title}</h1>
        {subtitle ? <p className="mt-1 eh-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
