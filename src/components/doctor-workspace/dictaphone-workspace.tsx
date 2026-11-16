"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/ui/status-chip";

type Consultation = {
  consultation_id: string;
  clinic_id: string;
  patient_profile_id: string;
  patient_name: string;
  clinician_profile_id: string;
  clinician_name: string;
  title: string;
  status: string;
};

type Recording = {
  recording_id: string;
  consultation_id: string;
  status: string;
  source_language: string | null;
  failure_code: string | null;
  transcription_retryable: boolean;
  source_audio_deleted_at: string | null;
  transcript_status: string | null;
  latest_note_status: string | null;
  created_at: string;
  updated_at: string;
};

type RecordingDetail = Recording & {
  transcript_text: string | null;
  transcript_source_language: string | null;
  latest_note: {
    id?: string;
    status?: string;
    content?: Record<string, unknown>;
    source_references?: unknown[];
  } | null;
};

type WorkspaceData = {
  enabled: boolean;
  consultations: Consultation[];
};

async function getWorkspace(): Promise<WorkspaceData> {
  const response = await fetch("/api/doctor-workspace", { cache: "no-store" });
  const payload = (await response.json()) as {
    data?: WorkspaceData;
    error?: string;
  };
  if (!response.ok || !payload.data)
    throw new Error(payload.error ?? "unavailable");
  return payload.data;
}

async function getRecordings(consultationId: string): Promise<Recording[]> {
  const response = await fetch(
    `/api/doctor-workspace/recordings?consultationId=${encodeURIComponent(consultationId)}`,
    { cache: "no-store" },
  );
  const payload = (await response.json()) as {
    data?: Recording[];
    error?: string;
  };
  if (!response.ok || !payload.data)
    throw new Error(payload.error ?? "unavailable");
  return payload.data;
}

