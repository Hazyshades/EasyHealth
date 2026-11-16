import { env } from "@/lib/env";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DoctorWorkspacePolicyStatus = Readonly<{
  clinicEnabled: boolean;
  dictaphoneEnabled: boolean;
  transcriptionApproved: boolean;
  retentionConfigured: boolean;
  deletionActorConfigured: boolean;
  rolloutCohortConfigured: boolean;
  launchAllowed: boolean;
}>;

function rolloutProfileIds(): string[] {
  return env.EH170_ROLLOUT_PROFILE_IDS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function cohortAllows(profileId: string): boolean {
  const cohort = rolloutProfileIds();
  if (cohort.length > 0) return cohort.includes(profileId);
  return process.env.NODE_ENV !== "production";
}

export function doctorWorkspacePolicyStatus(): DoctorWorkspacePolicyStatus {
  const transcriptionApproved =
    env.EH170_TRANSCRIPTION_DPA_APPROVED &&
    env.EH170_TRANSCRIPTION_REGION_APPROVED;
  const retentionConfigured =
    env.EH170_RECORDING_RETENTION_DAYS > 0 &&
    env.EH170_TRANSCRIPT_RETENTION_DAYS > 0 &&
    env.EH170_NOTE_RETENTION_DAYS > 0;
  const deletionActorConfigured =
    env.EH170_RETENTION_DELETE_ACTOR !== undefined &&
    UUID_PATTERN.test(env.EH170_RETENTION_DELETE_ACTOR);
  const rolloutCohortConfigured = rolloutProfileIds().length > 0;
  const launchAllowed =
    transcriptionApproved && retentionConfigured && deletionActorConfigured;

  return {
    clinicEnabled: env.EH170_CLINIC_WORKSPACE_ENABLED,
    dictaphoneEnabled: env.EH170_DICTAPHONE_ENABLED,
    transcriptionApproved,
    retentionConfigured,
    deletionActorConfigured,
    rolloutCohortConfigured,
    launchAllowed,
  };
}

export function isDoctorWorkspaceEnabled(profileId: string): boolean {
  return env.EH170_CLINIC_WORKSPACE_ENABLED && cohortAllows(profileId);
}

export function isDictaphoneEnabled(profileId: string): boolean {
  const policy = doctorWorkspacePolicyStatus();
  return (
    isDoctorWorkspaceEnabled(profileId) &&
    env.EH170_DICTAPHONE_ENABLED &&
    policy.launchAllowed
  );
}
