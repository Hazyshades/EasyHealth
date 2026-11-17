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
  { href: "/app", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/app/profile", label: "Health Profile", icon: HandHeartIcon },
  { href: "/app/assistant", label: "Ask about records", icon: ScanHeartIcon },
  { href: "/app/timeline", label: "Health Timeline", icon: ChartLineIcon },
  { href: "/app/biomarkers", label: "Biomarkers", icon: SparklesIcon },
  { href: "/app/knowledge", label: "Knowledge", icon: LibraryIcon },
  { href: "/app/documents", label: "Documents", icon: FileDescriptionIcon },
  { href: "/app/reports", label: "Reports", icon: BookIcon },
  { href: "/knowledge", label: "Knowledge Base", icon: LibraryIcon },
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
