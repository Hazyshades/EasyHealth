import { createAgentInsightRoute } from "@/lib/agent-route";
import { handleClinicianSummary } from "@/lib/agent-handlers";

export const POST = createAgentInsightRoute(
  "clinician-summary",
  "/api/agent/clinician-summary",
  handleClinicianSummary
);
