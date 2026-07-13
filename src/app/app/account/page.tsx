"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ProfileResponse = {
  id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AccountPage() {
  const { refreshAccountIdentity } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [firstNameInput, setFirstNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load account");
        }
        return res.json();
      })
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load account"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveFirstName() {
    const trimmed = firstNameInput.trim();
    if (!trimmed) {
      setError("Enter your first name.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save first name");
      }

      setProfile(data);
      setFirstNameInput("");
      setSaveMessage("Name saved.");
      await refreshAccountIdentity();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save first name");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--eh-text-secondary)]">Loading account…</p>;
  }

  if (error && !profile) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-red-600">Unable to load account information.</p>;
  }

  const hasFirstName = Boolean(profile.display_name?.trim());

  return (
    <div className="space-y-6 pb-8">
      <PageHeader subtitle="Sign-in details for your EasyHealth account" compact />

      <SurfaceCard className="space-y-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
            Name
          </p>
          {hasFirstName ? (
            <p className="mt-1 text-sm font-semibold text-[var(--eh-text-primary)]">
              {profile.display_name}
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              <Input
                value={firstNameInput}
                onChange={(e) => setFirstNameInput(e.target.value)}
                placeholder="e.g. Leo"
                maxLength={120}
                className="max-w-sm rounded-xl"
                autoComplete="given-name"
              />
              <Button
                onClick={() => void handleSaveFirstName()}
                disabled={saving || !firstNameInput.trim()}
                className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
              >
                {saving ? "Saving…" : "Save first name"}
              </Button>
            </div>
          )}
          {saveMessage ? (
            <p className="mt-2 text-sm text-[var(--eh-brand)]">{saveMessage}</p>
          ) : null}
          {error && profile ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
            Email
          </p>
          <p className="mt-1 text-sm text-[var(--eh-text-primary)]">
            {profile.email?.trim() || "Not set"}
          </p>
          <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
            Email comes from your sign-in provider and is not editable here.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
            Member since
          </p>
          <p className="mt-1 text-sm text-[var(--eh-text-primary)]">
            {formatDate(profile.created_at)}
          </p>
        </div>
      </SurfaceCard>
    </div>
  );
}
