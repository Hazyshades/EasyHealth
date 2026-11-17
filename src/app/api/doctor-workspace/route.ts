import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DOCTOR_WORKSPACE_SCOPES,
  DoctorWorkspaceError,
  approvePatientAccess,
  createClinic,
  invitePatientAccess,
  revokePatientAccess,
  updatePatientAccessScopes,
} from "@/lib/doctor-workspace/access";
import {
  acceptDoctorWorkspaceClinicianMembership,
  createDoctorWorkspaceConsultation,
  grantDoctorRecordingConsent,
  inviteDoctorWorkspaceClinician,
  listDoctorWorkspaceAccess,
  listDoctorWorkspaceClinics,
  listDoctorWorkspaceConsultations,
  listDoctorWorkspaceMemberships,
  revokeDoctorRecordingConsent,
  revokeDoctorWorkspaceClinicianMembership,
} from "@/lib/doctor-workspace/runtime";
import { getSessionIdentity } from "@/lib/auth/identity";
import {
  isDoctorWorkspaceEnabled,
  doctorWorkspacePolicyStatus,
} from "@/lib/doctor-workspace/policy";

const ScopeSchema = z.enum(DOCTOR_WORKSPACE_SCOPES);
const DateInput = z.string().datetime({ offset: true }).nullable().optional();

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_clinic"),
    name: z.string().trim().min(1).max(160),
  }),
  z.object({
    action: z.literal("invite_patient"),
    clinicId: z.string().uuid(),
    patientProfileId: z.string().uuid(),
    requestedScopes: z.array(ScopeSchema).min(1),
    expiresAt: DateInput,
  }),
  z.object({
    action: z.literal("approve_patient"),
    grantId: z.string().uuid(),
    scopes: z.array(ScopeSchema).min(1).optional(),
  }),
  z.object({
    action: z.literal("update_patient"),
    grantId: z.string().uuid(),
    scopes: z.array(ScopeSchema).min(1),
  }),
  z.object({ action: z.literal("revoke_patient"), grantId: z.string().uuid() }),
  z.object({
    action: z.literal("create_consultation"),
    clinicId: z.string().uuid(),
    patientProfileId: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
  }),
  z.object({
    action: z.literal("grant_recording_consent"),
    consultationId: z.string().uuid(),
    expiresAt: DateInput,
  }),
  z.object({
    action: z.literal("revoke_recording_consent"),
    consentId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("invite_clinician"),
    clinicId: z.string().uuid(),
    clinicianProfileId: z.string().uuid(),
    role: z.enum(["admin", "clinician"]).optional(),
  }),
  z.object({
    action: z.literal("accept_clinician"),
    membershipId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("revoke_clinician"),
    membershipId: z.string().uuid(),
  }),
]);

type WorkspaceResponse = {
  error?: string;
  data?: unknown;
};

function response(body: WorkspaceResponse, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof DoctorWorkspaceError) {
    const status =
      error.kind === "access_denied"
        ? 403
        : error.kind === "invalid_input"
          ? 400
          : error.kind === "conflict"
            ? 409
            : 503;
    return response({ error: error.kind }, status);
  }
  console.error("[doctor-workspace] request failed", error);
  return response({ error: "unavailable" }, 503);
}

async function actorOrUnauthorized(): Promise<string | NextResponse> {
  const identity = await getSessionIdentity();
  if (!identity) return response({ error: "unauthenticated" }, 401);
  if (identity.isGuest) return response({ error: "access_denied" }, 403);
  return identity.profileId;
}

export async function GET(): Promise<NextResponse> {
  const actor = await actorOrUnauthorized();
  if (actor instanceof NextResponse) return actor;
  if (!isDoctorWorkspaceEnabled(actor)) {
    return response({
      data: {
        enabled: false,
        state: "unavailable",
        actorProfileId: actor,
        policy: doctorWorkspacePolicyStatus(),
        clinics: [],
        memberships: [],
        access: [],
        consultations: [],
      },
    });
  }

  try {
    const [clinics, memberships, access, consultations] = await Promise.all([
      listDoctorWorkspaceClinics(actor),
      listDoctorWorkspaceMemberships(actor),
      listDoctorWorkspaceAccess(actor),
      listDoctorWorkspaceConsultations({ actorProfileId: actor }),
    ]);
    return response({
      data: {
        enabled: true,
        state: "ready",
        actorProfileId: actor,
        policy: doctorWorkspacePolicyStatus(),
        clinics,
        memberships,
        access,
        consultations,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const actor = await actorOrUnauthorized();
  if (actor instanceof NextResponse) return actor;
  if (!isDoctorWorkspaceEnabled(actor)) {
    return response({ error: "unavailable" }, 503);
  }

  try {
    const input = ActionSchema.parse(await request.json());
    switch (input.action) {
      case "create_clinic":
        return response(
          {
            data: await createClinic({
              actorProfileId: actor,
              name: input.name,
            }),
          },
          201,
        );
      case "invite_patient":
        return response(
          {
            data: await invitePatientAccess({
              actorProfileId: actor,
              clinicId: input.clinicId,
              patientProfileId: input.patientProfileId,
              requestedScopes: input.requestedScopes,
              expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            }),
          },
          201,
        );
      case "approve_patient":
        return response({
          data: await approvePatientAccess({
            patientProfileId: actor,
            grantId: input.grantId,
            scopes: input.scopes,
          }),
        });
      case "update_patient":
        return response({
          data: await updatePatientAccessScopes({
            patientProfileId: actor,
            grantId: input.grantId,
            scopes: input.scopes,
          }),
        });
      case "revoke_patient":
        return response({
          data: await revokePatientAccess({
            patientProfileId: actor,
            grantId: input.grantId,
          }),
        });
      case "create_consultation":
        return response(
          {
            data: await createDoctorWorkspaceConsultation({
              actorProfileId: actor,
              clinicId: input.clinicId,
              patientProfileId: input.patientProfileId,
              title: input.title,
            }),
          },
          201,
        );
      case "grant_recording_consent":
        return response(
          {
            data: await grantDoctorRecordingConsent({
              patientProfileId: actor,
              consultationId: input.consultationId,
              expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            }),
          },
          201,
        );
      case "revoke_recording_consent":
        return response({
          data: await revokeDoctorRecordingConsent({
            patientProfileId: actor,
            consentId: input.consentId,
          }),
        });
      case "invite_clinician":
        return response(
          {
            data: await inviteDoctorWorkspaceClinician({
              actorProfileId: actor,
              clinicId: input.clinicId,
              clinicianProfileId: input.clinicianProfileId,
              role: input.role,
            }),
          },
          201,
        );
      case "accept_clinician":
        return response({
          data: await acceptDoctorWorkspaceClinicianMembership({
            clinicianProfileId: actor,
            membershipId: input.membershipId,
          }),
        });
      case "revoke_clinician":
        return response({
          data: await revokeDoctorWorkspaceClinicianMembership({
            actorProfileId: actor,
            membershipId: input.membershipId,
          }),
        });
    }
  } catch (error) {
    if (error instanceof z.ZodError)
      return response({ error: "invalid_input" }, 400);
    return errorResponse(error);
  }
}
