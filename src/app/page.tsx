"use client";

import Link from "next/link";
import { useWallet } from "@/components/wallet-provider";
import { Button } from "@/components/ui/button";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

export default function LandingPage() {
  const { signInWithGoogle, loading, profileId, authError } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      {authError ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Circle sign-in error</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs">{authError}</pre>
        </div>
      ) : null}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <span className="text-xl font-bold text-teal-800">EasyHealth</span>
        {profileId ? (
          <Button asChild>
            <Link href="/app">Open health card</Link>
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
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-8 text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-teal-600">
          Wellness · EU/US · Arc Network
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          AI-powered personal health record - pay per insight
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Upload lab results, extract biomarkers automatically, track changes over time,
          and generate a clinician-ready summary - micropayments in USDC on Arc Network.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {profileId ? (
            <Button asChild size="lg">
              <Link href="/app/upload">Upload a lab - $0.01</Link>
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
            <Link href="/app/summary">Doctor summary - $0.05</Link>
          </Button>
        </div>

        <section className="mt-20 grid gap-8 text-left sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Sign in",
              text: "Circle user-controlled wallet via Google. Your keys, your wallet.",
            },
            {
              step: "2",
              title: "Pay per upload",
              text: "Drop a lab PDF or image. Pay $0.01 USDC on Arc → OCR extracts biomarkers.",
            },
            {
              step: "3",
              title: "Insights on demand",
              text: "View your health card and buy a $0.05 doctor summary when you need it.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border bg-white p-6 shadow-sm">
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
        <p className="font-medium">{MEDICAL_DISCLAIMER} For educational purposes only.</p>
        <p className="mt-2">
          Health data stays in Supabase (encrypted). Only payment receipts settle on Arc - never PHI on-chain.
        </p>
        <p className="mt-2">GDPR-aware: you control your data. EU/US wellness positioning.</p>
      </footer>
    </div>
  );
}
