import { createAgentInsightRoute } from "@/lib/agent-route";
import { handleTrendAnalysis } from "@/lib/agent-handlers";

export const POST = createAgentInsightRoute(
  "trend-analysis",
  "/api/agent/trend-analysis",
  handleTrendAnalysis
);
