import { cn } from "@/lib/utils";

type PageHeaderProps = {
  subtitle?: string;
  actions?: React.ReactNode;
  compact?: boolean;
};

export function PageHeader({ subtitle, actions, compact = false }: PageHeaderProps) {
  if (!subtitle && !actions) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        compact ? "mb-3" : "mb-6"
      )}
    >
      {subtitle ? (
        <div className="min-w-0">
          <p className="eh-page-subtitle">
            {subtitle}
          </p>
        </div>
      ) : (
        <div />
      )}
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
