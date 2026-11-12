"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getAuthCallbackErrorMessage } from "@/lib/auth/callback-redirect";
import { Input } from "@/components/ui/input";
import styles from "./auth-entry-page.module.css";

function AuthEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError =
    searchParams.get("signin") === "error"
      ? getAuthCallbackErrorMessage(searchParams.get("reason"))
      : null;
  const {
    signInWithGoogle,
    signInWithMagicLink,
    refreshAccountIdentity,
    loading,
    authUserId,
    profileStatus,
    authError,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [profileRetrying, setProfileRetrying] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const profileReady = profileStatus === "ready";
  const profileError =
    profileStatus === "unavailable"
      ? "Your health profile is temporarily unavailable. Try again or contact support."
      : null;
  const visibleAuthError = authError ?? callbackError ?? profileError;

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSending(true);
    try {
      await signInWithMagicLink(email);
      router.push(
        `/login/check-email?email=${encodeURIComponent(email.trim())}`,
      );
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : "Failed to send magic link",
      );
    } finally {
      setEmailSending(false);
    }
  }

  async function handleProfileRetry() {
    setProfileRetrying(true);
    try {
      await refreshAccountIdentity();
    } finally {
      setProfileRetrying(false);
    }
  }

  return (
    <div className={styles.page}>
      {visibleAuthError ? (
        <div className={styles.errorBanner} role="alert">
          <p className={styles.errorTitle}>Sign-in error</p>
          <p className={styles.errorMessage}>{visibleAuthError}</p>
        </div>
      ) : null}

      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="EasyHealth home">
          <span className={styles.wordmarkMark} aria-hidden="true">
            E
          </span>
          <span>easyhealth</span>
        </Link>
        <Link href="/" className={styles.headerLink}>
          Back to home
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.authLayout}>
          <section className={styles.intro} aria-labelledby="login-heading">
            <p className={styles.kicker}>Your personal health record</p>
            <h1 id="login-heading" className={styles.title}>
              Keep your health history together.
            </h1>
            <p className={styles.lede}>
              Return to your source-linked record and continue where you left
              off.
            </p>
          </section>

          <section
            className={styles.authCard}
            aria-labelledby="sign-in-heading"
          >
            <p className={styles.cardKicker}>Welcome back</p>
            <h2 id="sign-in-heading" className={styles.cardTitle}>
              Sign in
            </h2>
            <p className={styles.cardCopy}>
              Use Google or an email magic link to open your record.
            </p>

            {!authUserId ? (
              <>
                <button
                  type="button"
                  className={styles.googleButton}
                  onClick={async () => {
                    try {
                      await signInWithGoogle();
                    } catch (e) {
                      console.error(e);
                      alert(e instanceof Error ? e.message : "Sign-in failed");
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? "Loading…" : "Sign in with Google"}
                </button>

                <div className={styles.divider} aria-hidden="true">
                  <span>or</span>
                </div>

                <form onSubmit={handleMagicLink} className={styles.form}>
                  <label htmlFor="email" className={styles.label}>
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={styles.input}
                  />
                  {emailError ? (
                    <p className={styles.emailError}>{emailError}</p>
                  ) : null}
                  <button
                    type="submit"
                    className={styles.emailButton}
                    disabled={emailSending || loading}
                  >
                    {emailSending ? "Sending link…" : "Email me a magic link"}
                  </button>
                </form>
              </>
            ) : profileReady ? (
              <div className={styles.accountState}>
                <p>Your account is ready.</p>
                <Link href="/app" className={styles.primaryLink}>
                  Open dashboard
                </Link>
              </div>
            ) : (
              <div className={styles.accountState}>
                <p>Your account needs one more check before you continue.</p>
                <button
                  type="button"
                  className={styles.emailButton}
                  onClick={() => void handleProfileRetry()}
                  disabled={profileRetrying}
                >
                  {profileRetrying ? "Checking profile…" : "Retry profile"}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function AuthEntryPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
      <AuthEntryContent />
    </Suspense>
  );
}
