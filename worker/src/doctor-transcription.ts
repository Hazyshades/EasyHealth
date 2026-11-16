import { workerEnv } from "./env.js";
import { supabase } from "./supabase.js";

const DOCTOR_RECORDINGS_BUCKET = "doctor-recordings";
const PROVIDER_TIMEOUT_MS = 120_000;

type ClaimedRecording = {
  recording_id: string;
  consultation_id: string;
  clinic_id: string;
  patient_profile_id: string;
  clinician_profile_id: string;
  storage_path: string;
  source_language: string | null;
  attempt_number: number;
  lease_token: string;
  lease_expires_at: string;
};

type FailureCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_rejected"
  | "audio_unavailable"
  | "access_revoked";

type ProviderResult = {
  text: string;
  sourceLanguage: string | null;
};

class ProviderFailure extends Error {
  constructor(
    readonly code: Exclude<FailureCode, "access_revoked">,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "ProviderFailure";
  }
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return (data as T | null) ?? null;
}

async function claimRecording(): Promise<ClaimedRecording | null> {
  const { data, error } = await supabase.rpc(
    "eh170_claim_recording_transcription",
    {
      p_worker_id: workerEnv.instanceId,
    },
  );
  if (error) throw new Error(`Dictaphone claim failed: ${error.message}`);
  return firstRow<ClaimedRecording>(data);
}

async function failRecording(
  recording: ClaimedRecording,
  code: FailureCode,
  retryable: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("eh170_fail_recording_transcription", {
    p_recording_id: recording.recording_id,
    p_lease_token: recording.lease_token,
    p_failure_code: code,
    p_retryable: retryable,
  });
  if (error)
    console.error("Dictaphone failure state update failed", error.message);
}

async function transcribeWithOpenAi(
  recording: ClaimedRecording,
  audio: Blob,
): Promise<ProviderResult> {
  const form = new FormData();
  form.append(
    "file",
    audio,
    recording.storage_path.split("/").at(-1) ?? "recording.webm",
  );
  form.append("model", workerEnv.eh170TranscriptionModel);
  form.append("response_format", "json");
  if (recording.source_language)
    form.append("language", recording.source_language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${workerEnv.openaiApiKey}` },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProviderFailure("provider_timeout", true);
    }
    throw new ProviderFailure("provider_unavailable", true);
  } finally {
    clearTimeout(timeout);
  }

  if (
    response.status === 408 ||
    response.status === 429 ||
    response.status >= 500
  ) {
    throw new ProviderFailure(
      response.status === 408 ? "provider_timeout" : "provider_unavailable",
      true,
    );
  }
  if (!response.ok) throw new ProviderFailure("provider_rejected", false);

  const payload = (await response.json()) as {
    text?: unknown;
    language?: unknown;
  };
  if (typeof payload.text !== "string" || payload.text.trim().length === 0) {
    throw new ProviderFailure("provider_rejected", false);
  }
  return {
    text: payload.text,
    sourceLanguage:
      typeof payload.language === "string"
        ? payload.language
        : recording.source_language,
  };
}

async function transcribe(
  recording: ClaimedRecording,
): Promise<ProviderResult> {
  const { data: audio, error } = await supabase.storage
    .from(DOCTOR_RECORDINGS_BUCKET)
    .download(recording.storage_path);
  if (error || !audio) throw new ProviderFailure("audio_unavailable", true);
  if (workerEnv.eh170TranscriptionProvider !== "openai") {
    throw new ProviderFailure("provider_rejected", false);
  }
  return transcribeWithOpenAi(recording, audio);
}

export async function processOneRecordingTranscription(): Promise<boolean> {
  if (!workerEnv.eh170TranscriptionLaunchAllowed()) return false;
  const recording = await claimRecording();
  if (!recording) return false;

  try {
    const result = await transcribe(recording);
    const { error } = await supabase.rpc(
      "eh170_complete_recording_transcription",
      {
        p_recording_id: recording.recording_id,
        p_lease_token: recording.lease_token,
        p_transcript_text: result.text,
        p_source_language: result.sourceLanguage,
        p_provider: workerEnv.eh170TranscriptionProvider,
        p_model: workerEnv.eh170TranscriptionModel,
      },
    );
    if (error) {
      if (error.message.toLowerCase().includes("access_denied")) {
        await failRecording(recording, "access_revoked", false);
      } else {
        await failRecording(recording, "provider_unavailable", true);
      }
    }
  } catch (error) {
    const failure =
      error instanceof ProviderFailure
        ? error
        : new ProviderFailure("provider_unavailable", true);
    await failRecording(recording, failure.code, failure.retryable);
  }
  return true;
}
