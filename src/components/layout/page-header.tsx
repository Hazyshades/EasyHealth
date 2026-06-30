import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  compact?: boolean;
};

export function PageHeader({ title, subtitle, actions, compact = false }: PageHeaderProps) {
  if (!title && !subtitle && !actions) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        compact ? "mb-3" : "mb-6"
      )}
    >
      {title || subtitle ? (
        <div className="min-w-0">
          {title ? (
            <h2 className="text-2xl font-bold tracking-tight text-[var(--eh-text-primary)]">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className={cn("eh-page-subtitle", title && "mt-1")}>
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : (
        <div />
      )}
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
