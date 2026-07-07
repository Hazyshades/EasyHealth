import { withGatewayDynamic } from "@/lib/x402";
import { priceAgentRequest, type AgentServiceId } from "@/lib/agent-pricing";
import { parseAgentInsightRequest } from "@/lib/schemas/agent-request";
import type { AgentInsightRequest } from "@/lib/schemas/agent-request";
import type { SettledPayment } from "@/lib/x402";
import { NextResponse } from "next/server";

export function createAgentInsightRoute(
  serviceId: AgentServiceId,
  endpoint: string,
  handler: (body: AgentInsightRequest, payment: SettledPayment) => Promise<NextResponse>
) {
  return withGatewayDynamic(
    (body, payment) => handler(body, payment),
    {
      endpoint,
      agentMode: true,
      parseBody: parseAgentInsightRequest,
      priceFn: (body) => priceAgentRequest(serviceId, body),
    }
  );
}
