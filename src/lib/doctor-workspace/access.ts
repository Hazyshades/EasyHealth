import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const Uuid = z.string().uuid();

export const DOCTOR_WORKSPACE_SCOPES = [
  "health_profile",
  "observations",
  "reports",
  "documents",
  "consultations",
] as const;

export type DoctorWorkspaceScope = (typeof DOCTOR_WORKSPACE_SCOPES)[number];
export type DoctorWorkspaceOperation =
  | "read"
  | "create"
  | "update"
  | "review"
  | "export"
  | "delete";

const ScopeSchema = z.enum(DOCTOR_WORKSPACE_SCOPES);
const AccessRowSchema = z.object({
  allowed: z.boolean(),
  grant_id: Uuid.nullable(),
  reason: z.string().nullable(),
});
const ClinicCreationSchema = z.object({
  clinic_id: Uuid,
  membership_id: Uuid,
});
const GrantSchema = z.object({
  grant_id: Uuid,
  state: z.enum(["pending", "active", "expired", "revoked", "declined"]),
  scopes: z.array(ScopeSchema),
  requested_scopes: z.array(ScopeSchema),
  expires_at: z.string().nullable(),
});
const RevokedGrantSchema = z.object({
  grant_id: Uuid,
  state: z.enum(["pending", "active", "expired", "revoked", "declined"]),
  revoked_at: z.string().nullable(),
});
const ExpiredGrantSchema = z.object({
  grant_id: Uuid,
  state: z.literal("expired"),
});

export type DoctorWorkspaceGrant = z.infer<typeof GrantSchema>;
export type DoctorWorkspaceAuthorization = z.infer<typeof AccessRowSchema>;

export class DoctorWorkspaceError extends Error {
  readonly kind: "access_denied" | "invalid_input" | "conflict" | "unavailable";

  constructor(
    kind: DoctorWorkspaceError["kind"],
    message = "Doctor workspace operation unavailable",
  ) {
    super(message);
    this.name = "DoctorWorkspaceError";
    this.kind = kind;
  }
}

function firstRpcRow<T>(schema: z.ZodType<T>, data: unknown): T {
  const candidate = Array.isArray(data) ? data[0] : data;
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    throw new DoctorWorkspaceError("unavailable");
  }
  return parsed.data;
}

function classifyRpcError(message: string): DoctorWorkspaceError {
  const normalized = message.toLowerCase();
  if (normalized.includes("access_denied")) {
    return new DoctorWorkspaceError("access_denied");
  }
  if (
    normalized.includes("scope_invalid") ||
    normalized.includes("input_invalid")
  ) {
    return new DoctorWorkspaceError("invalid_input");
  }
  if (normalized.includes("grant_exists")) {
    return new DoctorWorkspaceError("conflict");
  }
  return new DoctorWorkspaceError("unavailable");
}

function assertUuid(value: string): void {
  if (!Uuid.safeParse(value).success) {
    throw new DoctorWorkspaceError("invalid_input");
  }
}

function assertScopes(scopes: readonly DoctorWorkspaceScope[]): void {
  if (
    scopes.length === 0 ||
    new Set(scopes).size !== scopes.length ||
    scopes.some((scope) => !ScopeSchema.safeParse(scope).success)
  ) {
    throw new DoctorWorkspaceError("invalid_input");
  }
}

async function callRpc<T>(
  schema: z.ZodType<T>,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) throw classifyRpcError(error.message);
  return firstRpcRow(schema, data);
}

export async function resolveDoctorWorkspaceAccess(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    patientProfileId: string;
    scope: DoctorWorkspaceScope;
    operation?: DoctorWorkspaceOperation;
  }>,
): Promise<DoctorWorkspaceAuthorization> {
  assertUuid(input.actorProfileId);
  assertUuid(input.clinicId);
  assertUuid(input.patientProfileId);
  ScopeSchema.parse(input.scope);

  return callRpc(AccessRowSchema, "eh170_authorize_patient_access", {
    p_actor_profile_id: input.actorProfileId,
    p_clinic_id: input.clinicId,
    p_patient_profile_id: input.patientProfileId,
    p_scope: input.scope,
    p_operation: input.operation ?? "read",
  });
}

