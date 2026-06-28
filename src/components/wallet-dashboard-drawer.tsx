"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getGatewayBalance, topUpGateway } from "@/lib/payments/gateway-client";
import { cn } from "@/lib/utils";

const ARC_FAUCET_URL = "https://faucet.circle.com";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

type WalletRowProps = {
  label: string;
  subtitle: string;
  amount: string;
  address: string;
};

function WalletRow({ label, subtitle, amount, address }: WalletRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(address);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--eh-border-soft)] bg-[var(--eh-canvas-bg)] p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--eh-text-primary)]">{label}</p>
        <p className="text-xs text-[var(--eh-text-muted)]">{subtitle}</p>
        <p className="mt-1 font-mono text-xs text-[var(--eh-text-secondary)]">{shortAddress(address)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className="text-sm font-semibold tabular-nums text-[var(--eh-text-primary)]">{amount} USDC</p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--eh-border)] bg-white px-2 py-1 text-xs text-[var(--eh-text-secondary)] transition-colors hover:bg-[var(--eh-canvas-bg)]"
        >
          {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

type WalletDashboardDrawerProps = {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  gatewayAddress: string;
  usdcBalance: string | null;
  gatewayBalance: string | null;
  refreshBalance: () => Promise<void>;
  fundGatewayWallet: (amount: string) => Promise<void>;
  canSignTransactions: boolean;
  onGatewayBalanceChange: (balance: string) => void;
};

export function WalletDashboardDrawer({
  open,
  onClose,
  walletAddress,
  gatewayAddress,
  usdcBalance,
  gatewayBalance,
  refreshBalance,
  fundGatewayWallet,
  canSignTransactions,
  onGatewayBalanceChange,
}: WalletDashboardDrawerProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      await refreshBalance();
      const balance = await getGatewayBalance();
      onGatewayBalanceChange(balance);
    } catch {
      setActionError("Could not refresh balances. Try again.");
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalance, onGatewayBalanceChange]);

  const handleDeposit = useCallback(async () => {
    setDepositing(true);
    setActionError(null);
    setActionMessage("Checking Gateway balance…");
    try {
      if (!canSignTransactions) {
        throw new Error("Sign in again with Google to authorize transfers from your Circle wallet.");
      }
      await topUpGateway("0.05", fundGatewayWallet, setActionMessage);
      await refreshAll();
      setActionMessage("Gateway topped up for x402 payments.");
      window.setTimeout(() => setActionMessage(null), 3000);
    } catch (error) {
      setActionMessage(null);
      setActionError(error instanceof Error ? error.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  }, [canSignTransactions, fundGatewayWallet, refreshAll]);

  if (!open) return null;

  const circleAmount = usdcBalance ?? "…";
  const gatewayAmount = gatewayBalance ?? "…";

  return (
    <>
      <button
        type="button"
        aria-label="Close wallet dashboard"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-dashboard-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-[var(--eh-border)] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--eh-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
              <Wallet className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="wallet-dashboard-title" className="text-lg font-semibold text-[var(--eh-text-primary)]">
                Wallet
              </h2>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-xl">
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Token breakdown</p>
              <WalletRow
                label="Circle wallet"
                subtitle="User-controlled · Arc Testnet"
                amount={circleAmount}
                address={walletAddress}
              />
              <WalletRow
                label="Gateway wallet"
                subtitle="x402 batching · this browser session"
                amount={gatewayAmount}
                address={gatewayAddress}
              />
            </div>

            <SurfaceCard padding="lg" className="flex flex-col items-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--eh-brand-soft)] text-2xl font-bold text-[var(--eh-brand)]">
                $
              </div>
              <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-[var(--eh-text-primary)]">
                {circleAmount} USDC
              </p>
              <p className="mt-1 text-sm text-[var(--eh-text-muted)]">Circle wallet balance</p>
              <p className="mt-2 text-xs text-[var(--eh-text-secondary)]">
                Gateway ready: {gatewayAmount} USDC
              </p>
              <div className="mt-5 flex w-full flex-col gap-2">
                {!canSignTransactions && (
                  <p className="text-xs text-amber-800">
                    Sign in again with Google to move USDC from your Circle wallet into Gateway.
                  </p>
                )}
                <Button
                  type="button"
                  className="w-full rounded-xl"
                  disabled={depositing || refreshing}
                  onClick={() => void handleDeposit()}
                >
                  {depositing ? "Processing…" : "Deposit to Gateway"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl"
                  disabled={depositing || refreshing}
                  onClick={() => void refreshAll()}
                >
                  <RefreshCw className={cn("mr-2 size-4", refreshing && "animate-spin")} aria-hidden />
                  Refresh balances
                </Button>
              </div>
            </SurfaceCard>
          </div>

          {(actionMessage || actionError) && (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                actionError
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-sky-200 bg-sky-50 text-sky-900"
              )}
            >
              {actionError ?? actionMessage}
            </div>
          )}

          <SurfaceCard padding="sm" className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--eh-text-primary)]">Need testnet USDC?</p>
              <p className="text-xs text-[var(--eh-text-muted)]">Fund your Circle wallet on Arc Testnet.</p>
            </div>
            <a
              href={ARC_FAUCET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--eh-brand)] hover:underline"
            >
              Faucet
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </SurfaceCard>

        </div>
      </aside>
    </>
  );
}