async function postRecording(body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch("/api/doctor-workspace/recordings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { data?: unknown; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "unavailable");
  return payload.data;
}

export function DictaphoneWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState("");
  const [selectedRecording, setSelectedRecording] =
    useState<RecordingDetail | null>(null);
  const [noteText, setNoteText] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkspace();
      setWorkspace(data);
      setSelectedConsultation(
        (current) => current || data.consultations[0]?.consultation_id || "",
      );
      if (data.consultations[0]?.consultation_id) {
        setRecordings(
          await getRecordings(data.consultations[0].consultation_id),
        );
      } else {
        setRecordings([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [load]);

  async function refreshRecordings(consultationId = selectedConsultation) {
    if (!consultationId) return;
    setRecordings(await getRecordings(consultationId));
  }

  async function selectConsultation(value: string) {
    setSelectedConsultation(value);
    setSelectedRecording(null);
    setError(null);
    try {
      await refreshRecordings(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    }
  }

  async function startRecording() {
    if (!selectedConsultation) return;
    setWorking(true);
    setError(null);
    let recordingId: string | null = null;
    let stream: MediaStream | null = null;
    try {
      const result = (await postRecording({
        action: "start",
        consultationId: selectedConsultation,
      })) as { recording_id: string };
      recordingId = result.recording_id;
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!window.MediaRecorder) throw new Error("recording_unavailable");
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        void uploadRecording(recordingId!, blob);
        stream?.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
      });
      mediaStream.current = stream;
      mediaRecorder.current = recorder;
      recorder.start();
      setCapturing(true);
      await refreshRecordings();
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      if (recordingId) {
        try {
          await postRecording({ action: "cancel", recordingId });
        } catch {}
      }
      setError(
        cause instanceof Error ? cause.message : "recording_unavailable",
      );
    } finally {
      setWorking(false);
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    mediaRecorder.current = null;
    setCapturing(false);
  }

  async function uploadRecording(recordingId: string, file: Blob) {
    setWorking(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("recordingId", recordingId);
      form.set("file", file, "recording.webm");
      const response = await fetch("/api/doctor-workspace/recordings/upload", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "unavailable");
      await refreshRecordings();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setWorking(false);
    }
  }

  async function openRecording(recordingId: string) {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/doctor-workspace/recordings/${recordingId}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        data?: RecordingDetail;
        error?: string;
      };
      if (!response.ok || !payload.data)
        throw new Error(payload.error ?? "unavailable");
      setSelectedRecording(payload.data);
      const content = payload.data.latest_note?.content;
      setNoteText(
        typeof content?.summary === "string"
          ? content.summary
          : (payload.data.transcript_text ?? ""),
      );
      setReviewed(payload.data.latest_note?.status === "reviewed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setWorking(false);
    }
  }

  async function recordingAction(action: string) {
    if (!selectedRecording) return;
    setWorking(true);
    setError(null);
    try {
      await postRecording({
        action,
        recordingId: selectedRecording.recording_id,
      });
      await refreshRecordings();
      await openRecording(selectedRecording.recording_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setWorking(false);
    }
  }

  async function saveNote() {
    if (!selectedRecording) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/doctor-workspace/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          consultationId: selectedRecording.consultation_id,
          recordingId: selectedRecording.recording_id,
          content: { summary: noteText },
          sourceReferences: [
            { kind: "transcript", recordingId: selectedRecording.recording_id },
          ],
          reviewed,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "unavailable");
      await refreshRecordings();
      await openRecording(selectedRecording.recording_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <WorkspaceLoading />;
  if (error && !workspace)
    return (
      <WorkspaceState
        title="Dictaphone unavailable"
        message="The recording workspace could not be loaded."
        action={load}
      />
    );
  if (!workspace?.enabled)
    return (
      <WorkspaceState
        title="Dictaphone unavailable"
        message="Recording and transcription are not enabled for this account."
      />
    );

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Dictaphone"
        subtitle="Consent first. Private audio. Review before a note becomes part of the consultation."
        actions={
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={working}
          >
            Refresh
          </Button>
        }
      />
      {error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
              Consultation
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
              Choose a consultation
            </h2>
          </div>
          <StatusChip
            variant={workspace.consultations.length ? "neutral" : "warning"}
          >
            {workspace.consultations.length
              ? `${workspace.consultations.length} available`
              : "No consultations"}
          </StatusChip>
        </div>
        <select
          className="mt-5 h-10 w-full max-w-xl rounded-md border border-[var(--eh-border)] bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
          value={selectedConsultation}
          onChange={(event) => void selectConsultation(event.target.value)}
          aria-label="Consultation"
        >
          <option value="">Select a consultation</option>
          {workspace.consultations.map((consultation) => (
            <option
              key={consultation.consultation_id}
              value={consultation.consultation_id}
            >
              {consultation.title} · {consultation.patient_name}
            </option>
          ))}
        </select>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="brand"
            onClick={() => void startRecording()}
            disabled={working || capturing || !selectedConsultation}
          >
            Start recording
          </Button>
          <Button
            variant="outline"
            onClick={stopRecording}
            disabled={!capturing}
          >
            Stop and upload
          </Button>
        </div>
        {capturing ? (
          <p
            className="mt-3 text-sm text-[var(--eh-text-secondary)]"
            role="status"
          >
            Recording locally in this browser. Stop to upload the private audio
            object.
          </p>
        ) : (
          <p className="mt-3 text-xs leading-5 text-[var(--eh-text-muted)]">
            A patient recording consent must be active before the server creates
            a recording session.
          </p>
        )}
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SurfaceCard className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                Private recordings
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
                Lifecycle
              </h2>
            </div>
            <StatusChip variant="neutral">
              {recordings.length ? `${recordings.length} records` : "Empty"}
            </StatusChip>
          </div>
          {recordings.length ? (
            <ul className="mt-5 space-y-3">
              {recordings.map((recording) => (
                <li
                  key={recording.recording_id}
                  className="rounded-md border border-[var(--eh-border)] p-4"
                >
                  <button
                    type="button"
                    className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                    onClick={() => void openRecording(recording.recording_id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--eh-text-primary)]">
                        {new Date(recording.created_at).toLocaleString()}
                      </span>
                      <StatusChip
                        variant={
                          recording.status === "failed"
                            ? "warning"
                            : recording.status === "completed"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {recording.status}
                      </StatusChip>
                    </div>
                    <p className="mt-2 text-xs text-[var(--eh-text-secondary)]">
                      Transcript: {recording.transcript_status ?? "not started"}{" "}
                      · Note: {recording.latest_note_status ?? "none"}
                    </p>
                    {recording.failure_code ? (
                      <p className="mt-1 text-xs text-red-700">
                        Processing: {recording.failure_code}
                      </p>
                    ) : null}
                    {recording.source_audio_deleted_at ? (
                      <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                        Source audio deleted; transcript and note state remain
                        separate.
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-md border border-dashed border-[var(--eh-border)] px-4 py-5 text-sm text-[var(--eh-text-secondary)]">
              No recordings for this consultation.
            </p>
          )}
        </SurfaceCard>

        <SurfaceCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                Review boundary
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
                Transcript and note
              </h2>
            </div>
            {selectedRecording ? (
              <StatusChip variant={reviewed ? "success" : "warning"}>
                {reviewed ? "Reviewed" : "Draft"}
              </StatusChip>
            ) : null}
          </div>
          {selectedRecording ? (
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-[var(--eh-text-primary)]">
                    Transcript
                  </h3>
                  <span className="text-xs text-[var(--eh-text-muted)]">
                    {selectedRecording.transcript_status ?? "not available"}
                  </span>
                </div>
                <p className="mt-2 max-h-52 overflow-auto rounded-md border border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] p-4 text-sm leading-6 text-[var(--eh-text-secondary)]">
                  {selectedRecording.transcript_text ||
                    "No transcript text is available. Audio remains separate from note review."}
                </p>
              </div>
              <div>
                <label
                  className="text-sm font-medium text-[var(--eh-text-primary)]"
                  htmlFor="doctor-note"
                >
                  Clinician note candidate
                  <Textarea
                    id="doctor-note"
                    className="mt-2 min-h-32"
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Write the reviewed content here."
                  />
                </label>
                <label className="mt-3 flex min-h-9 items-center gap-2 text-sm text-[var(--eh-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(event) => setReviewed(event.target.checked)}
                  />
                  Mark this revision reviewed
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="brand"
                  onClick={() => void saveNote()}
                  disabled={
                    working ||
                    !noteText.trim() ||
                    !selectedRecording.transcript_text
                  }
                >
                  Save note revision
                </Button>
                {selectedRecording.transcription_retryable ? (
                  <Button
                    variant="outline"
                    onClick={() => void recordingAction("retry")}
                    disabled={working}
                  >
                    Retry transcription
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => void recordingAction("delete_audio")}
                  disabled={
                    working ||
                    Boolean(selectedRecording.source_audio_deleted_at)
                  }
                >
                  Delete source audio
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void recordingAction("delete_transcript")}
                  disabled={working || !selectedRecording.transcript_text}
                >
                  Delete transcript
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-md border border-dashed border-[var(--eh-border)] px-4 py-5 text-sm text-[var(--eh-text-secondary)]">
              Select a recording to inspect its transcript and note revision
              state.
            </p>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}

function WorkspaceLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-9 w-48 animate-pulse rounded-md bg-[var(--eh-surface-muted)]" />
      <div className="h-64 animate-pulse rounded-xl bg-[var(--eh-surface-muted)]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-[var(--eh-surface-muted)]" />
        <div className="h-80 animate-pulse rounded-xl bg-[var(--eh-surface-muted)]" />
      </div>
    </div>
  );
}

function WorkspaceState({
  title,
  message,
  action,
}: Readonly<{ title: string; message: string; action?: () => void }>) {
  return (
    <SurfaceCard className="p-6" role="status">
      <h1 className="text-xl font-semibold text-[var(--eh-text-primary)]">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
        {message}
      </p>
      {action ? (
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => void action()}
        >
          Try again
        </Button>
      ) : null}
    </SurfaceCard>
  );
}
