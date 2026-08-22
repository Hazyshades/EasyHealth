"use client";

import {
  BookIcon,
  FileDescriptionIcon,
  HandHeartIcon,
  LayoutDashboardIcon,
  SparklesIcon,
  ChartLineIcon,
} from "@/components/icons";
import type { AppNavItem } from "@/lib/navigation";

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/app/profile", label: "Health Profile", icon: HandHeartIcon },
  { href: "/app/biomarkers", label: "Biomarkers", icon: SparklesIcon },
  { href: "/app/documents", label: "Documents", icon: FileDescriptionIcon },
  { href: "/app/timeline", label: "Timeline", icon: ChartLineIcon },
  { href: "/app/reports", label: "Reports", icon: BookIcon },
];
