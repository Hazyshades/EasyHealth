import { AlertCircle, Check, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusChipVariant = "default" | "success" | "warning" | "error" | "info" | "neutral";

const variantStyles: Record<StatusChipVariant, string> = {
  default: "border-[var(--eh-border)] bg-white text-[var(--eh-text-secondary)]",
  success: "border-emerald-200 bg-[var(--eh-chip-green-bg)] text-[var(--eh-chip-green-text)]",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-[var(--eh-border-soft)] bg-[var(--eh-canvas-bg)] text-[var(--eh-text-secondary)]",
};

const variantIcons: Partial<Record<StatusChipVariant, LucideIcon>> = {
  success: Check,
  warning: AlertCircle,
  error: AlertCircle,
  info: Info,
};

type StatusChipProps = React.ComponentProps<"span"> & {
  variant?: StatusChipVariant;
};

export function StatusChip({ variant = "default", className, children, ...props }: StatusChipProps) {
  const Icon = variantIcons[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.25} />}
      {children}
    </span>
  );
}
