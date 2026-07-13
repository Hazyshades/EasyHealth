import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchInputProps = React.ComponentProps<"input"> & {
  containerClassName?: string;
};

export function SearchInput({ className, containerClassName, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-xs", containerClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--eh-text-muted)]"
        aria-hidden
      />
      <input
        type="search"
        className={cn(
          "h-10 w-full rounded-xl border border-[var(--eh-border)] bg-white pl-9 pr-3 text-sm text-[var(--eh-text-primary)] shadow-xs transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--eh-text-muted)] focus-visible:border-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/20",
          className
        )}
        {...props}
      />
    </div>
  );
}
