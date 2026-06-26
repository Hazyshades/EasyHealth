"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { env } from "@/lib/env-client";

type WalletState = {
  loading: boolean;
  walletAddress: string | null;
  usdcBalance: string | null;
  profileId: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshBalance: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!userToken || !walletId) return;
    const res = await fetch("/api/circle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getTokenBalance", userToken, walletId }),
    });
    const data = await res.json();
    const balances = (data.tokenBalances as Array<{ token?: { symbol?: string }; amount?: string }>) ?? [];
    const usdc = balances.find((t) => t.token?.symbol?.includes("USDC"));
    setUsdcBalance(usdc?.amount ?? "0");
  }, [userToken, walletId]);

  const establishSession = useCallback(
    async (address: string, circleWalletId?: string) => {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, circleWalletId }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setProfileId(data.profileId);
      setWalletAddress(address);
    },
    []
  );

  useEffect(() => {
    sdkRef.current = new W3SSdk({
      appSettings: { appId: env.NEXT_PUBLIC_CIRCLE_APP_ID },
    });

    fetch("/api/biomarkers")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile?.wallet_address) {
          setWalletAddress(data.profile.wallet_address);
          setProfileId(data.profile.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!sdkRef.current) return;
    setLoading(true);

    try {
      const deviceId = await sdkRef.current.getDeviceId();

      const deviceRes = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createDeviceToken", deviceId }),
      });
      const deviceData = await deviceRes.json();
      if (!deviceRes.ok) throw new Error(deviceData.error ?? "Device token failed");

      const oauthToken = await new Promise<string>((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) {
          reject(new Error("Google OAuth not loaded"));
          return;
        }
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          scope: "openid email profile",
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(new Error(response.error ?? "Google sign-in failed"));
            } else {
              resolve(response.access_token);
            }
          },
        });
        client.requestAccessToken();
      });

      const loginRes = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "socialLogin",
          deviceToken: deviceData.deviceToken,
          deviceId,
          oauthToken,
        }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error ?? "Circle login failed");

      setUserToken(loginData.userToken);

      const walletsRes = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getWallets", userToken: loginData.userToken }),
      });
      const walletsData = await walletsRes.json();
      const wallet = walletsData.wallets?.[0];
      if (!wallet?.address) throw new Error("No wallet found");

      setWalletId(wallet.id);
      sdkRef.current?.setAuthentication({
        userToken: loginData.userToken,
        encryptionKey: loginData.encryptionKey,
      });
      await establishSession(wallet.address, wallet.id);

      const balRes = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getTokenBalance",
          userToken: loginData.userToken,
          walletId: wallet.id,
        }),
      });
      const balData = await balRes.json();
      const balances = (balData.tokenBalances as Array<{ token?: { symbol?: string }; amount?: string }>) ?? [];
      const usdc = balances.find((t) => t.token?.symbol?.includes("USDC"));
      setUsdcBalance(usdc?.amount ?? "0");
    } finally {
      setLoading(false);
    }
  }, [establishSession, refreshBalance]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setWalletAddress(null);
    setProfileId(null);
    setUsdcBalance(null);
    setUserToken(null);
    setWalletId(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        loading,
        walletAddress,
        usdcBalance,
        profileId,
        signInWithGoogle,
        signOut,
        refreshBalance,
      }}
    >
      <script src="https://accounts.google.com/gsi/client" async defer />
      {children}
    </WalletContext.Provider>
  );
}
