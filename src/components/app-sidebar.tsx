"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "MY HEALTH",
    items: [
      { href: "/app", label: "Dashboard" },
      { href: "/app/profile", label: "Health Profile" },
      { href: "/app/biomarkers", label: "Biomarkers" },
    ],
  },
  {
    title: "MY DATA",
    items: [{ href: "/app/documents", label: "Documents" }],
  },
  {
    title: "REPORTS",
    items: [{ href: "/app/summary", label: "Doctor summary" }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-white md:block">
      <nav className="flex flex-col gap-6 p-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.href === "/app"
                    ? pathname === "/app"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-teal-50 font-medium text-teal-800"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
