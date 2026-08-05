import type { ReactNode } from "react";
import { measurementReasonLabel } from "@/lib/documents/biomarker-review-state";
import type { LaboratoryResolutionDetails } from "@/lib/documents/incomplete-laboratory-outcomes";
import type {
  DecisionTraceReview,
  NormalizationReview,
} from "@/lib/documents/normalization-review";

export type PreviewCandidateEvidence =
  NormalizationReview["previewCandidateEvidence"];

const TRACE_AVAILABILITY_COPY = {
  persisted: "Recorded decision for this revision.",
  preview: "Current preview only — it has not been saved as a decision.",
  legacy_unavailable: "Decision trace unavailable for this historical revision.",
} as const;

function ReasonLine({
  label,
  codes,
}: {
  label: string;
  codes: readonly string[];
}) {
  if (codes.length === 0) return null;
  return (
    <p className="mt-1">
      {label}: {codes.map(measurementReasonLabel).join(", ")}
    </p>
  );
}

/**
 * EH-117 progressive disclosure. Everything a reviewer does not need for the
 * ordinary accept decision lives behind this summary: resolver state,
 * verification state, evidence codes, candidate counts, release versions and
 * the optional manual-mapping controls passed as `children`.
 */
export function ReviewTechnicalDetails({
  details,
  decisionTrace,
  previewCandidateEvidence,
  children,
}: {
  details: LaboratoryResolutionDetails | null;
  decisionTrace?: DecisionTraceReview | null;
  previewCandidateEvidence?: PreviewCandidateEvidence;
  children?: ReactNode;
}) {
  if (!details && !decisionTrace && !children) return null;
  const trace = decisionTrace?.trace ?? null;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[var(--eh-text-muted)] hover:text-[var(--eh-text-secondary)]">
        Technical details
      </summary>
      <p className="mt-2">
        Mapping confidence describes classification evidence, not medical
        certainty.
      </p>

      {decisionTrace ? (
        <p className="mt-1">
          {TRACE_AVAILABILITY_COPY[decisionTrace.availability]}
        </p>
      ) : null}

      {details ? (
        <>
          <p className="mt-1">
            State: {details.source}
            {details.verificationStatus
              ? ` · ${details.verificationStatus}`
              : ""}
            {details.mappingConfidence != null
              ? ` · ${Math.round(details.mappingConfidence * 100)}% confidence`
              : ""}
          </p>
          <ReasonLine label="Missing" codes={details.missingAxes} />
          <ReasonLine label="Conflicts" codes={details.conflictCodes} />
          <ReasonLine
            label="Supporting evidence"
            codes={details.supportCodes}
          />
          <p className="mt-1">
            Candidates considered: {details.candidateCount}
          </p>
          <p className="mt-2 font-mono text-[var(--eh-text-muted)]">
            Catalog/resolver: {details.versions.catalog ?? "pending"}
            {" / "}
            {details.versions.resolver ?? "pending"}
            {details.versions.compatibilityPolicy
              ? ` · policy ${details.versions.compatibilityPolicy}`
              : ""}
          </p>
        </>
      ) : null}

      {trace ? (
        <>
          <p className="mt-2">
            Decision: {trace.decisionKind}
            {trace.winningCandidateKey
              ? ` · selected ${trace.winningCandidateKey}`
              : ""}
          </p>
          <ul className="mt-2 space-y-1">
            {trace.candidates.map((candidate) => (
              <li key={candidate.candidateKey}>
                <span className="font-medium">{candidate.candidateKey}</span>
                {` · ${candidate.maturity}`}
                {candidate.score != null ? ` · score ${candidate.score}` : ""}
                {candidate.accepted.length
                  ? ` · supports: ${candidate.accepted.map((item) => item.code).join(", ")}`
                  : ""}
                {candidate.rejected.length
                  ? ` · rejects: ${candidate.rejected.map((item) => item.code).join(", ")}`
                  : ""}
              </li>
            ))}
          </ul>
          {trace.missingAxes.length > 0 && (
            <p className="mt-2">
              Missing details: {trace.missingAxes.join(", ")}
            </p>
          )}
          {trace.conflicts.length > 0 && (
            <p className="mt-1">Conflicts: {trace.conflicts.join(", ")}</p>
          )}
          <p className="mt-2 font-mono text-[var(--eh-text-muted)]">
            Catalog/resolver: {trace.catalogManifestVersion}
            {" / "}
            {trace.resolverVersion}
          </p>
        </>
      ) : decisionTrace?.availability === "preview" &&
        previewCandidateEvidence?.length ? (
        <ul className="mt-2 space-y-1">
          {previewCandidateEvidence.map((candidate) => (
            <li key={candidate.candidateKey}>
              <span className="font-medium">{candidate.candidateKey}</span>
              {candidate.accepted.length
                ? ` · supports: ${candidate.accepted.map((item) => item.code).join(", ")}`
                : ""}
              {candidate.rejected.length
                ? ` · rejects: ${candidate.rejected.map((item) => item.code).join(", ")}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {children}
    </details>
  );
}
