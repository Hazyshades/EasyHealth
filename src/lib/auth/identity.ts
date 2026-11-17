import { cache } from "react";
import { getProfileById, type ProfileRow } from "@/lib/auth/profile";
import {
  isActiveGuestProfileSession,
  isGuestDeletionStateWritable,
} from "@/lib/guest-mode";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SessionIdentity = {
  userId: string;
  profileId: string;
  profile: ProfileRow;
  isGuest: boolean;
};

export const getSessionIdentity = cache(async (): Promise<SessionIdentity | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getProfileById(user.id);
  return {
    userId: user.id,
    profileId: profile.id,
    profile,
    isGuest: profile.account_type === "guest",
  };
});

export async function getGuestSessionIdentity(): Promise<SessionIdentity | null> {
  const identity = await getSessionIdentity();
  if (!identity?.isGuest) return null;
  return identity;
}

export function isWritableSessionIdentity(
  identity: SessionIdentity,
): boolean {
  return (
    isGuestDeletionStateWritable(
      identity.isGuest,
      identity.profile.guest_deletion_state,
    ) &&
    (!identity.isGuest || isActiveGuestProfileSession(identity.profile))
  );
}

export async function getWritableSessionIdentity(): Promise<SessionIdentity | null> {
  const identity = await getSessionIdentity();
  return identity && isWritableSessionIdentity(identity) ? identity : null;
}

export async function getWritableSessionProfileId(): Promise<string | null> {
  return (await getWritableSessionIdentity())?.profileId ?? null;
}
