"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEGAL_LINKS } from "@/lib/legal-links";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type RequiredConsents = {
  terms: boolean;
  privacy: boolean;
  health_data: boolean;
  ai_processing: boolean;
};

type OptionalConsents = {
  analytics: boolean;
  personalization: boolean;
  marketing_email: boolean;
  marketing_cookies: boolean;
};

export default function OnboardingConsentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [required, setRequired] = useState<RequiredConsents>({
    terms: true,
    privacy: true,
    health_data: true,
    ai_processing: true,
  });
  const [optional, setOptional] = useState<OptionalConsents>({
    analytics: true,
    personalization: true,
    marketing_email: true,
    marketing_cookies: true,
  });

  const allRequiredChecked =
    required.terms &&
    required.privacy &&
    required.health_data &&
    required.ai_processing;

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
      })
      .then((data) => {
        if (!data.first_name?.trim()) {
          router.replace("/onboarding/profile");
          return;
        }
        if (data.terms_accepted_at) {
          router.replace("/app");
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load profile"),
      )
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allRequiredChecked) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consents: {
            terms: true,
            privacy: true,
            health_data: true,
            ai_processing: true,
            ...optional,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save consent");
      }
      router.push("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save consent");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  return (
    <div className="max-h-[85vh] overflow-y-auto pr-1">
      <h1 className="text-2xl font-bold text-[var(--eh-text-primary)]">
        Your privacy and health data choices
      </h1>
      <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
        EasyHealth helps you organize, understand, and track the health
        information you choose to provide. Health information is sensitive, and
        we treat it with additional care.
      </p>
      <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
        EasyHealth is not a medical provider. Information in the app is for
        educational purposes only and is not a diagnosis, treatment plan, or
        substitute for advice from a qualified healthcare professional.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
            Required to create and use your account
          </p>

          {(
            [
              {
                key: "terms" as const,
                title: "I agree to the Terms of Service.",
                body: "I agree to use EasyHealth under the Terms of Service.",
              },
              {
                key: "privacy" as const,
                title: "I have read and understood the Privacy Policy.",
                body: "I understand how EasyHealth collects, uses, stores, shares, and protects my personal data, and how I can exercise my privacy rights.",
              },
              {
                key: "health_data" as const,
                title:
                  "I explicitly consent to the processing of my health data.",
                body: "I consent to EasyHealth processing health-related information I provide, upload, or connect to the app for summaries, insights, tracking, and personalized health features.",
              },
              {
                key: "ai_processing" as const,
                title:
                  "I explicitly consent to AI-assisted processing of my health data.",
                body: "I understand that EasyHealth may use AI models and trusted service providers to analyze my health information. AI-generated content may be incomplete or inaccurate and should not be used as the sole basis for medical decisions.",
              },
            ] as const
          ).map((item) => (
            <div
              key={item.key}
              className="flex gap-3 rounded-xl border border-[var(--eh-border)] p-4"
            >
              <input
                id={item.key}
                type="checkbox"
                checked={required[item.key]}
                onChange={(e) =>
                  setRequired((prev) => ({
                    ...prev,
                    [item.key]: e.target.checked,
                  }))
                }
                className="mt-1 size-4 shrink-0 accent-[var(--eh-brand)]"
              />
              <div className="space-y-1">
                <label htmlFor={item.key} className="font-medium leading-snug">
                  {item.title}
                </label>
                <p className="text-sm text-[var(--eh-text-secondary)]">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
            Optional -you can change these later
          </p>

          {(
            [
              { key: "analytics" as const, title: "Product analytics" },
              {
                key: "personalization" as const,
                title: "Personalized experience",
              },
              {
                key: "marketing_email" as const,
                title: "Marketing communications",
              },
              {
                key: "marketing_cookies" as const,
                title: "Marketing and advertising cookies",
              },
            ] as const
          ).map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <input
                id={item.key}
                type="checkbox"
                checked={optional[item.key]}
                onChange={(e) =>
                  setOptional((prev) => ({
                    ...prev,
                    [item.key]: e.target.checked,
                  }))
                }
                className="size-4 accent-[var(--eh-brand)]"
              />
              <label htmlFor={item.key}>{item.title}</label>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--eh-text-secondary)]">
          You can withdraw consent or change optional preferences at any time in
          Settings. If you withdraw consent for health data or AI-assisted
          processing, some features may no longer work.
        </p>

        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href={LEGAL_LINKS.privacy}
            className="text-[var(--eh-brand)] underline"
          >
            Privacy Policy
          </Link>
          <Link
            href={LEGAL_LINKS.terms}
            className="text-[var(--eh-brand)] underline"
          >
            Terms of Service
          </Link>
          <Link
            href={LEGAL_LINKS.cookies}
            className="text-[var(--eh-brand)] underline"
          >
            Cookie Policy
          </Link>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          type="submit"
          disabled={saving || !allRequiredChecked}
          size="lg"
          className="h-11 w-full rounded-xl border-0 bg-[var(--eh-brand)] font-semibold text-white shadow-sm hover:bg-[var(--eh-brand)]/90 disabled:bg-[var(--eh-brand)]/50 disabled:text-white disabled:opacity-100"
        >
          {saving ? "Saving…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}
