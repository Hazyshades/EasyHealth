import { NextResponse } from "next/server";
import { ARC_USDC_ADDRESS } from "@/lib/arc-usdc";
import { env } from "@/lib/env";

const CIRCLE_BASE_URL = "https://api.circle.com";

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) return "Circle API unreachable";
  const cause =
    error.cause instanceof Error
      ? error.cause.message
      : typeof error.cause === "string"
        ? error.cause
        : null;
  if (cause) return `Circle API unreachable: ${cause}`;
  if (error.message && error.message !== "fetch failed") return error.message;
  return "Circle API unreachable. Check CIRCLE_API_KEY and your network connection.";
}

async function circleFetch(
  path: string,
  options: { method?: string; body?: unknown; userToken?: string }
) {
  const { method = "POST", body, userToken } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.CIRCLE_API_KEY}`,
  };
  if (userToken) {
    headers["X-User-Token"] = userToken;
  }

  let response: Response;
  try {
    response = await fetch(`${CIRCLE_BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new Error(formatFetchError(error));
  }

  let data: { message?: string; error?: string; code?: number; errors?: Array<{ message?: string }>; data?: unknown };
  try {
    data = await response.json();
  } catch {
    throw new Error(`Circle API returned an invalid response (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const message =
      data.message ?? data.error ?? data.errors?.[0]?.message ?? "Circle API error";
    const err = new Error(message) as Error & { code?: number; circleData?: unknown };
    err.code = data.code;
    err.circleData = data;
    throw err;
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
          body: {
            idempotencyKey: crypto.randomUUID(),
            deviceId,
          },
        });
        return NextResponse.json(data.data);
      }

      case "initializeUser": {
        const { userToken } = params;
        if (!userToken) {
          return NextResponse.json({ error: "Missing userToken" }, { status: 400 });
        }
        try {
          const data = await circleFetch("/v1/w3s/user/initialize", {
            userToken,
            body: {
              idempotencyKey: crypto.randomUUID(),
              accountType: "SCA",
              blockchains: ["ARC-TESTNET"],
            },
          });
          return NextResponse.json(data.data);
        } catch (error) {
          const err = error as Error & { code?: number; circleData?: unknown };
          if (err.code === 155106) {
            return NextResponse.json(err.circleData ?? { code: 155106 }, { status: 409 });
          }
          throw error;
        }
      }

      case "getWallets": {
        const { userToken } = params;
        if (!userToken) {
          return NextResponse.json({ error: "Missing userToken" }, { status: 400 });
        }
        const data = await circleFetch("/v1/w3s/wallets", {
          method: "GET",
          userToken,
        });
        return NextResponse.json(data.data);
      }

      case "getTokenBalance": {
        const { userToken, walletId } = params;
        if (!userToken || !walletId) {
          return NextResponse.json(
            { error: "Missing userToken or walletId" },
            { status: 400 }
          );
        }
        const data = await circleFetch(`/v1/w3s/wallets/${walletId}/balances`, {
          method: "GET",
          userToken,
        });
        return NextResponse.json(data.data);
      }

      case "createTransfer": {
        const { userToken, walletId, destinationAddress, amount, tokenId } = params;
        if (!userToken || !walletId || !destinationAddress || !amount) {
          return NextResponse.json(
            { error: "Missing userToken, walletId, destinationAddress, or amount" },
            { status: 400 }
          );
        }
        const data = await circleFetch("/v1/w3s/user/transactions/transfer", {
          userToken,
          body: {
            idempotencyKey: crypto.randomUUID(),
            walletId,
            destinationAddress,
            amounts: [String(amount)],
            feeLevel: "MEDIUM",
            ...(tokenId
              ? { tokenId }
              : { tokenAddress: ARC_USDC_ADDRESS, blockchain: "ARC-TESTNET" }),
          },
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
