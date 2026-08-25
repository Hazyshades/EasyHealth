import type { HealthProfileAssessmentDisplayState } from "@/lib/health-profile-assessment-state";
import type { HealthProfileResult } from "@/lib/health-systems";

export type DashboardWidgetData = {
  completedDocuments: number;
  healthProfile: HealthProfileResult | null;
  lastUpdated: string | null;
  assessmentState?: HealthProfileAssessmentDisplayState;
  assessmentError?: string | null;
};

export type DashboardWidgetProps = {
  data: DashboardWidgetData;
};
