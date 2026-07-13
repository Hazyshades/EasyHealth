"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanHeartIcon } from "@/components/icons";
import { useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { APP_NAV_ITEMS } from "@/lib/nav-items";
import { isNavItemActive } from "@/lib/navigation";
import { NavItem } from "@/components/ui/nav-item";

function EasyHealthLogo() {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  return (
    <Link
      href="/app"
      {...hoverProps}
      className="mb-5 flex items-center gap-2.5 rounded-xl px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2 max-[1099px]:justify-center max-[1099px]:px-0"
      aria-label="EasyHealth home"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
        <ScanHeartIcon ref={iconRef} size={20} className="text-[var(--eh-brand)]" aria-hidden />
      </span>
      <span className="text-base font-semibold text-[#0F172A] min-[1100px]:inline max-[1099px]:hidden">
        EasyHealth
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar hidden h-full flex-col border-r border-[#E8EEF5] bg-white px-3.5 pt-4 pb-5 md:flex">
      <EasyHealthLogo />
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
        {APP_NAV_ITEMS.map((item) => (
          <NavItem key={item.href} item={item} active={isNavItemActive(pathname, item)} />
        ))}
      </nav>
    </aside>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#E8EEF5] bg-white/95 px-2 py-2 backdrop-blur-md md:hidden"
    >
      {APP_NAV_ITEMS.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          active={isNavItemActive(pathname, item)}
          compact
        />
      ))}
    </nav>
  );
}
