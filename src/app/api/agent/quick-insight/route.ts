import { createAgentInsightRoute } from "@/lib/agent-route";
import { handleQuickInsight } from "@/lib/agent-handlers";

export const POST = createAgentInsightRoute(
  "quick-insight",
  "/api/agent/quick-insight",
  handleQuickInsight
);
