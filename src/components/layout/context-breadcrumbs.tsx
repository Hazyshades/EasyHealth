import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ContextBreadcrumb = {
  href?: string;
  label: string;
};

export function ContextBreadcrumbs({
  items,
  className,
}: {
  items: ContextBreadcrumb[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-3", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-[var(--eh-text-muted)]">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
              {current || !item.href ? (
                <span aria-current={current ? "page" : undefined}>{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-sm transition-colors hover:text-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
