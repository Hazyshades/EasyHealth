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

export async function processDoctorRetention(): Promise<number> {
  const actor = workerEnv.eh170RetentionDeleteActor;
  if (!workerEnv.eh170RetentionLaunchAllowed() || !isUuid(actor)) return 0;
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
    if (recording.storage_path) {
      const { error } = await supabase.storage
        .from(DOCTOR_RECORDINGS_BUCKET)
        .remove([recording.storage_path]);
      if (error) {
        console.error(
          "Dictaphone audio retention delete failed",
          error.message,
        );
        continue;
      }
    }
    const { error } = await supabase.rpc("eh170_retention_mark_audio_deleted", {
      p_actor_profile_id: actor,
      p_recording_id: recording.recording_id,
    });
    if (error) {
      console.error(
        "Dictaphone audio retention state update failed",
        error.message,
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
