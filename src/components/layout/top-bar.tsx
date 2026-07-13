"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { resolvePageMeta } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function TopBar() {
  const pathname = usePathname();
  const { profileId, displayName, lastName, accountEmail, signOut } = useAuth();
  const meta = resolvePageMeta(pathname);

  return (
    <header className="topbar flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#E8EEF5] bg-white px-10">
      <div className="min-w-0">
        <h1 className="eh-page-title truncate">{meta.title}</h1>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {profileId ? (
          <UserMenu displayName={displayName} lastName={lastName} email={accountEmail} />
        ) : null}

        <Button
          variant="outline"
          size="sm"
          onClick={() => void signOut()}
          className={cn(
            "rounded-xl border-[var(--eh-border)] text-[var(--eh-text-secondary)] shadow-xs",
            "transition-transform duration-150 ease-out active:scale-[0.97]"
          )}
        >
          <LogOut className="size-3.5 sm:mr-1.5" aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
