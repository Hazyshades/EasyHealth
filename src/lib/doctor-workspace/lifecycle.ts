export const RECORDING_STATUSES = [
  "consent_checked",
  "recording",
  "uploading",
  "uploaded",
  "transcribing",
  "transcript_ready",
  "note_draft",
  "clinician_reviewed",
  "completed",
  "cancelled",
  "failed",
  "deleted",
] as const;

export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

const RECORDING_TRANSITIONS: Readonly<
  Record<RecordingStatus, readonly RecordingStatus[]>
> = {
  consent_checked: ["recording", "cancelled"],
  recording: ["uploading", "cancelled"],
  uploading: ["uploaded", "cancelled"],
  uploaded: ["transcribing", "cancelled", "failed"],
  transcribing: ["transcript_ready", "failed", "cancelled"],
  transcript_ready: [
    "note_draft",
    "clinician_reviewed",
    "completed",
    "cancelled",
  ],
  note_draft: ["note_draft", "clinician_reviewed", "completed", "cancelled"],
  clinician_reviewed: ["completed", "cancelled"],
  completed: ["deleted"],
  cancelled: ["deleted"],
  failed: ["uploaded", "deleted"],
  deleted: [],
};

export function canTransitionRecording(
  from: RecordingStatus,
  to: RecordingStatus,
): boolean {
  return RECORDING_TRANSITIONS[from].includes(to);
}

export function sanitizeDoctorNoteCandidate(
  content: Record<string, unknown>,
): Record<string, unknown> {
  const blocked = new Set([
    "diagnosis",
    "treatment",
    "urgency",
    "urgency_instruction",
    "medication_directive",
  ]);
  const sanitized = Object.fromEntries(
    Object.entries(content).filter(([key]) => !blocked.has(key)),
  );
  if (Object.keys(content).some((key) => blocked.has(key))) {
    const existing = Array.isArray(sanitized.limitations)
      ? sanitized.limitations
      : [];
    sanitized.limitations = [
      ...existing,
      "Unsupported clinical directives were omitted",
    ];
  }
  return sanitized;
}
