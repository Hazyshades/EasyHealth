/**
 * Buyer-agent fleet demo for Lepton submission.
 * Run: pnpm agent:fleet (requires dev server + funded Gateway wallet on Arc testnet)
 */
import { BatchEvmScheme, GatewayClient } from "@circle-fin/x402-batching/client";
import { formatUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE_URL = process.env.AGENT_DEMO_BASE_URL ?? "http://localhost:3000";
const SPEND_CAP_USDC = parseFloat(process.env.AGENT_DEMO_SPEND_CAP ?? "0.25");
const PRIVATE_KEY = (process.env.AGENT_DEMO_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`;

type AgentRequestBody = {
  data: {
    biomarkers: Array<{
      biomarker: string;
      key: string;
      value: number;
      unit: string;
      ref_low: number | null;
      ref_high: number | null;
      observed_at: string;
      source: string;
    }>;
  };
  options?: { depth?: "standard" | "deep"; include_citations?: boolean };
};

const PROFILES: { name: string; body: AgentRequestBody; startPath: string }[] = [
  {
    name: "minimal",
    startPath: "/api/agent/quick-insight",
    body: {
      data: {
        biomarkers: [
          {
            biomarker: "HbA1c",
            key: "hba1c",
            value: 5.4,
            unit: "%",
            ref_low: 4,
            ref_high: 5.6,
            observed_at: "2026-05-01",
            source: "agent-demo",
          },
        ],
      },
    },
  },
  {
    name: "borderline",
    startPath: "/api/agent/quick-insight",
    body: {
      data: {
        biomarkers: [
          {
            biomarker: "HbA1c",
            key: "hba1c",
            value: 6.4,
            unit: "%",
            ref_low: 4,
            ref_high: 5.6,
            observed_at: "2026-05-01",
            source: "agent-demo",
          },
          {
            biomarker: "LDL",
            key: "ldl",
            value: 142,
            unit: "mg/dL",
            ref_low: null,
            ref_high: 100,
            observed_at: "2026-05-01",
            source: "agent-demo",
          },
        ],
      },
    },
  },
];

async function payWithGateway(
  gateway: GatewayClient,
  url: string,
  body: AgentRequestBody
) {
  const initial = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (initial.status !== 402) {
    const text = await initial.text();
    throw new Error(`Expected 402 from ${url}, got ${initial.status}: ${text}`);
  }

  const paymentRequiredHeader = initial.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) throw new Error("Missing PAYMENT-REQUIRED header");

  const paymentRequired = JSON.parse(
    Buffer.from(paymentRequiredHeader, "base64").toString("utf-8")
  ) as { x402Version?: number; resource?: unknown; accepts?: Array<Record<string, unknown>> };

  const expectedNetwork = `eip155:${gateway.chainConfig.chain.id}`;
  const batchingOption = paymentRequired.accepts?.find((opt) => {
    const extra = opt.extra as Record<string, unknown> | undefined;
    return (
      opt.network === expectedNetwork &&
      extra?.name === "GatewayWalletBatched" &&
      extra?.version === "1"
    );
  });

  if (!batchingOption) throw new Error("No Gateway batching option in 402");

  const scheme = new BatchEvmScheme(gateway.account);
  const paymentPayload = await scheme.createPaymentPayload(paymentRequired.x402Version ?? 2, {
    ...batchingOption,
    maxTimeoutSeconds: Number(batchingOption.maxTimeoutSeconds ?? 604900),
  } as Parameters<typeof scheme.createPaymentPayload>[1]);

  const paymentHeader = Buffer.from(
    JSON.stringify({
      ...paymentPayload,
      resource: paymentRequired.resource,
      accepted: {
        ...batchingOption,
        maxTimeoutSeconds: Number(batchingOption.maxTimeoutSeconds ?? 604900),
      },
    })
  ).toString("base64");

  const paid = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Payment-Signature": paymentHeader,
    },
    body: JSON.stringify(body),
  });

  if (!paid.ok) {
    const err = await paid.text();
    throw new Error(`Paid request failed ${paid.status}: ${err}`);
  }

  const amount = BigInt(String(batchingOption.amount));
  return {
    data: await paid.json(),
    formattedAmount: formatUnits(amount, 6),
    status: paid.status,
  };
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const gateway = new GatewayClient({ chain: "arcTestnet", privateKey: PRIVATE_KEY });

  console.log(`Buyer wallet: ${account.address}`);
  console.log(`Manifest: ${BASE_URL}/api/agent/manifest`);

  const manifestRes = await fetch(`${BASE_URL}/api/agent/manifest`);
  const manifest = await manifestRes.json();
  console.log(`Services: ${manifest.services?.length ?? 0}`);

  let spent = 0;

  for (const profile of PROFILES) {
    console.log(`\n--- Agent profile: ${profile.name} ---`);
    const quick = await payWithGateway(gateway, `${BASE_URL}${profile.startPath}`, profile.body);
    spent += parseFloat(quick.formattedAmount);
    console.log(`quick-insight: $${quick.formattedAmount} USDC`);

    const escalate = (quick.data as { escalate_recommended?: boolean }).escalate_recommended;
    if (escalate && spent < SPEND_CAP_USDC) {
      const summaryBody: AgentRequestBody = {
        ...profile.body,
        options: { depth: "deep", include_citations: true },
      };
      const summary = await payWithGateway(
        gateway,
        `${BASE_URL}/api/agent/clinician-summary`,
        summaryBody
      );
      spent += parseFloat(summary.formattedAmount);
      console.log(`escalated clinician-summary: $${summary.formattedAmount} USDC`);
    }

    if (spent >= SPEND_CAP_USDC) {
      console.log(`Spend cap $${SPEND_CAP_USDC} reached.`);
      break;
    }
  }

  const traction = await fetch(`${BASE_URL}/api/agent/traction`).then((r) => r.json());
  console.log("\nTraction:", JSON.stringify(traction, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
