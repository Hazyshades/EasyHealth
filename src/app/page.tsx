"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getAuthCallbackErrorMessage } from "@/lib/auth/callback-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

function LandingPageContent() {
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
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      {visibleAuthError ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Sign-in error</p>
          <p className="mt-2 whitespace-pre-wrap font-sans text-xs">
            {visibleAuthError}
          </p>
        </div>
      ) : null}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6">
        <span className="text-xl font-bold text-teal-800">EasyHealth</span>
        <div className="flex items-center gap-2">
          <Link
            href="/knowledge"
            className="rounded-md px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            Knowledge Base
          </Link>
          {profileReady ? (
            <Button asChild>
              <Link href="/app">Open dashboard</Link>
            </Button>
          ) : authUserId ? (
            <Button onClick={() => void handleProfileRetry()} disabled={profileRetrying}>
              {profileRetrying ? "Checking profile…" : "Retry profile"}
            </Button>
          ) : (
            <Button
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
              {loading ? "Loading…" : "Get started"}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-8 text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-teal-600">
          Wellness · EU/US
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          AI-powered personal health record
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Upload lab results, extract biomarkers automatically, track changes
          over time, and generate educational clinician-ready summaries — free
          for your account.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {profileReady ? (
            <Button asChild size="lg">
              <Link href="/app/upload?type=lab_result">Upload a lab</Link>
            </Button>
          ) : authUserId ? (
            <Button size="lg" onClick={() => void handleProfileRetry()} disabled={profileRetrying}>
              {profileRetrying ? "Checking profile…" : "Retry profile"}
            </Button>
          ) : (
            <Button
              size="lg"
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
              Sign in with Google
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <Link href="/app/profile">Health Profile</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/app/biomarkers">Biomarkers</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/app/reports">Health reports</Link>
          </Button>
        </div>

        {!authUserId ? (
          <form
            onSubmit={handleMagicLink}
            className="mx-auto mt-8 flex max-w-md flex-col gap-3 rounded-xl border bg-white p-6 text-left shadow-sm"
          >
            <p className="text-sm font-medium text-slate-800">
              Or continue with email
            </p>
            <p className="text-xs text-muted-foreground">
              We will send a magic link — no password required.
            </p>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="rounded-xl"
            />
            {emailError ? (
              <p className="text-sm text-red-600">{emailError}</p>
            ) : null}
            <Button
              type="submit"
              disabled={emailSending || loading}
              className="rounded-xl"
            >
              {emailSending ? "Sending link…" : "Email me a magic link"}
            </Button>
          </form>
        ) : null}

        <section className="mt-20 grid gap-8 text-left sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Sign in",
              text: "Google or email magic link. Your health data stays tied to your account.",
            },
            {
              step: "2",
              title: "Upload free",
              text: "Drop a lab PDF or image. OCR extracts biomarkers automatically.",
            },
            {
              step: "3",
              title: "Insights on demand",
              text: "View your health profile, biomarker trends, and educational reports anytime.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">
                {item.step}
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t bg-white px-4 py-8 text-center text-xs text-muted-foreground">
        <p className="font-medium">
          {MEDICAL_DISCLAIMER} For educational purposes only.
        </p>
        <p className="mt-2">Health data encrypted.</p>
        <p className="mt-2">
          GDPR-aware: you control your data. EU/US wellness positioning.
        </p>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}
