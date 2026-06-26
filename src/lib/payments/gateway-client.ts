"use client";

import { GatewayClient } from "@circle-fin/x402-batching/client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const GATEWAY_KEY_STORAGE = "eh_gateway_private_key";

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

export async function payForResource(
  url: string,
  options?: { method?: "GET" | "POST"; body?: unknown }
) {
  const gateway = getGatewayClient();
  return gateway.pay(url, {
    method: options?.method ?? "POST",
    body: options?.body,
  });
}

export async function getGatewayBalance() {
  const gateway = getGatewayClient();
  const balances = await gateway.getBalances();
  return balances.gateway.formattedAvailable;
}
