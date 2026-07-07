import { createAgentInsightRoute } from "@/lib/agent-route";
import { handleHolisticSynthesis } from "@/lib/agent-handlers";

export const POST = createAgentInsightRoute(
  "holistic-synthesis",
  "/api/agent/holistic-synthesis",
  handleHolisticSynthesis
);
