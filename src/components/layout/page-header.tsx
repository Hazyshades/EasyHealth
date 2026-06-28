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
        <h1
          className={cn(
            "font-bold tracking-tight text-[var(--eh-text-primary)]",
            compact ? "text-xl md:text-2xl" : "text-2xl md:text-[1.75rem]"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              "max-w-2xl text-[var(--eh-text-secondary)]",
              compact ? "mt-1 text-sm" : "mt-1.5 text-sm md:text-[15px]"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
