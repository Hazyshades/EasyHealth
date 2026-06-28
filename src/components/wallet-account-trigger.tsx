"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function walletInitials(address: string): string {
  return address.slice(2, 4).toUpperCase();
}

type WalletAccountTriggerProps = {
  walletAddress: string;
  usdcBalance: string | null;
  gatewayBalance: string | null;
  open: boolean;
  onClick: () => void;
};

export function WalletAccountTrigger({
  walletAddress,
  usdcBalance,
  gatewayBalance,
  open,
  onClick,
}: WalletAccountTriggerProps) {
  const short = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
  const gatewayReady = gatewayBalance ?? "…";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`Wallet ${short}, ${usdcBalance ?? "loading"} USDC, Gateway ${gatewayReady} ready`}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-[var(--eh-border)] bg-white px-2.5 py-1.5",
        "text-left shadow-xs transition-[background-color,transform,box-shadow] duration-150 ease-out",
        "hover:bg-[var(--eh-canvas-bg)] active:scale-[0.98]",
        open && "border-[var(--eh-brand)]/30 bg-[var(--eh-brand-soft)]/40 shadow-sm"
      )}
    >
      
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold tabular-nums text-[var(--eh-text-primary)]">
          {usdcBalance ?? "…"} USDC
        </span>
        <span className="block text-xs text-[var(--eh-text-muted)]">
          Gateway: {gatewayReady}
        </span>
      </span>
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-[var(--eh-text-muted)] transition-transform duration-150",
          open && "rotate-180"
        )}
        aria-hidden
      />
    </button>
  );
}
