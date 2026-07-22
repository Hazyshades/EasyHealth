"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveProfileIdentity } from "@/lib/display-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const OAUTH_PREFILL_KEY = "eh_oauth_prefill_name";

export default function OnboardingProfilePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prefill = window.sessionStorage.getItem(OAUTH_PREFILL_KEY);
    if (prefill) {
      const identity = resolveProfileIdentity(prefill);
      if (identity.firstName) setFirstName(identity.firstName);
      if (identity.lastName) setLastName(identity.lastName);
    }

    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
      })
      .then((data) => {
        if (data.first_name?.trim()) {
          if (data.terms_accepted_at) {
            router.replace("/app");
          } else {
            router.replace("/onboarding/consent");
          }
          return;
        }
        if (data.first_name) setFirstName(data.first_name);
        if (data.last_name) setLastName(data.last_name);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load profile"),
      )
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setError("Enter your first name.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: trimmedFirst,
          last_name: lastName.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save profile");
      }

      window.sessionStorage.removeItem(OAUTH_PREFILL_KEY);
      router.push("/onboarding/consent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="mx-auto h-8 w-3/4" />
        <Skeleton className="mx-auto h-4 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-center text-2xl font-bold text-[var(--eh-text-primary)]">
        Complete your profile
      </h1>
      <p className="mt-2 text-center text-sm text-[var(--eh-text-secondary)]">
        Enter your name to finish registration
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="first-name"
            className="text-sm font-medium text-[var(--eh-text-primary)]"
          >
            First name <span className="text-red-500">*</span>
          </label>
          <Input
            id="first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
            autoComplete="given-name"
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="last-name"
            className="text-sm font-medium text-[var(--eh-text-primary)]"
          >
            Last name
          </label>
          <Input
            id="last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter your last name (optional)"
            autoComplete="family-name"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          type="submit"
          disabled={saving || !firstName.trim()}
          size="lg"
          className="h-11 w-full rounded-xl border-0 bg-[var(--eh-brand)] font-semibold text-white shadow-sm hover:bg-[var(--eh-brand)]/90 disabled:bg-[var(--eh-brand)]/50 disabled:text-white disabled:opacity-100"
        >
          {saving ? "Saving…" : "Complete registration"}
        </Button>
      </form>
    </div>
  );
}
