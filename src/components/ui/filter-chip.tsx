import { cn } from "@/lib/utils";

type FilterChipProps = React.ComponentProps<"button"> & {
  active?: boolean;
};

export function FilterChip({ active, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2",
        active
          ? "border-[var(--eh-brand)] bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]"
          : "border-[var(--eh-border)] bg-white text-[var(--eh-text-secondary)] hover:border-slate-300 hover:bg-[#F8FAFC] hover:text-[var(--eh-text-primary)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
