import {
  SERVICE_BASE_PRICES,
  SERVICE_TIER,
  type AgentServiceId,
  type AgentTier,
} from "@/lib/agent-pricing";

export type AgentServiceDefinition = {
  id: AgentServiceId;
  method: "POST";
  path: string;
  tier: AgentTier;
  base_price_usdc: number;
  description: string;
  dynamic_pricing: {
    free_quota: number;
    per_item_usdc: number;
    feature_flags: {
      include_citations: number;
      depth_deep: number;
      output_text: number;
    };
    max_usdc: number;
  };
};

const DYNAMIC_BY_TIER = {
  basic: { free_quota: 3, per_item_usdc: 0.0005, max_usdc: 0.01 },
  plus: { free_quota: 5, per_item_usdc: 0.002, max_usdc: 0.05 },
  pro: { free_quota: 10, per_item_usdc: 0.001, max_usdc: 0.15 },
} as const;

const FEATURE_FLAGS = {
  include_citations: 0.01,
  depth_deep: 0.02,
  output_text: 0.001,
};

export const AGENT_SERVICES: AgentServiceDefinition[] = [
  {
    id: "quick-insight",
    method: "POST",
    path: "/api/agent/quick-insight",
    tier: SERVICE_TIER["quick-insight"],
    base_price_usdc: SERVICE_BASE_PRICES["quick-insight"],
    description: "Brief educational interpretation of supplied biomarkers.",
    dynamic_pricing: { ...DYNAMIC_BY_TIER.basic, feature_flags: FEATURE_FLAGS },
  },
  {
    id: "trend-analysis",
    method: "POST",
    path: "/api/agent/trend-analysis",
    tier: SERVICE_TIER["trend-analysis"],
    base_price_usdc: SERVICE_BASE_PRICES["trend-analysis"],
    description: "Longitudinal biomarker trends with educational narrative.",
    dynamic_pricing: { ...DYNAMIC_BY_TIER.plus, feature_flags: FEATURE_FLAGS },
  },
  {
    id: "holistic-synthesis",
    method: "POST",
    path: "/api/agent/holistic-synthesis",
    tier: SERVICE_TIER["holistic-synthesis"],
    base_price_usdc: SERVICE_BASE_PRICES["holistic-synthesis"],
    description: "Cross-domain synthesis across labs, imaging, and notes in the request body.",
    dynamic_pricing: { ...DYNAMIC_BY_TIER.plus, feature_flags: FEATURE_FLAGS },
  },
  {
    id: "clinician-summary",
    method: "POST",
    path: "/api/agent/clinician-summary",
    tier: SERVICE_TIER["clinician-summary"],
    base_price_usdc: SERVICE_BASE_PRICES["clinician-summary"],
    description: "Clinician-ready educational summary with questions for care discussion.",
    dynamic_pricing: { ...DYNAMIC_BY_TIER.pro, feature_flags: FEATURE_FLAGS },
  },
];

export function buildAgentManifest(baseUrl: string) {
  return {
    name: "EasyHealth Insight API",
    version: "1.0.0",
    network: "eip155:5042002",
    currency: "USDC",
    payment_protocol: "x402",
    base_url: baseUrl,
    services: AGENT_SERVICES,
    request_schema: {
      type: "object",
      properties: {
        tier: { type: "string", enum: ["basic", "plus", "pro"] },
        options: {
          type: "object",
          properties: {
            depth: { type: "string", enum: ["standard", "deep"] },
            include_citations: { type: "boolean" },
            output_format: { type: "string", enum: ["json", "text"] },
          },
        },
        data: { type: "object", description: "DocumentStructuredContext-compatible payload" },
      },
      required: ["data"],
    },
    zod_shape_hint: "AgentInsightRequest: { data: DocumentStructuredContext-compatible, options?: { depth, include_citations, output_format } }",
  };
}
