import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const CIRCLE_BASE_URL = "https://api.circle.com";

async function circleFetch(path: string, body: unknown) {
  const response = await fetch(`${CIRCLE_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.CIRCLE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Circle API error");
  }
  return data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body ?? {};

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    switch (action) {
      case "createDeviceToken": {
        const { deviceId } = params;
        if (!deviceId) {
          return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
        }
        const data = await circleFetch("/v1/w3s/users/social/token", {
          idempotencyKey: crypto.randomUUID(),
          deviceId,
        });
        return NextResponse.json(data.data);
      }

      case "socialLogin": {
        const { deviceToken, deviceId, oauthToken } = params;
        const data = await circleFetch("/v1/w3s/users/social", {
          idempotencyKey: crypto.randomUUID(),
          deviceToken,
          deviceId,
          oauthProvider: "google",
          oauthToken,
        });
        return NextResponse.json(data.data);
      }

      case "getWallets": {
        const { userToken } = params;
        const data = await circleFetch("/v1/w3s/wallets", {
          userToken,
        });
        return NextResponse.json(data.data);
      }

      case "getTokenBalance": {
        const { userToken, walletId } = params;
        const data = await circleFetch(`/v1/w3s/wallets/${walletId}/balances`, {
          userToken,
        });
        return NextResponse.json(data.data);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Circle request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
