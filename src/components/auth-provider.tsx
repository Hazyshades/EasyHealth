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
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { resolveProfileIdentity } from "@/lib/display-name";

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
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccountIdentity: () => Promise<void>;
};

type ProfileIdentity = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileId: string | null;
  profileStatus: "ready" | "unavailable";
};

const profileResponseSchema = z.object({
  id: z.string().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const unavailableProfileIdentity: ProfileIdentity = {
  firstName: null,
  lastName: null,
  email: null,
  profileId: null,
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
  const [authError, setAuthError] = useState<string | null>(null);
  const appliedUserIdRef = useRef<string | null>(null);

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
        return;
      }

      setAuthUserId(user.id);
      setProfileStatus("unknown");
      storeOAuthPrefill(user);
      const fallbackIdentity = resolveProfileIdentity(
        getOAuthPrefillName(user),
        user.email,
      );

      if (knowledgeBaseRoute) {
        setProfileId(null);
        setProfileStatus("unknown");
        setDisplayName(fallbackIdentity.firstName);
        setLastName(fallbackIdentity.lastName);
        setAccountEmail(fallbackIdentity.email ?? user.email ?? null);
      } else {
        const identity = await loadProfileIdentity();
        setProfileStatus(identity.profileStatus);
        setProfileId(identity.profileId);
        setDisplayName(identity.firstName ?? fallbackIdentity.firstName);
        setLastName(identity.lastName ?? fallbackIdentity.lastName);
        setAccountEmail(identity.email ?? fallbackIdentity.email ?? user.email ?? null);
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
    authError,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
    refreshAccountIdentity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
