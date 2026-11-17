"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { isAnonymousAuthUser, isPublicGuestModeEnabled } from "@/lib/guest-mode";
import { resolveProfileIdentity } from "@/lib/display-name";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const OAUTH_PREFILL_KEY = "eh_oauth_prefill_name";

export type ProfileStatus = "unknown" | "ready" | "unavailable";

type AuthState = {
  loading: boolean;
  authUserId: string | null;
  profileStatus: ProfileStatus;
  profileId: string | null;
  displayName: string | null;
  lastName: string | null;
  accountEmail: string | null;
  isGuest: boolean;
  guestDeletionState: "active" | "deleting" | "completed" | null;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  linkGuestEmail: (email: string) => Promise<void>;
  linkGuestWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccountIdentity: () => Promise<void>;
};

type ProfileIdentity = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileId: string | null;
  isGuest: boolean;
  guestDeletionState: "active" | "deleting" | "completed" | null;
  profileStatus: "ready" | "unavailable";
};

const profileResponseSchema = z.object({
  id: z.string().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  is_guest: z.boolean().optional(),
  guest_deletion_state: z
    .enum(["active", "deleting", "completed"])
    .nullable()
    .optional(),
});

const unavailableProfileIdentity: ProfileIdentity = {
  firstName: null,
  lastName: null,
  email: null,
  profileId: null,
  isGuest: false,
  guestDeletionState: null,
  profileStatus: "unavailable",
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function loadProfileIdentity(): Promise<ProfileIdentity> {
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return unavailableProfileIdentity;
    const data = profileResponseSchema.parse(await res.json());
    if (!data.id) return unavailableProfileIdentity;
    return {
      profileId: data.id,
      firstName: data.first_name?.trim() || data.display_name?.trim() || null,
      lastName: data.last_name?.trim() || null,
      email: data.email?.trim() || null,
      isGuest: data.is_guest === true,
      guestDeletionState: data.guest_deletion_state ?? null,
      profileStatus: "ready",
    };
  } catch {
    return unavailableProfileIdentity;
  }
}

