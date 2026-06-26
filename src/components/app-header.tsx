"use client";

import Link from "next/link";
import { useWallet } from "@/components/wallet-provider";
import { Button } from "@/components/ui/button";
import { getGatewayBalance, getGatewayWalletAddress } from "@/lib/payments/gateway-client";
import { useEffect, useState } from "react";

export function AppHeader() {
  const { walletAddress, usdcBalance, signOut } = useWallet();
  const [gatewayBalance, setGatewayBalance] = useState<string | null>(null);

  useEffect(() => {
    getGatewayBalance()
      .then(setGatewayBalance)
      .catch(() => setGatewayBalance("0"));
  }, []);

  const short = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : "";

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-teal-700">
          EasyHealth
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/app" className="hover:underline">
            Health card
          </Link>
          <Link href="/app/upload" className="hover:underline">
            Upload
          </Link>
          <Link href="/app/summary" className="hover:underline">
            Doctor summary
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {walletAddress && (
            <>
              <span title={walletAddress}>Wallet: {short}</span>
              <span>USDC: {usdcBalance ?? "-"}</span>
              <span title={getGatewayWalletAddress()}>
                Gateway: {gatewayBalance ?? "-"} USDC
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