export async function requireDoctorWorkspaceAccess(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    patientProfileId: string;
    scope: DoctorWorkspaceScope;
    operation?: DoctorWorkspaceOperation;
  }>,
): Promise<string> {
  const decision = await resolveDoctorWorkspaceAccess(input);
  if (!decision.allowed || !decision.grant_id) {
    throw new DoctorWorkspaceError("access_denied");
  }
  return decision.grant_id;
}

export async function createClinic(
  input: Readonly<{
    actorProfileId: string;
    name: string;
  }>,
): Promise<{ clinicId: string; membershipId: string }> {
  assertUuid(input.actorProfileId);
  if (input.name.trim().length === 0 || input.name.trim().length > 160) {
    throw new DoctorWorkspaceError("invalid_input");
  }
  const result = await callRpc(ClinicCreationSchema, "eh170_create_clinic", {
    p_actor_profile_id: input.actorProfileId,
    p_name: input.name,
  });
  return { clinicId: result.clinic_id, membershipId: result.membership_id };
}

export async function invitePatientAccess(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    patientProfileId: string;
    requestedScopes: readonly DoctorWorkspaceScope[];
    expiresAt?: Date | null;
  }>,
): Promise<DoctorWorkspaceGrant> {
  assertUuid(input.actorProfileId);
  assertUuid(input.clinicId);
  assertUuid(input.patientProfileId);
  assertScopes(input.requestedScopes);
  const result = await callRpc(GrantSchema, "eh170_invite_patient_access", {
    p_actor_profile_id: input.actorProfileId,
    p_clinic_id: input.clinicId,
    p_patient_profile_id: input.patientProfileId,
    p_requested_scopes: [...input.requestedScopes],
    p_expires_at: input.expiresAt?.toISOString() ?? null,
  });
  return result;
}

export async function approvePatientAccess(
  input: Readonly<{
    patientProfileId: string;
    grantId: string;
    scopes?: readonly DoctorWorkspaceScope[];
  }>,
): Promise<DoctorWorkspaceGrant> {
  assertUuid(input.patientProfileId);
  assertUuid(input.grantId);
  if (input.scopes) assertScopes(input.scopes);
  return callRpc(GrantSchema, "eh170_approve_patient_access", {
    p_patient_profile_id: input.patientProfileId,
    p_grant_id: input.grantId,
    p_scopes: input.scopes ? [...input.scopes] : null,
  });
}

export async function updatePatientAccessScopes(
  input: Readonly<{
    patientProfileId: string;
    grantId: string;
    scopes: readonly DoctorWorkspaceScope[];
  }>,
): Promise<DoctorWorkspaceGrant> {
  assertUuid(input.patientProfileId);
  assertUuid(input.grantId);
  assertScopes(input.scopes);
  return callRpc(GrantSchema, "eh170_update_patient_access_scopes", {
    p_patient_profile_id: input.patientProfileId,
    p_grant_id: input.grantId,
    p_scopes: [...input.scopes],
  });
}

export async function revokePatientAccess(
  input: Readonly<{
    patientProfileId: string;
    grantId: string;
  }>,
): Promise<z.infer<typeof RevokedGrantSchema>> {
  assertUuid(input.patientProfileId);
  assertUuid(input.grantId);
  return callRpc(RevokedGrantSchema, "eh170_revoke_patient_access", {
    p_patient_profile_id: input.patientProfileId,
    p_grant_id: input.grantId,
  });
}

export async function expirePatientAccess(
  grantId: string,
): Promise<z.infer<typeof ExpiredGrantSchema> | null> {
  assertUuid(grantId);
  const { data, error } = await createAdminClient().rpc(
    "eh170_expire_patient_access",
    { p_grant_id: grantId },
  );
  if (error) throw classifyRpcError(error.message);
  if (data === null || (Array.isArray(data) && data.length === 0)) return null;
  return firstRpcRow(ExpiredGrantSchema, data);
}
