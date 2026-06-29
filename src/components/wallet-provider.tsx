"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { setCookie, getCookie } from "cookies-next";
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import type { LoginCompleteCallback } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { env } from "@/lib/env-client";
import { getGatewayWalletAddress } from "@/lib/payments/gateway-client";
import { resolveProfileIdentity } from "@/lib/display-name";

const CIRCLE_USER_TOKEN_KEY = "eh_circle_user_token";
const CIRCLE_ENCRYPTION_KEY = "eh_circle_encryption_key";
const CIRCLE_WALLET_ID_KEY = "eh_circle_wallet_id";

type LoginResult = {
  userToken: string;
  encryptionKey: string;
  oauthResult?: CircleOAuthResult;
};

type CircleOAuthResult = {
  oAuthInfo?: {
    socialUserInfo?: {
      name?: string;
      email?: string;
    };
  };
};

type WalletState = {
  loading: boolean;
  walletAddress: string | null;
  usdcBalance: string | null;
  profileId: string | null;
  displayName: string | null;
  accountEmail: string | null;
  authError: string | null;
  canSignTransactions: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshAccountIdentity: () => Promise<void>;
  fundGatewayWallet: (amount: string) => Promise<void>;
};

function formatCircleLoginError(error: { code?: number; message?: string }): string {
  if (error.code === 155140) {
    return [
      "Google Client ID does not match your Circle Console settings.",
      "",
      "1. Open console.circle.com → Wallets → User Controlled → Configurator",
      "2. Authentication Methods → Social Logins → Google",
      `3. In Client ID (Web), paste exactly: ${env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}`,
      `4. App ID in .env must match Configurator: ${env.NEXT_PUBLIC_CIRCLE_APP_ID}`,
      "5. CIRCLE_API_KEY must be from the same Circle account",
      "",
      `Redirect URI in Google Console: ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}`,
    ].join("\n");
  }
  return error.message ?? "Circle social login failed";
}

async function resolveIdentityFromCircle(
  oauthResult?: CircleOAuthResult
): Promise<{ firstName: string | null; email: string | null }> {
  return resolveProfileIdentity(
    oauthResult?.oAuthInfo?.socialUserInfo?.name,
    oauthResult?.oAuthInfo?.socialUserInfo?.email
  );
}

async function loadProfileIdentity(): Promise<{
  firstName: string | null;
  email: string | null;
}> {
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return { firstName: null, email: null };
    const data = (await res.json()) as {
      display_name?: string | null;
      email?: string | null;
    };
    return {
      firstName: data.display_name?.trim() || null,
      email: data.email?.trim() || null,
    };
  } catch {
    return { firstName: null, email: null };
  }
}

