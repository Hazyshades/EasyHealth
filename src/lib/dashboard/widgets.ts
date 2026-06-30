export type WidgetId =
  | "health_assessment"
  | "upload_lab"
  | "health_reports"
  | "medications"
  | "water_balance"
  | "weight_trend";

export type WidgetStatus = "live" | "coming_soon";

export type WidgetDefinition = {
  id: WidgetId;
  title: string;
  description: string;
  status: WidgetStatus;
  sortOrder: number;
};

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  "health_assessment",
  "upload_lab",
  "health_reports",
  "medications",
  "water_balance",
  "weight_trend",
];

export const DASHBOARD_WIDGETS: WidgetDefinition[] = [
  {
    id: "health_assessment",
    title: "Health assessment",
    description: "Upload your lab records and get a health profile score.",
    status: "live",
    sortOrder: 1,
  },
  {
    id: "upload_lab",
    title: "Upload lab",
    description: "Upload a lab PDF or image to extract biomarkers.",
    status: "live",
    sortOrder: 2,
  },
  {
    id: "health_reports",
    title: "Health reports",
    description: "Generate educational health reports from your records.",
    status: "live",
    sortOrder: 3,
  },
  {
    id: "medications",
    title: "Medications",
    description: "Add medications",
    status: "coming_soon",
    sortOrder: 4,
  },
  {
    id: "water_balance",
    title: "Water balance",
    description: "Track daily water intake.",
    status: "coming_soon",
    sortOrder: 5,
  },
  {
    id: "weight_trend",
    title: "Weight trend",
    description: "Add weight and track changes over time.",
    status: "coming_soon",
    sortOrder: 6,
  },
];

export function getWidgetDefinition(id: WidgetId): WidgetDefinition {
  const widget = DASHBOARD_WIDGETS.find((w) => w.id === id);
  if (!widget) throw new Error(`Unknown widget: ${id}`);
  return widget;
}
