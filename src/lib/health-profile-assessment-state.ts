export type HealthProfileAssessmentJobStatus =
  | "queued"
  | "processing"
  | "retryable_failed"
  | "failed"
  | "succeeded";

export type HealthProfileAssessmentDisplayState =
  | "current"
  | "processing"
  | "outdated"
  | "error";

/**
 * Maps durable assessment-job state to the user-facing freshness axis.
 * Score readiness remains a separate per-system concern.
 */
export function resolveAssessmentDisplayState(
  jobStatus: string | null | undefined,
  hasCurrentVersion: boolean,
): HealthProfileAssessmentDisplayState {
  if (jobStatus === "retryable_failed" || jobStatus === "failed") {
    return "error";
  }

  if (jobStatus === "queued" || jobStatus === "processing") {
    return hasCurrentVersion ? "outdated" : "processing";
  }

  if (jobStatus === "succeeded") {
    return hasCurrentVersion ? "current" : "processing";
  }

  // A persisted version is safe to show as current when legacy or partial
  // metadata omits the job row. Without one, the API is serving its fallback
  // calculation while the first durable assessment is still pending.
  return hasCurrentVersion ? "current" : "processing";
}

export function assessmentDisplayStateLabel(
  state: HealthProfileAssessmentDisplayState,
): string {
  switch (state) {
    case "current":
      return "Current assessment";
    case "processing":
      return "Assessment processing";
    case "outdated":
      return "Assessment update available";
    case "error":
      return "Assessment update failed";
  }
}

export function assessmentDisplayStateDescription(
  state: HealthProfileAssessmentDisplayState,
): string {
  switch (state) {
    case "current":
      return "This is the latest completed current-state assessment from your records. It is not a diagnosis or disease-risk score.";
    case "processing":
      return "Your records are being used to prepare a current-state assessment. This is not a diagnosis or disease-risk score.";
    case "outdated":
      return "The latest completed current-state assessment remains visible while a newer update is prepared. It is not a diagnosis or disease-risk score.";
    case "error":
      return "The latest assessment update could not be completed. Any displayed score is the last completed current-state assessment, not a diagnosis or disease-risk score.";
  }
}
