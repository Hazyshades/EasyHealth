"use client";

import {
  BookIcon,
  ChartLineIcon,
  FileDescriptionIcon,
  HandHeartIcon,
  LayoutDashboardIcon,
  ScanHeartIcon,
  SparklesIcon,
} from "@/components/icons";
import type { AppNavItem } from "@/lib/navigation";

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/app/profile", label: "Health Profile", icon: HandHeartIcon },
  { href: "/app/biomarkers", label: "Biomarkers", icon: SparklesIcon },
  { href: "/app/documents", label: "Documents", icon: FileDescriptionIcon },
  { href: "/app/reports", label: "Reports", icon: BookIcon },
  { href: "/app/agent-demo", label: "Agent API demo", icon: ScanHeartIcon },
  { href: "/app/agent-traction", label: "Agent traction", icon: ChartLineIcon },
];
