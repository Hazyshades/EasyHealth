import type { HealthProfileResult } from "@/lib/health-systems";

export type DashboardWidgetData = {
  completedDocuments: number;
  healthProfile: HealthProfileResult | null;
  lastUpdated: string | null;
};

export type DashboardWidgetProps = {
  data: DashboardWidgetData;
};
