import { workerEnv } from "./env.js";
import { supabase } from "./supabase.js";

const DOCTOR_RECORDINGS_BUCKET = "doctor-recordings";

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function cutoff(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
type RetentionAudioIntent = {
  recording_id: string;
  storage_path: string | null;
  source_audio_deleted_at: string | null;
};

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return (data as T | null) ?? null;
}


export async function processDoctorRetention(): Promise<number> {
  const actor = workerEnv.eh170RetentionDeleteActor;
  if (!workerEnv.eh170RetentionLaunchAllowed() || !isUuid(actor)) return 0;
  const { data: actorIsValid, error: actorValidationError } = await supabase.rpc(
    "eh170_retention_actor_is_valid",
    { p_actor_profile_id: actor },
  );
  if (actorValidationError)
    throw new Error(
      `Dictaphone retention actor validation failed: ${actorValidationError.message}`,
    );
  if (actorIsValid !== true) return 0;
  let deleted = 0;

  const audioBefore = cutoff(workerEnv.eh170RecordingRetentionDays);
  const { data: recordings, error: recordingsError } = await supabase.rpc(
    "eh170_retention_list_audio_candidates",
    { p_before: audioBefore },
  );
  if (recordingsError)
    throw new Error(
      `Dictaphone audio retention query failed: ${recordingsError.message}`,
    );
  for (const recording of recordings ?? []) {
    const { data: intentData, error: intentError } = await supabase.rpc(
      "eh170_retention_prepare_audio_delete",
      {
        p_actor_profile_id: actor,
        p_recording_id: recording.recording_id,
        p_before: audioBefore,
      },
    );
    if (intentError) {
      console.error(
        "Dictaphone audio retention intent failed",
        intentError.message,
      );
      continue;
    }
    const intent = firstRow<RetentionAudioIntent>(intentData);
    if (!intent || intent.source_audio_deleted_at) continue;
    if (!intent.storage_path) {
      console.error(
        "Dictaphone audio retention intent returned no storage path",
        recording.recording_id,
      );
      continue;
    }
    const { error: storageError } = await supabase.storage
      .from(DOCTOR_RECORDINGS_BUCKET)
      .remove([intent.storage_path]);
    if (storageError) {
      console.error(
        "Dictaphone audio retention delete failed",
        storageError.message,
      );
      continue;
    }
    const { error: markError } = await supabase.rpc(
      "eh170_retention_mark_audio_deleted",
      {
        p_actor_profile_id: actor,
        p_recording_id: recording.recording_id,
      },
    );
    if (markError) {
      console.error(
        "Dictaphone audio retention state update failed",
        markError.message,
      );
      continue;
    }
    deleted += 1;
  }

  const transcriptBefore = cutoff(workerEnv.eh170TranscriptRetentionDays);
  const { data: transcripts, error: transcriptsError } = await supabase.rpc(
    "eh170_retention_list_transcript_candidates",
    { p_before: transcriptBefore },
  );
  if (transcriptsError)
    throw new Error(
      `Dictaphone transcript retention query failed: ${transcriptsError.message}`,
    );
  for (const transcript of transcripts ?? []) {
    const { error } = await supabase.rpc("eh170_retention_delete_transcript", {
      p_actor_profile_id: actor,
      p_transcript_id: transcript.transcript_id,
    });
    if (error) {
      console.error(
        "Dictaphone transcript retention delete failed",
        error.message,
      );
      continue;
    }
    deleted += 1;
  }

  const noteBefore = cutoff(workerEnv.eh170NoteRetentionDays);
  const { data: revisions, error: revisionsError } = await supabase.rpc(
    "eh170_retention_list_note_candidates",
    { p_before: noteBefore },
  );
  if (revisionsError)
    throw new Error(
      `Dictaphone note retention query failed: ${revisionsError.message}`,
    );
  for (const revision of revisions ?? []) {
    const { error } = await supabase.rpc(
      "eh170_retention_delete_note_revision",
      {
        p_actor_profile_id: actor,
        p_revision_id: revision.revision_id,
      },
    );
    if (error) {
      console.error("Dictaphone note retention delete failed", error.message);
      continue;
    }
    deleted += 1;
  }

  return deleted;
}
