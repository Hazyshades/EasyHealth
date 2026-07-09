"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const { signInWithMagicLink } = useAuth();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    if (!email) {
      setError("Missing email address. Go back and try again.");
      return;
    }
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      await signInWithMagicLink(email);
      setMessage("A new magic link was sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
        <p className="mt-3 text-sm text-slate-600">
          {email ? (
            <>
              We sent a magic link to <span className="font-medium text-slate-900">{email}</span>.
              Open the link on this device to finish signing in.
            </>
          ) : (
            <>We sent a magic link to your email. Open it to finish signing in.</>
          )}
        </p>
        {message ? <p className="mt-4 text-sm text-teal-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-8 flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={resending || !email}
            onClick={() => void handleResend()}
            className="rounded-xl"
          >
            {resending ? "Sending…" : "Resend magic link"}
          </Button>
          <Button asChild variant="ghost" className="rounded-xl">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
