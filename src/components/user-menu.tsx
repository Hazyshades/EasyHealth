"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { menuDisplayInitial, menuDisplayLabel } from "@/lib/display-name";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  displayName?: string | null;
  email?: string | null;
};

const MENU_ITEMS = [
  { href: "/app/account", label: "Account" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/settings/ai", label: "AI Settings" },
] as const;

export function UserMenu({ displayName, email }: UserMenuProps) {
  const label = menuDisplayLabel(displayName, email);
  const initial = menuDisplayInitial(displayName, email);
  const isEmailLabel = !displayName?.trim() && Boolean(email?.trim());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex max-w-[min(100%,14rem)] items-center gap-2 rounded-xl border border-[var(--eh-border)] bg-white px-2.5 py-1.5",
          "text-left shadow-xs transition-[background-color,transform,box-shadow] duration-150 ease-out",
          "hover:bg-[var(--eh-canvas-bg)] active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/30"
        )}
        aria-label={`Account menu for ${label}`}
      >
       
        <span
          className={cn(
            "hidden truncate text-[var(--eh-text-primary)] sm:inline",
            isEmailLabel ? "text-xs font-medium" : "text-sm font-semibold"
          )}
        >
          {label}
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--eh-text-muted)]" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {MENU_ITEMS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
