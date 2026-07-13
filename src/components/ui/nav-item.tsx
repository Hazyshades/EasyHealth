"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AppNavItem } from "@/lib/navigation";
import { useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";

type NavItemProps = {
  item: AppNavItem;
  active: boolean;
  /** Mobile bottom nav -icon only */
  compact?: boolean;
};

export function NavItem({ item, active, compact = false }: NavItemProps) {
  const Icon = item.icon;
  const { iconRef, hoverProps } = useAnimatedIconHover();

  if (compact) {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        title={item.label}
        {...hoverProps}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2",
          active
            ? "bg-[#4F46E5] text-white shadow-[0_10px_22px_rgba(79,70,229,0.24)]"
            : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
        )}
      >
        <Icon ref={iconRef} size={20} className={cn("shrink-0", active ? "text-white" : "text-current")} aria-hidden />
        <span className="sr-only">{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      {...hoverProps}
      className={cn(
        "flex h-11 items-center gap-2.5 rounded-[14px] px-3 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2",
        "max-[1099px]:justify-center max-[1099px]:px-0",
        "min-[1100px]:justify-start",
        active
          ? "bg-[#4F46E5] text-white shadow-[0_10px_22px_rgba(79,70,229,0.24)]"
          : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
      )}
    >
      <Icon
        ref={iconRef}
        size={20}
        className={cn("shrink-0", active ? "text-white" : "text-[#64748B]")}
        aria-hidden
      />
      <span
        className={cn(
          "text-sm font-medium leading-none max-[1099px]:sr-only",
          active ? "text-white" : "text-inherit"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
