"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, LogOut, Search } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { resolvePageMeta } from "@/lib/navigation";
import { getGatewayBalance, getGatewayWalletAddress } from "@/lib/payments/gateway-client";
import { cn } from "@/lib/utils";

function walletInitials(address: string): string {
  return address.slice(2, 4).toUpperCase();
}

export function TopBar() {
  const pathname = usePathname();
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

  const meta = resolvePageMeta(pathname);
  const short = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : "";
  const gatewayAddress = getGatewayWalletAddress();
  const gatewayShort = `${gatewayAddress.slice(0, 6)}…${gatewayAddress.slice(-4)}`;

  return (
    <header className="topbar flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#E8EEF5] bg-white px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--eh-text-primary)] md:hidden">
          {meta.title}
        </p>
        <p className="hidden text-sm font-semibold text-[var(--eh-brand)] md:block">EasyHealth</p>
        <p className="hidden text-xs text-[var(--eh-text-muted)] md:block">{meta.title}</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          aria-label="Search"
          className="hidden size-9 items-center justify-center rounded-xl border border-[var(--eh-border)] bg-white text-[var(--eh-text-secondary)] transition-colors hover:bg-[var(--eh-canvas-bg)] sm:inline-flex"
        >
          <Search className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="hidden size-9 items-center justify-center rounded-xl border border-[var(--eh-border)] bg-white text-[var(--eh-text-secondary)] transition-colors hover:bg-[var(--eh-canvas-bg)] lg:inline-flex"
        >
          <Bell className="size-4" />
        </button>

        {walletAddress && (
          <div className="hidden items-center gap-1.5 xl:flex">
            <StatusChip variant="neutral" title={walletAddress}>
              Wallet {short}
            </StatusChip>
            <StatusChip variant="info" title="USDC on Arc Testnet">
              USDC {usdcBalance ?? "…"}
            </StatusChip>
            <StatusChip
              variant="neutral"
              title={`Gateway wallet for x402: ${gatewayAddress}`}
            >
              Gateway {gatewayShort}: {gatewayBalance ?? "…"}
            </StatusChip>
          </div>
        )}

        {walletAddress && (
          <div className="flex items-center gap-1.5 xl:hidden">
            <StatusChip variant="info" title={walletAddress}>
              {short}
            </StatusChip>
            <StatusChip variant="neutral" title="USDC balance">
              {usdcBalance ?? "…"} USDC
            </StatusChip>
          </div>
        )}

        {walletAddress && (
          <span
            className="flex size-9 items-center justify-center rounded-full bg-[var(--eh-brand-soft)] text-xs font-semibold text-[var(--eh-brand)]"
            title={walletAddress}
            aria-label={`Account ${short}`}
          >
            {walletInitials(walletAddress)}
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut()}
          className={cn(
            "rounded-xl border-[var(--eh-border)] text-[var(--eh-text-secondary)] shadow-xs",
            "transition-transform duration-150 ease-out active:scale-[0.97]"
          )}
        >
          <LogOut className="size-3.5 sm:mr-1.5" aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
