import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ENTITLEMENT_HEADER } from "@/lib/payment-entitlement-contract";
import {
  createEntitlement,
  createEntitlementForPayer,
  markReceiptConsumed,
  markReceiptFailed,
  redeemEntitlement,
  validateEntitlement,
  validateEntitlementForPayer,
} from "@/lib/payment-entitlements";
import type { AgentPriceQuote } from "@/lib/agent-pricing";

export const ARC_TESTNET_NETWORK = "eip155:5042002";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const ARC_TESTNET_GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

export const sellerAddress = env.SELLER_ADDRESS as `0x${string}`;
const facilitator = new BatchFacilitatorClient();

interface PaymentPayload {
  x402Version: number;
  resource?: { url: string; description: string; mimeType: string };
  accepted?: Record<string, unknown>;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

function buildPaymentRequirements(price: string) {
  const amount = Math.round(parseFloat(price.replace("$", "")) * 1_000_000);
  return buildPaymentRequirementsFromMicro(amount);
}

export function buildPaymentRequirementsFromMicro(amountMicro: number) {
  return {
    scheme: "exact" as const,
    network: ARC_TESTNET_NETWORK,
    asset: ARC_TESTNET_USDC,
    amount: amountMicro.toString(),
    payTo: sellerAddress,
    maxTimeoutSeconds: 604900,
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: ARC_TESTNET_GATEWAY_WALLET,
    },
  };
}

export type SettledPayment = {
  payer: string;
  amountUsdc: string;
  gatewayTx: string | null;
  network: string;
  entitlementId?: string;
};

function buildPaymentRequiredResponse(endpoint: string, price: string, requirements: ReturnType<typeof buildPaymentRequirements>) {
  const paymentRequired = {
    x402Version: 2,
    resource: {
      url: endpoint,
      description: `EasyHealth paid resource (${price} USDC )`,
      mimeType: "application/json",
    },
    accepts: [requirements],
  };

  return new NextResponse(JSON.stringify({ error: "Payment required" }), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
    },
  });
}

async function augmentFailureWithEntitlement(
  response: NextResponse,
  receiptId: string,
  profileId: string | null,
  endpoint: string,
  payer?: string | null
): Promise<NextResponse> {
  if (!profileId && !payer) return response;

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    await markReceiptFailed(receiptId);
    const entitlement = payer
      ? await createEntitlementForPayer(payer, endpoint, receiptId)
      : await createEntitlement(profileId!, endpoint, receiptId);
    return NextResponse.json(
      {
        ...body,
        entitlement_id: entitlement.id,
        retry_without_payment: true,
      },
      { status: response.status }
    );
  } catch (error) {
    console.error("[x402] entitlement recovery unavailable:", error);
    return NextResponse.json(body, { status: response.status });
  }
}

async function finalizePaidResponse(
  response: NextResponse,
  receiptId: string,
  profileId: string | null,
  endpoint: string,
  settleHeader?: {
    transaction: string | null | undefined;
    network: string;
    payer: string;
  },
  payerForEntitlement?: string | null
): Promise<NextResponse> {
  if (response.status >= 200 && response.status < 300) {
    await markReceiptConsumed(receiptId);
    if (settleHeader) {
      const header = Buffer.from(
        JSON.stringify({
          success: true,
          transaction: settleHeader.transaction,
          network: settleHeader.network,
          payer: settleHeader.payer,
        })
      ).toString("base64");
      response.headers.set("PAYMENT-RESPONSE", header);
    }
    return response;
  }

  if (response.status >= 500) {
    return augmentFailureWithEntitlement(
      response,
      receiptId,
      profileId,
      endpoint,
      payerForEntitlement
    );
  }

  await markReceiptConsumed(receiptId);
  return response;
}

async function runDynamicHandlerSafely<T>(
  handler: (data: T, payment: SettledPayment) => Promise<NextResponse>,
  data: T,
  payment: SettledPayment
): Promise<NextResponse> {
  try {
    return await handler(data, payment);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[withGatewayDynamic] handler error:", message);
    return NextResponse.json({ error: "Request processing failed", message }, { status: 500 });
  }
}

