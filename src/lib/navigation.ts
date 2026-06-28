import type { AppIcon } from "@/lib/icon-types";

export type AppNavItem = {
  href: string;
  label: string;
  icon: AppIcon;
  /** Match only exact path (e.g. Dashboard at /app) */
  exact?: boolean;
};

export const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/app": {
    title: "Dashboard",
    subtitle: "Your personal health record at a glance",
  },
  "/app/profile": {
    title: "Health Profile",
    subtitle: "Current state assessments and factual insights from your records",
  },
  "/app/biomarkers": {
    title: "Biomarkers",
    subtitle: "Values extracted from your lab documents",
  },
  "/app/documents": {
    title: "Documents",
    subtitle: "Upload and browse your medical records",
  },
  "/app/upload": {
    title: "Upload",
    subtitle: "Add a new document to your health record",
  },
  "/app/reports": {
    title: "Health reports",
    subtitle: "Customizable educational reports for clinicians and specialists",
  },
  "/app/reports/create": {
    title: "Create report",
    subtitle: "Generate a new health report from your records",
  },
};

export function resolvePageMeta(pathname: string): { title: string; subtitle?: string } {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]!;

  if (pathname.startsWith("/app/reports/") && pathname !== "/app/reports/create") {
    return { title: "Report detail", subtitle: "View your generated health report" };
  }

  return { title: "EasyHealth", subtitle: undefined };
}

export function isNavItemActive(pathname: string, item: AppNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
