import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardList,
  FileText,
  FlaskConical,
  LayoutDashboard,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only exact path (e.g. Dashboard at /app) */
  exact?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/profile", label: "Health Profile", icon: Activity },
  { href: "/app/biomarkers", label: "Biomarkers", icon: FlaskConical },
  { href: "/app/documents", label: "Documents", icon: FileText },
  { href: "/app/reports", label: "Reports", icon: ClipboardList },
];

export const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/app": {
    title: "Dashboard",
    subtitle: "Your personal health record at a glance",
  },
  "/app/profile": {
    title: "Health Profile",
    subtitle: "Current state assessments from your uploaded records",
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
    subtitle: "Educational reports for clinicians and specialists",
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
