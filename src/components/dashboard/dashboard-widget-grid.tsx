import type { ComponentType } from "react";
import { DEFAULT_WIDGET_ORDER, type WidgetId } from "@/lib/dashboard/widgets";
import type { DashboardWidgetProps } from "@/components/dashboard/types";
import { HealthAssessmentWidget } from "@/components/dashboard/widgets/health-assessment-widget";
import { UploadLabWidget } from "@/components/dashboard/widgets/upload-lab-widget";
import { HealthReportsWidget } from "@/components/dashboard/widgets/health-reports-widget";
import { MedicationsWidget } from "@/components/dashboard/widgets/medications-widget";
import { WaterBalanceWidget } from "@/components/dashboard/widgets/water-balance-widget";
import { WeightTrendWidget } from "@/components/dashboard/widgets/weight-trend-widget";

const WIDGET_COMPONENTS: Record<WidgetId, ComponentType<DashboardWidgetProps>> = {
  health_assessment: HealthAssessmentWidget,
  upload_lab: UploadLabWidget,
  health_reports: HealthReportsWidget,
  medications: MedicationsWidget,
  water_balance: WaterBalanceWidget,
  weight_trend: WeightTrendWidget,
};

type DashboardWidgetGridProps = {
  data: DashboardWidgetProps["data"];
  order?: WidgetId[];
};

export function DashboardWidgetGrid({ data, order = DEFAULT_WIDGET_ORDER }: DashboardWidgetGridProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {order.map((id) => {
        const Widget = WIDGET_COMPONENTS[id];
        return (
          <div key={id} className="min-h-[220px]">
            <Widget data={data} />
          </div>
        );
      })}
    </div>
  );
}
