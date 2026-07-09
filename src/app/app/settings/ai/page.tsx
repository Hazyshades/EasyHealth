"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import {
  AI_PROVIDER_HINTS,
  AI_PROVIDER_IDS,
  AI_PROVIDER_LABELS,
  type AiProviderId,
} from "@/lib/ai-provider";

type ProfileResponse = {
  ai_provider: AiProviderId;
  openai_available: boolean;
  deepseek_available: boolean;
  owl_alpha_available: boolean;
  nebius_fast_available: boolean;
  nebius_quality_available: boolean;
};

function isProviderAvailable(provider: AiProviderId, availability: ProfileResponse): boolean {
  if (provider === "openai") return availability.openai_available;
  if (provider === "deepseek") return availability.deepseek_available;
  if (provider === "owl_alpha") return availability.owl_alpha_available;
  if (provider === "nebius_fast") return availability.nebius_fast_available;
  return availability.nebius_quality_available;
}

function providerUnavailableHint(provider: AiProviderId): string {
  if (provider === "deepseek") return "DeepSeek is not configured on this server.";
  if (provider === "owl_alpha") return "Tencent Hy3 (OpenRouter) is not configured on this server.";
  if (provider === "nebius_fast" || provider === "nebius_quality") {
    return "Nebius is not configured on this server.";
  }
  return "This provider is not available.";
}

export default function AiSettingsPage() {
  const [aiProvider, setAiProvider] = useState<AiProviderId>("openai");
  const [availability, setAvailability] = useState<ProfileResponse>({
    ai_provider: "openai",
    openai_available: true,
    deepseek_available: false,
    owl_alpha_available: false,
    nebius_fast_available: false,
    nebius_quality_available: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load AI settings");
        }
        return res.json() as Promise<ProfileResponse>;
      })
      .then((data) => {
        setAiProvider(data.ai_provider);
        setAvailability(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load AI settings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_provider: aiProvider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save AI settings");
      }

      setAiProvider(data.ai_provider);
      setAvailability(data);
      setMessage("AI provider updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save AI settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--eh-text-secondary)]">Loading AI settings…</p>;
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        subtitle="Choose which model EasyHealth uses for extraction and reports"
        compact
        actions={
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href="/app/settings">Back to Settings</Link>
          </Button>
        }
      />

      <SurfaceCard className="space-y-5 p-5">
        <p className="text-sm text-[var(--eh-text-secondary)]">
          Processing uses the app&apos;s secure server keys. You do not need to enter an API key.
        </p>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[var(--eh-text-primary)]">Provider</legend>
          {AI_PROVIDER_IDS.map((provider) => {
            const disabled = !isProviderAvailable(provider, availability);
            return (
              <label
                key={provider}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                  aiProvider === provider
                    ? "border-[var(--eh-brand)]/40 bg-[var(--eh-brand-soft)]/30"
                    : "border-[var(--eh-border)]"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="ai_provider"
                  value={provider}
                  checked={aiProvider === provider}
                  disabled={disabled}
                  onChange={() => setAiProvider(provider)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--eh-text-primary)]">
                    {AI_PROVIDER_LABELS[provider]}
                  </span>
                  {AI_PROVIDER_HINTS[provider] ? (
                    <span className="mt-0.5 block text-xs text-[var(--eh-text-muted)]">
                      {AI_PROVIDER_HINTS[provider]}
                    </span>
                  ) : null}
                  {disabled ? (
                    <span className="mt-0.5 block text-xs text-[var(--eh-text-muted)]">
                      {providerUnavailableHint(provider)}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--eh-brand)]">{message}</p> : null}

        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </SurfaceCard>
    </div>
  );
}
