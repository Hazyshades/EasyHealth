"use client";

import { BatchEvmScheme, GatewayClient } from "@circle-fin/x402-batching/client";
import { formatUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const GATEWAY_KEY_STORAGE = "eh_gateway_private_key";

type PaymentRequirements = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
};

type PayResult<T = unknown> = {
  data: T;
  amount: bigint;
  formattedAmount: string;
  transaction: string;
  status: number;
};

function getOrCreateGatewayPrivateKey(): `0x${string}` {
  if (typeof window === "undefined") {
    throw new Error("Gateway client is browser-only");
  }
  const existing = window.sessionStorage.getItem(GATEWAY_KEY_STORAGE);
  if (existing) return existing as `0x${string}`;
  const key = generatePrivateKey();
  window.sessionStorage.setItem(GATEWAY_KEY_STORAGE, key);
  return key;
}

let gatewayClient: GatewayClient | null = null;

export function getGatewayClient() {
  if (!gatewayClient) {
    const privateKey = getOrCreateGatewayPrivateKey();
    gatewayClient = new GatewayClient({
      chain: "arcTestnet",
      privateKey,
    });
  }
  return gatewayClient;
}

export function getGatewayWalletAddress() {
  const privateKey = getOrCreateGatewayPrivateKey();
  return privateKeyToAccount(privateKey).address;
}

export async function depositToGateway(amount = "1") {
  const gateway = getGatewayClient();
  return gateway.deposit(amount);
}

function buildFetchBody(body: unknown): { headers: Record<string, string>; body?: BodyInit } {
  if (body === undefined) {
    return { headers: {} };
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return { headers: {}, body };
  }
  if (typeof body === "string") {
    return { headers: { "Content-Type": "application/json" }, body };
  }
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

async function payWithX402(
  gateway: GatewayClient,
  url: string,
  options?: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string> }
): Promise<PayResult> {
  const method = options?.method ?? "POST";
  const { headers: bodyHeaders, body: fetchBody } = buildFetchBody(options?.body);
  const headers = { ...options?.headers, ...bodyHeaders };

  const initialResponse = await fetch(url, {
    method,
    headers,
    body: fetchBody,
    credentials: "include",
  });

  if (initialResponse.status !== 402) {
    if (initialResponse.ok) {
      const data = await initialResponse.json();
      return {
        data,
        amount: BigInt(0),
        formattedAmount: "0",
        transaction: "",
        status: initialResponse.status,
      };
    }
    const errorBody = await initialResponse.json().catch(() => ({}));
    throw new Error(
      (errorBody as { error?: string }).error ??
        `Request failed with status ${initialResponse.status}`
    );
  }

  const paymentRequiredHeader = initialResponse.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) {
    throw new Error("Missing PAYMENT-REQUIRED header in 402 response");
  }

  const paymentRequired = JSON.parse(
    Buffer.from(paymentRequiredHeader, "base64").toString("utf-8")
  ) as {
    x402Version?: number;
    resource?: unknown;
    accepts?: PaymentRequirements[];
  };

  const accepts = paymentRequired.accepts;
  if (!accepts?.length) {
    throw new Error("No payment options in 402 response");
  }

  const expectedNetwork = `eip155:${gateway.chainConfig.chain.id}`;
  const batchingOption = accepts.find((opt) => {
    const extra = opt.extra;
    return (
      opt.network === expectedNetwork &&
      extra?.name === "GatewayWalletBatched" &&
      extra?.version === "1" &&
      typeof extra?.verifyingContract === "string"
    );
  });

  if (!batchingOption) {
    throw new Error(
      `No Gateway batching option for ${expectedNetwork}. The seller may not support Arc Testnet.`
    );
  }

  const scheme = new BatchEvmScheme(gateway.account);
  const paymentPayload = await scheme.createPaymentPayload(
    paymentRequired.x402Version ?? 2,
    {
      ...batchingOption,
      maxTimeoutSeconds: Number(batchingOption.maxTimeoutSeconds ?? 604900),
    }
  );

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

  const paidResponse = await fetch(url, {
    method,
    headers: {
      ...headers,
      "Payment-Signature": paymentHeader,
    },
    body: fetchBody,
    credentials: "include",
  });

  if (!paidResponse.ok) {
    const error = await paidResponse.json().catch(() => ({}));
    const reason = (error as { reason?: string; error?: string }).reason;
    const message = (error as { error?: string }).error ?? paidResponse.statusText;
    throw new Error(reason ? `${message}: ${reason}` : message);
  }

  const data = await paidResponse.json();
  const amount = BigInt(batchingOption.amount);
  let transaction = "";
  const paymentResponseHeader = paidResponse.headers.get("PAYMENT-RESPONSE");
  if (paymentResponseHeader) {
    const settleResponse = JSON.parse(
      Buffer.from(paymentResponseHeader, "base64").toString("utf-8")
    ) as { transaction?: string };
    transaction = settleResponse.transaction ?? "";
  }

  return {
    data,
    amount,
    formattedAmount: formatUnits(amount, 6),
    transaction,
    status: paidResponse.status,
  };
}

export async function ensureGatewayFunded(
  minAmount = "0.02",
  fundFromCircle?: (amount: string) => Promise<void>
) {
  const gateway = getGatewayClient();
  let balances = await gateway.getBalances();
  const needed = parseFloat(minAmount);
  const available = parseFloat(balances.gateway.formattedAvailable);

  if (available >= needed) {
    return balances;
  }

  const depositAmount = Math.max(needed - available, 0.01).toFixed(2);
  let walletBal = parseFloat(balances.wallet.formatted);

  if (walletBal < parseFloat(depositAmount) && fundFromCircle) {
    const topUp = Math.max(parseFloat(depositAmount) + 0.02, 0.1).toFixed(2);
    await fundFromCircle(topUp);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    balances = await gateway.getBalances();
    walletBal = parseFloat(balances.wallet.formatted);
  }

  if (walletBal >= parseFloat(depositAmount)) {
    await gateway.deposit(depositAmount);
    return gateway.getBalances();
  }

  const address = gateway.address;
  throw new Error(
    `Gateway payment wallet needs USDC on Arc Testnet. Send at least ${depositAmount} USDC to ${address}, or fund your Circle wallet and sign in again. Faucet: https://faucet.circle.com`
  );
}

export async function payForResource(
  url: string,
  options?: { method?: "GET" | "POST"; body?: unknown }
) {
  const gateway = getGatewayClient();
  return payWithX402(gateway, url, {
    method: options?.method ?? "POST",
    body: options?.body,
  });
}

export async function getGatewayBalance() {
  const gateway = getGatewayClient();
  const balances = await gateway.getBalances();
  return balances.gateway.formattedAvailable;
}
