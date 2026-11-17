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

export function resolveDoctorConsultationSelection(
  consultations: readonly { consultation_id: string }[],
  selectedConsultationId: string,
): string {
  if (
    consultations.some(
      (consultation) =>
        consultation.consultation_id === selectedConsultationId,
    )
  ) {
    return selectedConsultationId;
  }
  return consultations[0]?.consultation_id ?? "";
}

const BLOCKED_NOTE_FIELDS = new Set([
  "diagnosis",
  "treatment",
  "urgency",
  "urgency_instruction",
  "medication_directive",
]);

export function sanitizeDoctorNoteCandidate(
  content: Record<string, unknown>,
): Record<string, unknown> {
  let removedUnsupportedContent = false;
  const sanitizeValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (!value || typeof value !== "object") return value;
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (BLOCKED_NOTE_FIELDS.has(key)) {
        removedUnsupportedContent = true;
        continue;
      }
      sanitized[key] = sanitizeValue(nestedValue);
    }
    return sanitized;
  };
  const sanitized = sanitizeValue(content);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return {};
  }
  const sanitizedRecord = sanitized as Record<string, unknown>;
  if (removedUnsupportedContent) {
    const existing = Array.isArray(sanitizedRecord.limitations)
      ? sanitizedRecord.limitations
      : [];
    sanitizedRecord.limitations = [
      ...existing,
      "Unsupported clinical directives were omitted",
    ];
  }
  return sanitizedRecord;
}
