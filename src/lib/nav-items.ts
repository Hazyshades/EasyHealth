"use client";

import {
  BookIcon,
  ChartLineIcon,
  ClinicIcon,
  FileDescriptionIcon,
  HandHeartIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  MicrophoneIcon,
  ScanHeartIcon,
  SparklesIcon,
} from "@/components/icons";
import type { AppNavItem } from "@/lib/navigation";

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    href: "/app",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    exact: true,
    section: "health",
  },
  {
    href: "/app/profile",
    label: "Health Profile",
    icon: HandHeartIcon,
    section: "health",
  },
  {
    href: "/app/biomarkers",
    label: "Biomarkers",
    icon: SparklesIcon,
    section: "health",
  },
  {
    href: "/app/timeline",
    label: "Health Timeline",
    icon: ChartLineIcon,
    section: "health",
  },
  {
    href: "/app/assistant",
    label: "Ask about records",
    icon: ScanHeartIcon,
    section: "records",
  },
  {
    href: "/app/documents",
    label: "Documents",
    icon: FileDescriptionIcon,
    section: "records",
  },
  {
    href: "/app/reports",
    label: "Reports",
    icon: BookIcon,
    section: "records",
  },
  {
    href: "/app/knowledge",
    label: "Knowledge",
    icon: LibraryIcon,
    section: "learn",
  },
  {
    href: "/knowledge",
    label: "Knowledge Base",
    icon: LibraryIcon,
    section: "learn",
  },
  {
    href: "/app/clinic",
    label: "Clinic",
    icon: ClinicIcon,
    section: "clinicians",
    mobile: false,
  },
  {
    href: "/app/dictaphone",
    label: "Dictaphone",
    icon: MicrophoneIcon,
    section: "clinicians",
    mobile: false,
  },
];
