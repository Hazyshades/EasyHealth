"use client";

import Link from "next/link";
import { useWallet } from "@/components/wallet-provider";
import { Button } from "@/components/ui/button";
import { getGatewayBalance, getGatewayWalletAddress } from "@/lib/payments/gateway-client";
import { useCallback, useEffect, useState } from "react";

export function AppHeader() {
  const { walletAddress, usdcBalance, refreshBalance, signOut } = useWallet();
  const [gatewayBalance, setGatewayBalance] = useState<string | null>(null);

  const loadGatewayBalance = useCallback(() => {
    getGatewayBalance()
      .then(setGatewayBalance)
      .catch(() => setGatewayBalance("0"));
  }, []);

  useEffect(() => {
    if (!walletAddress) return;
    void refreshBalance();
    loadGatewayBalance();
  }, [walletAddress, refreshBalance, loadGatewayBalance]);

  const short = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : "";
  const gatewayAddress = getGatewayWalletAddress();
  const gatewayShort = `${gatewayAddress.slice(0, 6)}…${gatewayAddress.slice(-4)}`;

  return (
    <header className="border-b bg-card">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-teal-700">
          EasyHealth
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
          {walletAddress && (
            <>
              <span title={walletAddress}>Wallet: {short}</span>
              <span title="USDC on Arc Testnet (Circle wallet)">
                USDC: {usdcBalance ?? "…"}
              </span>
              <span
                title={`Separate wallet for x402 payments: ${gatewayAddress}. Fund it on your first payment or via faucet to this address.`}
              >
                Gateway ({gatewayShort}): {gatewayBalance ?? "…"} USDC
              </span>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
