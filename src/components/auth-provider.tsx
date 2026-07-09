"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { resolveProfileIdentity } from "@/lib/display-name";

const OAUTH_PREFILL_KEY = "eh_oauth_prefill_name";

type AuthState = {
  loading: boolean;
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

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** @deprecated Use useAuth */
export function useWallet() {
  return useAuth();
}

async function loadProfileIdentity(): Promise<{
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileId: string | null;
}> {
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return { firstName: null, lastName: null, email: null, profileId: null };
    const data = (await res.json()) as {
      id?: string;
      first_name?: string | null;
      last_name?: string | null;
      display_name?: string | null;
      email?: string | null;
    };
    return {
      profileId: data.id ?? null,
      firstName: data.first_name?.trim() || data.display_name?.trim() || null,
      lastName: data.last_name?.trim() || null,
      email: data.email?.trim() || null,
    };
  } catch {
    return { firstName: null, lastName: null, email: null, profileId: null };
  }
}

function storeOAuthPrefill(user: User | null) {
  if (!user || typeof window === "undefined") return;
  const metaName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    null;
  if (metaName) {
    window.sessionStorage.setItem(OAUTH_PREFILL_KEY, metaName);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const applyIdentity = useCallback(async (user: User | null) => {
    if (!user) {
      setProfileId(null);
      setDisplayName(null);
      setLastName(null);
      setAccountEmail(null);
      return;
    }

    storeOAuthPrefill(user);
    const identity = await loadProfileIdentity();
    if (identity.profileId) {
      setProfileId(identity.profileId);
      setDisplayName(identity.firstName);
      setLastName(identity.lastName);
      setAccountEmail(identity.email ?? user.email ?? null);
    } else {
      // Profile API may 401 briefly; fall back to auth user
      const meta = resolveProfileIdentity(
        (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          null,
        user.email
      );
      setProfileId(user.id);
      setDisplayName(meta.firstName);
      setLastName(meta.lastName);
      setAccountEmail(meta.email);
    }
  }, []);

  const refreshAccountIdentity = useCallback(async () => {
    const identity = await loadProfileIdentity();
    if (identity.profileId) {
      setProfileId(identity.profileId);
      setDisplayName(identity.firstName);
      setLastName(identity.lastName);
      setAccountEmail(identity.email);
    }
  }, []);

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyIdentity(session?.user ?? null);
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
    [supabase]
  );

  const signOut = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // ignore
    }
    setProfileId(null);
    setDisplayName(null);
    setLastName(null);
    setAccountEmail(null);
    window.location.href = "/";
  }, [supabase]);

  const value: AuthState = {
    loading,
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
