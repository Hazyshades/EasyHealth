export function resolveProfileIdentity(name?: string | null, email?: string | null) {
  const trimmedName = name?.trim();
  const parts = trimmedName ? trimmedName.split(/\s+/).filter(Boolean) : [];
  const firstName = parts[0] ?? null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  const trimmedEmail = email?.trim() || null;
  return { firstName, lastName, email: trimmedEmail };
}

/** @deprecated Use resolveProfileIdentity + menuDisplayLabel */
export function extractFirstName(name?: string | null, email?: string | null): string | null {
  return resolveProfileIdentity(name, email).firstName;
}

function emailLocalPart(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

export function menuDisplayLabel(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
  if (first) return first;
  if (email?.trim()) return emailLocalPart(email.trim());
  return "Account";
}

export function menuDisplayInitial(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const label = menuDisplayLabel(firstName, lastName, email);
  return label.charAt(0).toUpperCase();
}

export function greetingLabel(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
  if (first) return first;
  if (email?.trim()) return emailLocalPart(email.trim());
  return "there";
}
