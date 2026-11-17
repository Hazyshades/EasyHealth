"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ProfileResponse = {
  id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  is_guest?: boolean;
  guest_expires_at?: string | null;
  guest_deletion_state?: "active" | "deleting" | "completed";
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AccountPage() {
  const {
    refreshAccountIdentity,
    linkGuestEmail,
    signOut,
  } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [firstNameInput, setFirstNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestMessage, setGuestMessage] = useState<string | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

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
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load account"),
      )
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

  async function handleGuestEmailLink() {
    const email = guestEmail.trim();
    if (!email) {
      setGuestError("Enter an email address.");
      return;
    }
    setGuestBusy(true);
    setGuestError(null);
    setGuestMessage(null);
    try {
      await linkGuestEmail(email);
      setGuestMessage("Check your email to finish saving your data.");
    } catch (caught) {
      setGuestError(
        caught instanceof Error ? caught.message : "Email linking failed",
      );
    } finally {
      setGuestBusy(false);
    }
  }

  async function handleGuestDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setGuestBusy(true);
    setGuestError(null);
    try {
      const response = await fetch("/api/guest/delete", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGuestError(data.error ?? "Guest deletion is temporarily unavailable");
        return;
      }
      await signOut();
    } catch (caught) {
      setGuestError(
        caught instanceof Error
          ? caught.message
          : "Guest deletion is temporarily unavailable",
      );
    } finally {
      setGuestBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          title="Account"
          subtitle="Manage your account details"
          compact
        />
        <SurfaceCard className="space-y-4 p-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-24" />
        </SurfaceCard>
        <SurfaceCard className="space-y-3 p-5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </SurfaceCard>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader title="Account" subtitle="Sign-in details for your EasyHealth account" compact />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <p className="text-sm text-red-600">
        Unable to load account information.
      </p>
    );
  }

  const hasFirstName = Boolean(profile.display_name?.trim());
  const guestIsActive =
    profile.is_guest && (profile.guest_deletion_state ?? "active") === "active";

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Account" subtitle="Sign-in details for your EasyHealth account" compact />

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
          {error && profile ? (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          ) : null}
        </div>
        {profile.is_guest ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
              Email
            </p>
            <p className="mt-1 text-sm text-[var(--eh-text-primary)]">
              No email identity is linked to this guest profile.
            </p>
          </div>
        ) : (
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
        )}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
            Member since
          </p>
          <p className="mt-1 text-sm text-[var(--eh-text-primary)]">
            {formatDate(profile.created_at)}
          </p>
        </div>
      </SurfaceCard>

      {profile.is_guest ? (
        <>
          <SurfaceCard className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-[var(--eh-text-primary)]">
                Save my data
              </h2>
              <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
                Guest data is stored on the server for this profile. The
                configured inactivity window is 30 days by default; the
                deadline moves after meaningful activity, and unconverted data
                is deleted when it expires. Clearing browser data can end
                access unless you save the profile first.
              </p>
              {profile.guest_expires_at ? (
                <p className="mt-2 text-xs text-[var(--eh-text-secondary)]">
                  Current retention deadline: {formatDate(profile.guest_expires_at)}
                </p>
              ) : null}
            </div>
            <div className="space-y-3">
              <Input
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={!guestIsActive || guestBusy}
                className="max-w-sm rounded-xl"
              />
              <Button
                onClick={() => void handleGuestEmailLink()}
                disabled={!guestIsActive || guestBusy || !guestEmail.trim()}
                className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
              >
                {guestBusy ? "Working…" : "Save with email"}
              </Button>
            </div>
            {guestMessage ? (
              <p className="text-sm text-[var(--eh-brand)]">{guestMessage}</p>
            ) : null}
            {guestError ? (
              <p className="text-sm text-red-600">{guestError}</p>
            ) : null}
          </SurfaceCard>

          <SurfaceCard className="space-y-3 border-red-200 p-5">
            <div>
              <h2 className="text-base font-semibold text-red-700">
                Delete guest data
              </h2>
              <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
                This permanently removes the guest profile, documents,
                derived data, and stored files. It cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void handleGuestDelete()}
              disabled={!guestIsActive || guestBusy}
              className="w-fit rounded-xl border-red-300 text-red-700 hover:bg-red-50"
            >
              {deleteArmed ? "Confirm permanent deletion" : "Delete guest data"}
            </Button>
            {deleteArmed ? (
              <p className="text-xs text-red-700">
                Select the confirmation action again to queue deletion and sign
                out.
              </p>
            ) : null}
          </SurfaceCard>
        </>
      ) : null}
    </div>
  );
}
