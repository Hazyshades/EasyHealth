"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";
import { UserMenu } from "@/components/user-menu";
import { WalletAccountTrigger } from "@/components/wallet-account-trigger";
import { WalletDashboardDrawer } from "@/components/wallet-dashboard-drawer";
import { Button } from "@/components/ui/button";
import { resolvePageMeta } from "@/lib/navigation";
import { getGatewayBalance, getGatewayWalletAddress } from "@/lib/payments/gateway-client";
import { cn } from "@/lib/utils";

export function TopBar() {
  const pathname = usePathname();
  const { walletAddress, usdcBalance, displayName, accountEmail, refreshBalance, fundGatewayWallet, canSignTransactions, signOut } = useWallet();
  const [gatewayBalance, setGatewayBalance] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);

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
  const gatewayAddress = getGatewayWalletAddress();

  return (
    <>
      <header className="topbar flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#E8EEF5] bg-white px-10">
        <div className="min-w-0">
          <h1 className="eh-page-title truncate">
            {meta.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {walletAddress && (
            <WalletAccountTrigger
              walletAddress={walletAddress}
              usdcBalance={usdcBalance}
              gatewayBalance={gatewayBalance}
              open={walletOpen}
              onClick={() => setWalletOpen(true)}
            />
          )}

          {walletAddress && <UserMenu displayName={displayName} email={accountEmail} />}

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

      {walletAddress && (
        <WalletDashboardDrawer
          open={walletOpen}
          onClose={() => setWalletOpen(false)}
          walletAddress={walletAddress}
          gatewayAddress={gatewayAddress}
          usdcBalance={usdcBalance}
          gatewayBalance={gatewayBalance}
          refreshBalance={refreshBalance}
          fundGatewayWallet={fundGatewayWallet}
          canSignTransactions={canSignTransactions}
          onGatewayBalanceChange={setGatewayBalance}
        />
      )}
    </>
  );
}