async function runHandlerSafely(
  req: NextRequest,
  handler: (req: NextRequest, payment: SettledPayment) => Promise<NextResponse>,
  payment: SettledPayment
): Promise<NextResponse> {
  try {
    return await handler(req, payment);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[withGateway] handler error:", message);
    return NextResponse.json({ error: "Request processing failed", message }, { status: 500 });
  }
}

export function withGateway(
  handler: (req: NextRequest, payment: SettledPayment) => Promise<NextResponse>,
  price: string,
  endpoint: string,
  options?: { getProfileId?: () => Promise<string | null> }
) {
  const requirements = buildPaymentRequirements(price);

  return async (req: NextRequest) => {
    const profileId = options?.getProfileId ? await options.getProfileId() : null;
    const entitlementHeader = req.headers.get(ENTITLEMENT_HEADER);

    if (entitlementHeader) {
      if (!profileId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const validation = await validateEntitlement(entitlementHeader, profileId, endpoint);
      if (!validation.valid) {
        return buildPaymentRequiredResponse(endpoint, price, requirements);
      }

      const response = await runHandlerSafely(req, handler, {
        payer: "entitlement",
        amountUsdc: "0",
        gatewayTx: null,
        network: requirements.network,
        entitlementId: entitlementHeader,
      });

      if (response.status >= 200 && response.status < 300) {
        await redeemEntitlement(entitlementHeader);
      }

      return response;
    }

    const paymentSignature = req.headers.get("payment-signature");
    if (!paymentSignature) {
      return buildPaymentRequiredResponse(endpoint, price, requirements);
    }

    try {
      const paymentPayload: PaymentPayload = JSON.parse(
        Buffer.from(paymentSignature, "base64").toString("utf-8")
      );

      const verifyRequirements = paymentPayload.accepted
        ? { ...requirements, ...paymentPayload.accepted }
        : requirements;

      const verifyResult = await facilitator.verify(paymentPayload, verifyRequirements);
      if (!verifyResult.isValid) {
        return NextResponse.json(
          { error: "Payment verification failed", reason: verifyResult.invalidReason },
          { status: 402 }
        );
      }

      const settleResult = await facilitator.settle(paymentPayload, verifyRequirements);
      if (!settleResult.success) {
        return NextResponse.json(
          { error: "Payment settlement failed", reason: settleResult.errorReason },
          { status: 402 }
        );
      }

      const amountUsdc = (Number(requirements.amount) / 1e6).toString();
      const payer = settleResult.payer ?? verifyResult.payer ?? "unknown";

      const supabase = createAdminClient();
      const { data: receipt, error: receiptError } = await supabase
        .from("payment_receipts")
        .insert({
          profile_id: profileId,
          endpoint,
          payer,
          amount_usdc: amountUsdc,
          network: requirements.network,
          gateway_tx: settleResult.transaction ?? null,
        })
        .select("id")
        .single();

      if (receiptError || !receipt) {
        return NextResponse.json(
          { error: "Payment receipt recording failed", message: receiptError?.message },
          { status: 500 }
        );
      }

      const response = await runHandlerSafely(req, handler, {
        payer,
        amountUsdc,
        gatewayTx: settleResult.transaction ?? null,
        network: requirements.network,
      });

      return finalizePaidResponse(response, receipt.id, profileId, endpoint, {
        transaction: settleResult.transaction,
        network: requirements.network,
        payer,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: "Payment processing error", message }, { status: 500 });
    }
  };
}

const AGENT_PAYER_HEADER = "X-Agent-Payer";

function buildDynamicPaymentRequiredResponse(
  endpoint: string,
  quote: AgentPriceQuote,
  requirements: ReturnType<typeof buildPaymentRequirementsFromMicro>
) {
  const paymentRequired = {
    x402Version: 2,
    resource: {
      url: endpoint,
      description: `EasyHealth agent insight (${quote.quoted_price_usdc} USDC)`,
      mimeType: "application/json",
    },
    accepts: [requirements],
  };

  return new NextResponse(
    JSON.stringify({
      error: "Payment required",
      quoted_price_usdc: quote.quoted_price_usdc,
      price_breakdown: quote.breakdown,
      ...(quote.suggested_tier ? { suggested_tier: quote.suggested_tier } : {}),
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
      },
    }
  );
}

export type DynamicGatewayOptions<T> = {
  endpoint: string;
  agentMode?: boolean;
  parseBody: (raw: unknown) => { ok: true; data: T } | { ok: false; error: string };
  priceFn: (data: T) => AgentPriceQuote;
};

export function withGatewayDynamic<T>(
  handler: (data: T, payment: SettledPayment) => Promise<NextResponse>,
  options: DynamicGatewayOptions<T>
) {
  return async (req: NextRequest) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = options.parseBody(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const quote = options.priceFn(parsed.data);
    const requirements = buildPaymentRequirementsFromMicro(quote.amountUsdcMicro);
    const entitlementHeader = req.headers.get(ENTITLEMENT_HEADER);
    const agentPayerHeader = req.headers.get(AGENT_PAYER_HEADER);

    if (entitlementHeader && options.agentMode) {
      if (!agentPayerHeader) {
        return NextResponse.json({ error: "X-Agent-Payer header required for entitlement retry" }, { status: 400 });
      }

      const validation = await validateEntitlementForPayer(
        entitlementHeader,
        agentPayerHeader,
        options.endpoint
      );
      if (!validation.valid) {
        return buildDynamicPaymentRequiredResponse(options.endpoint, quote, requirements);
      }

      const response = await runDynamicHandlerSafely(handler, parsed.data, {
          payer: agentPayerHeader,
          amountUsdc: "0",
          gatewayTx: null,
          network: requirements.network,
          entitlementId: entitlementHeader,
        });

      if (response.status >= 200 && response.status < 300) {
        await redeemEntitlement(entitlementHeader);
      }

      return response;
    }

    const paymentSignature = req.headers.get("payment-signature");
    if (!paymentSignature) {
      return buildDynamicPaymentRequiredResponse(options.endpoint, quote, requirements);
    }

    try {
      const paymentPayload: PaymentPayload = JSON.parse(
        Buffer.from(paymentSignature, "base64").toString("utf-8")
      );

      const verifyRequirements = paymentPayload.accepted
        ? { ...requirements, ...paymentPayload.accepted }
        : requirements;

      const verifyResult = await facilitator.verify(paymentPayload, verifyRequirements);
      if (!verifyResult.isValid) {
        return NextResponse.json(
          { error: "Payment verification failed", reason: verifyResult.invalidReason },
          { status: 402 }
        );
      }

      const settleResult = await facilitator.settle(paymentPayload, verifyRequirements);
      if (!settleResult.success) {
        return NextResponse.json(
          { error: "Payment settlement failed", reason: settleResult.errorReason },
          { status: 402 }
        );
      }

      const amountUsdc = (Number(requirements.amount) / 1e6).toString();
      const payer = settleResult.payer ?? verifyResult.payer ?? "unknown";

      const supabase = createAdminClient();
      const { data: receipt, error: receiptError } = await supabase
        .from("payment_receipts")
        .insert({
          profile_id: null,
          endpoint: options.endpoint,
          payer,
          amount_usdc: amountUsdc,
          network: requirements.network,
          gateway_tx: settleResult.transaction ?? null,
        })
        .select("id")
        .single();

      if (receiptError || !receipt) {
        return NextResponse.json(
          { error: "Payment receipt recording failed", message: receiptError?.message },
          { status: 500 }
        );
      }

      const response = await runDynamicHandlerSafely(handler, parsed.data, {
          payer,
          amountUsdc,
          gatewayTx: settleResult.transaction ?? null,
          network: requirements.network,
        });

      return finalizePaidResponse(
        response,
        receipt.id,
        null,
        options.endpoint,
        {
          transaction: settleResult.transaction,
          network: requirements.network,
          payer,
        },
        options.agentMode ? payer : null
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: "Payment processing error", message }, { status: 500 });
    }
  };
}
