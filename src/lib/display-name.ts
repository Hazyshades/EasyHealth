export function resolveProfileIdentity(name?: string | null, email?: string | null) {
  const trimmedName = name?.trim();
  const firstName = trimmedName ? trimmedName.split(/\s+/)[0] || null : null;
  const trimmedEmail = email?.trim() || null;
  return { firstName, email: trimmedEmail };
}

/** @deprecated Use resolveProfileIdentity + menuDisplayLabel */
export function extractFirstName(name?: string | null, email?: string | null): string | null {
  return resolveProfileIdentity(name, email).firstName;
}

function emailLocalPart(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

export function menuDisplayLabel(firstName?: string | null, email?: string | null): string {
  if (firstName?.trim()) return firstName.trim();
  if (email?.trim()) return emailLocalPart(email.trim());
  return "Account";
}

export function menuDisplayInitial(firstName?: string | null, email?: string | null): string {
  const label = menuDisplayLabel(firstName, email);
  return label.charAt(0).toUpperCase();
}