const WalletContext = createContext<WalletState | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const completingLoginRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);

  const fetchWalletBalance = useCallback(async () => {
    const res = await fetch("/api/wallet/balance");
    if (!res.ok) {
      setUsdcBalance("0");
      return;
    }
    const data = await res.json();
    setUsdcBalance(data.balance ?? "0");
  }, []);

  const refreshBalance = useCallback(async () => {
    if (userToken && walletId) {
      const res = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getTokenBalance", userToken, walletId }),
      });
      const data = await res.json();
      if (res.ok) {
        const balances =
          (data.tokenBalances as Array<{ token?: { symbol?: string; name?: string }; amount?: string }>) ??
          [];
        const usdc =
          balances.find((t) => {
            const symbol = t.token?.symbol ?? "";
            const name = t.token?.name ?? "";
            return symbol.includes("USDC") || name.includes("USDC");
          }) ?? null;
        if (usdc?.amount != null) {
          setUsdcBalance(usdc.amount);
          return;
        }
      }
    }
    await fetchWalletBalance();
  }, [userToken, walletId, fetchWalletBalance]);

  const establishSession = useCallback(
    async (address: string, options?: {
      circleWalletId?: string;
      displayName?: string | null;
      email?: string | null;
    }) => {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          circleWalletId: options?.circleWalletId,
          displayName: options?.displayName ?? null,
          email: options?.email ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setProfileId(data.profileId);
      setWalletAddress(address);
      if (options?.displayName !== undefined) {
        setDisplayName(options.displayName);
      }
      if (options?.email) {
        setAccountEmail(options.email);
      }
      if (options?.displayName === undefined || !options?.email) {
        const identity = await loadProfileIdentity();
        if (options?.displayName === undefined) {
          setDisplayName(identity.firstName);
        }
        if (!options?.email && identity.email) {
          setAccountEmail(identity.email);
        }
      }
    },
    []
  );

  const loadUsdcBalance = useCallback(async () => {
    await fetchWalletBalance();
  }, [fetchWalletBalance]);

  const completeLoginFlow = useCallback(
    async (loginResult: LoginResult) => {
      if (completingLoginRef.current) return;
      completingLoginRef.current = true;
      setLoading(true);

      try {
        const sdk = sdkRef.current;
        if (!sdk) throw new Error("Wallet SDK not ready");

        sdk.setAuthentication({
          userToken: loginResult.userToken,
          encryptionKey: loginResult.encryptionKey,
        });
        setUserToken(loginResult.userToken);
        window.sessionStorage.setItem(CIRCLE_USER_TOKEN_KEY, loginResult.userToken);
        window.sessionStorage.setItem(CIRCLE_ENCRYPTION_KEY, loginResult.encryptionKey);

        const initRes = await fetch("/api/circle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "initializeUser",
            userToken: loginResult.userToken,
          }),
        });
        const initData = await initRes.json();

        if (initRes.ok && initData.challengeId) {
          await new Promise<void>((resolve, reject) => {
            sdk.execute(initData.challengeId, (error) => {
              if (error) {
                reject(new Error(error.message ?? "Wallet creation failed"));
              } else {
                resolve();
              }
            });
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else if (!initRes.ok && initRes.status !== 409) {
          throw new Error(initData.error ?? "Failed to initialize Circle user");
        }

        const walletsRes = await fetch("/api/circle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "getWallets",
            userToken: loginResult.userToken,
          }),
        });
        const walletsData = await walletsRes.json();
        if (!walletsRes.ok) {
          throw new Error(walletsData.error ?? "Failed to load wallets");
        }

        const wallet = walletsData.wallets?.[0];
        if (!wallet?.address) throw new Error("No wallet found");

        setWalletId(wallet.id);
        window.sessionStorage.setItem(CIRCLE_WALLET_ID_KEY, wallet.id);
        const identity = await resolveIdentityFromCircle(loginResult.oauthResult);
        await establishSession(wallet.address, {
          circleWalletId: wallet.id,
          displayName: identity.firstName,
          email: identity.email,
        });
        await loadUsdcBalance();
      } finally {
        completingLoginRef.current = false;
        setLoading(false);
      }
    },
    [establishSession, loadUsdcBalance]
  );

  const fundGatewayWallet = useCallback(
    async (amount: string) => {
      const sdk = sdkRef.current;
      const token =
        userToken ?? window.sessionStorage.getItem(CIRCLE_USER_TOKEN_KEY);
      const wId = walletId ?? window.sessionStorage.getItem(CIRCLE_WALLET_ID_KEY);
      if (!sdk || !token || !wId) {
        throw new Error("Sign in again with Google to fund your Gateway wallet.");
      }

      const destinationAddress = getGatewayWalletAddress();
      const res = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createTransfer",
          userToken: token,
          walletId: wId,
          destinationAddress,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start USDC transfer");
      }
      if (!data.challengeId) {
        throw new Error("Circle transfer challenge missing");
      }

      await new Promise<void>((resolve, reject) => {
        sdk.execute(data.challengeId, (error) => {
          if (error) {
            reject(new Error(error.message ?? "Transfer rejected"));
          } else {
            resolve();
          }
        });
      });
    },
    [userToken, walletId]
  );

  useEffect(() => {
    const onLoginComplete: LoginCompleteCallback = (error, result) => {
      if (error) {
        console.error("Circle social login failed:", error);
        setAuthError(formatCircleLoginError(error));
        setLoading(false);
        return;
      }
      setAuthError(null);
      if (result?.userToken && result?.encryptionKey) {
        void completeLoginFlow({
          userToken: result.userToken,
          encryptionKey: result.encryptionKey,
          oauthResult: result as CircleOAuthResult,
        });
      }
    };

    const restoredDeviceToken = (getCookie("deviceToken") as string) || "";
    const restoredDeviceEncryptionKey = (getCookie("deviceEncryptionKey") as string) || "";

    sdkRef.current = new W3SSdk(
      {
        appSettings: { appId: env.NEXT_PUBLIC_CIRCLE_APP_ID },
        loginConfigs: {
          deviceToken: restoredDeviceToken,
          deviceEncryptionKey: restoredDeviceEncryptionKey,
          google: {
            clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            redirectUri: typeof window !== "undefined" ? window.location.origin : "",
            selectAccountPrompt: true,
          },
        },
      },
      onLoginComplete
    );

    const storedUserToken = window.sessionStorage.getItem(CIRCLE_USER_TOKEN_KEY);
    const storedEncryptionKey = window.sessionStorage.getItem(CIRCLE_ENCRYPTION_KEY);
    const storedWalletId = window.sessionStorage.getItem(CIRCLE_WALLET_ID_KEY);
    if (storedUserToken && storedEncryptionKey) {
      sdkRef.current.setAuthentication({
        userToken: storedUserToken,
        encryptionKey: storedEncryptionKey,
      });
      setUserToken(storedUserToken);
      if (storedWalletId) {
        setWalletId(storedWalletId);
      } else {
        void fetch("/api/circle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getWallets", userToken: storedUserToken }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            const id = data?.wallets?.[0]?.id as string | undefined;
            if (!id) return;
            setWalletId(id);
            window.sessionStorage.setItem(CIRCLE_WALLET_ID_KEY, id);
          })
          .catch(() => undefined);
      }
    }

    fetch("/api/biomarkers")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile?.wallet_address) {
          setWalletAddress(data.profile.wallet_address);
          setProfileId(data.profile.id);
          setDisplayName(data.profile.display_name?.trim() || null);
          setAccountEmail(data.profile.email?.trim() || null);
          void fetchWalletBalance();
        }
      })
      .finally(() => setLoading(false));
  }, [completeLoginFlow, fetchWalletBalance]);

  const signInWithGoogle = useCallback(async () => {
    const sdk = sdkRef.current;
    if (!sdk) return;

    setLoading(true);
    setAuthError(null);

    try {
      const deviceId = await sdk.getDeviceId();

      const deviceRes = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createDeviceToken", deviceId }),
      });
      const deviceData = await deviceRes.json();
      if (!deviceRes.ok) throw new Error(deviceData.error ?? "Device token failed");

      setCookie("deviceToken", deviceData.deviceToken);
      setCookie("deviceEncryptionKey", deviceData.deviceEncryptionKey);

      sdk.updateConfigs({
        appSettings: { appId: env.NEXT_PUBLIC_CIRCLE_APP_ID },
        loginConfigs: {
          deviceToken: deviceData.deviceToken,
          deviceEncryptionKey: deviceData.deviceEncryptionKey,
          google: {
            clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            redirectUri: window.location.origin,
            selectAccountPrompt: true,
          },
        },
      });

      // Redirects to Google and back; onLoginComplete finishes wallet setup.
      await sdk.performLogin(SocialLoginProvider.GOOGLE);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.sessionStorage.removeItem(CIRCLE_USER_TOKEN_KEY);
    window.sessionStorage.removeItem(CIRCLE_ENCRYPTION_KEY);
    window.sessionStorage.removeItem(CIRCLE_WALLET_ID_KEY);
    setWalletAddress(null);
    setProfileId(null);
    setDisplayName(null);
    setAccountEmail(null);
    setUsdcBalance(null);
    setUserToken(null);
    setWalletId(null);
    setAuthError(null);
  }, []);

  const canSignTransactions = Boolean(userToken && walletId);

  const refreshAccountIdentity = useCallback(async () => {
    const identity = await loadProfileIdentity();
    setDisplayName(identity.firstName);
    if (identity.email) setAccountEmail(identity.email);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        loading,
        walletAddress,
        usdcBalance,
        profileId,
        displayName,
        accountEmail,
        authError,
        canSignTransactions,
        signInWithGoogle,
        signOut,
        refreshBalance,
        refreshAccountIdentity,
        fundGatewayWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