function getOAuthPrefillName(user: User | null): string | null {
  if (!user) return null;
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName) return fullName;
  const name = user.user_metadata?.name;
  return typeof name === "string" && name ? name : null;
}
function guestLinkErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("manual linking") || message.includes("not enabled")) {
    return "Account linking is not enabled for this sign-in provider.";
  }
  if (
    message.includes("already") ||
    message.includes("exists") ||
    message.includes("identity")
  ) {
    return "That identity is already linked to another account. Sign in to that account, or choose a different email or Google identity.";
  }
  return fallback;
}
async function assertGuestLinkAllowed(): Promise<void> {
  const response = await fetch("/api/guest/convert", {
    method: "POST",
    headers: { "Cache-Control": "no-store" },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Guest data cannot be saved right now");
  }
}

function storeOAuthPrefill(user: User | null) {
  if (!user || typeof window === "undefined") return;
  const metaName = getOAuthPrefillName(user);
  if (metaName) {
    window.sessionStorage.setItem(OAUTH_PREFILL_KEY, metaName);
  }
}

function isKnowledgeBaseRoute(pathname: string | null): boolean {
  return (
    pathname === "/knowledge" ||
    (typeof pathname === "string" && pathname.startsWith("/knowledge/"))
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const knowledgeBaseRoute = isKnowledgeBaseRoute(pathname);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("unknown");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestDeletionState, setGuestDeletionState] = useState<
    "active" | "deleting" | "completed" | null
  >(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const appliedUserIdRef = useRef<string | null>(null);
  const guestInitializationRef = useRef<Promise<void> | null>(null);

  const applyIdentity = useCallback(
    async (user: User | null) => {
      if (!user) {
        appliedUserIdRef.current = null;
        setAuthUserId(null);
        setProfileStatus("unknown");
        setProfileId(null);
        setDisplayName(null);
        setLastName(null);
        setAccountEmail(null);
        setIsGuest(false);
        setGuestDeletionState(null);
        return;
      }

      setAuthUserId(user.id);
      setProfileStatus("unknown");
      storeOAuthPrefill(user);
      const fallbackIdentity = resolveProfileIdentity(
        getOAuthPrefillName(user),
        user.email,
      );
      if (isAnonymousAuthUser(user)) {
        await guestInitializationRef.current?.catch(() => undefined);
      }

      if (knowledgeBaseRoute) {
        setProfileId(null);
        setProfileStatus("unknown");
        setDisplayName(fallbackIdentity.firstName);
        setLastName(fallbackIdentity.lastName);
        setAccountEmail(fallbackIdentity.email ?? user.email ?? null);
        setIsGuest(false);
        setGuestDeletionState(null);
      } else {
        const identity = await loadProfileIdentity();
        setProfileStatus(identity.profileStatus);
        setProfileId(identity.profileId);
        setDisplayName(identity.firstName ?? fallbackIdentity.firstName);
        setLastName(identity.lastName ?? fallbackIdentity.lastName);
        setAccountEmail(identity.email ?? fallbackIdentity.email ?? user.email ?? null);
        setIsGuest(identity.isGuest);
        setGuestDeletionState(identity.guestDeletionState);
      }
      appliedUserIdRef.current = user.id;
    },
    [knowledgeBaseRoute],
  );

  const refreshAccountIdentity = useCallback(async () => {
    if (knowledgeBaseRoute) return;
    const identity = await loadProfileIdentity();
    setProfileStatus(identity.profileStatus);
    setProfileId(identity.profileId);
    if (identity.firstName !== null) setDisplayName(identity.firstName);
    if (identity.lastName !== null) setLastName(identity.lastName);
    if (identity.email !== null) setAccountEmail(identity.email);
    setIsGuest(identity.isGuest);
    setGuestDeletionState(identity.guestDeletionState);
  }, [knowledgeBaseRoute]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      await applyIdentity(session?.user ?? null);
      if (mounted) setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      const userId = user?.id ?? null;
      if (
        (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") &&
        appliedUserIdRef.current === userId
      ) {
        return;
      }
      void applyIdentity(user);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, applyIdentity]);

  useEffect(() => {
    if (!isGuest || guestDeletionState !== "active" || !pathname?.startsWith("/app")) {
      return;
    }

    const sendActivity = () => {
      void fetch("/api/guest/activity", {
        method: "POST",
        headers: { "Cache-Control": "no-store" },
      }).catch(() => undefined);
    };
    sendActivity();
    const interval = window.setInterval(sendActivity, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [guestDeletionState, isGuest, pathname]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, [supabase]);

  const signInWithMagicLink = useCallback(
    async (email: string) => {
      setAuthError(null);
      const trimmed = email.trim();
      if (!trimmed) {
        const err = new Error("Enter your email address");
        setAuthError(err.message);
        throw err;
      }
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        setAuthError(error.message);
        throw error;
      }
    },
    [supabase],
  );

  const signInAsGuest = useCallback(async () => {
    setAuthError(null);
    if (!isPublicGuestModeEnabled()) {
      const error = new Error("Guest mode is not available");
      setAuthError(error.message);
      throw error;
    }

    const prepareResponse = await fetch("/api/auth/guest/prepare", {
      method: "POST",
      headers: { "Cache-Control": "no-store" },
    });
    const prepareBody = await prepareResponse.json().catch(() => ({}));
    if (!prepareResponse.ok) {
      const error = new Error(prepareBody.error ?? "Guest sign-in is unavailable");
      setAuthError(error.message);
      throw error;
    }

    const initializationPromise = Promise.resolve().then(async () => {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;

      const initializeResponse = await fetch("/api/auth/guest/initialize", {
        method: "POST",
        headers: { "Cache-Control": "no-store" },
      });
      const initializeBody = await initializeResponse.json().catch(() => ({}));
      if (!initializeResponse.ok) {
        throw new Error(initializeBody.error ?? "Guest profile is unavailable");
      }
    });
    guestInitializationRef.current = initializationPromise;
    try {
      await initializationPromise;
    } catch (error) {
      await fetch("/api/auth/guest/initialize", {
        method: "DELETE",
        headers: { "Cache-Control": "no-store" },
      }).catch(() => undefined);
      await supabase.auth.signOut();
      const message =
        error instanceof Error ? error.message : "Guest sign-in is unavailable";
      setAuthError(message);
      throw error;
    } finally {
      if (guestInitializationRef.current === initializationPromise) {
        guestInitializationRef.current = null;
      }
    }
    await refreshAccountIdentity();
  }, [refreshAccountIdentity, supabase]);

  const linkGuestEmail = useCallback(
    async (email: string) => {
      setAuthError(null);
      const trimmed = email.trim();
      if (!trimmed) {
        const error = new Error("Enter an email address");
        setAuthError(error.message);
        throw error;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isAnonymousAuthUser(user)) {
        const error = new Error("Only an active guest can save data this way");
        setAuthError(error.message);
        throw error;
      }
      try {
        await assertGuestLinkAllowed();
      } catch (error) {
        const safeError = new Error(
          guestLinkErrorMessage(error, "Guest data cannot be saved right now"),
        );
        setAuthError(safeError.message);
        throw safeError;
      }
      const { error } = await supabase.auth.updateUser(
        { email: trimmed },
        {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      );
      if (error) {
        const safeError = new Error(
          guestLinkErrorMessage(error, "Email linking failed"),
        );
        setAuthError(safeError.message);
        throw safeError;
      }
    },
    [supabase],
  );

  const linkGuestWithGoogle = useCallback(async () => {
    setAuthError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isAnonymousAuthUser(user)) {
      const error = new Error("Only an active guest can save data this way");
      setAuthError(error.message);
      throw error;
    }
    try {
      await assertGuestLinkAllowed();
    } catch (error) {
      const safeError = new Error(
        guestLinkErrorMessage(error, "Guest data cannot be saved right now"),
      );
      setAuthError(safeError.message);
      throw safeError;
    }
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      const safeError = new Error(
        guestLinkErrorMessage(error, "Google linking failed"),
      );
      setAuthError(safeError.message);
      throw safeError;
    }
    if (!data?.url) {
      const error = new Error("Google account linking did not start");
      setAuthError(error.message);
      throw error;
    }
    window.location.assign(data.url);
  }, [supabase]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // ignore
    }
    setAuthUserId(null);
    setProfileStatus("unknown");
    setProfileId(null);
    setDisplayName(null);
    setLastName(null);
    setAccountEmail(null);
    setIsGuest(false);
    setGuestDeletionState(null);
    window.location.href = "/";
  }, [supabase]);

  const value: AuthState = {
    loading,
    authUserId,
    profileStatus,
    profileId,
    displayName,
    lastName,
    accountEmail,
    isGuest,
    guestDeletionState,
    authError,
    signInWithGoogle,
    signInWithMagicLink,
    signInAsGuest,
    linkGuestEmail,
    linkGuestWithGoogle,
    signOut,
    refreshAccountIdentity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
