"use client";

import { useMemo, useState } from "react";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { DOCUMENT_TYPE_LABELS } from "@/lib/health-systems";
import {
  duplicateMatchLabel,
  duplicateReasonLabel,
  type DuplicateCandidate,
  type DuplicateDecision,
} from "@/lib/documents/duplicate-detection";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { SurfaceCard } from "@/components/ui/surface-card";

type ResolutionResult = {
  candidateId: string;
  archivedDocumentId: string | null;
  decision: DuplicateDecision;
};

type DuplicateCandidateCardProps = {
  candidates: DuplicateCandidate[];
  currentDocumentId: string;
  onResolved: (result: ResolutionResult) => void;
};

type Confirmation = {
  candidateId: string;
  decision: Exclude<DuplicateDecision, "keep_both">;
  documentName: string;
};


export function DuplicateCandidateCard({
  candidates,
  currentDocumentId,
  onResolved,
}: DuplicateCandidateCardProps) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const visibleCandidates = useMemo(
    () => candidates.filter((candidate) => !resolvedIds.has(candidate.id)),
    [candidates, resolvedIds],
  );

  async function resolveCandidate(
    candidate: DuplicateCandidate,
    decision: DuplicateDecision,
  ) {
    setBusyCandidateId(candidate.id);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/documents/duplicates/${candidate.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        archived_document_id?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "The duplicate decision could not be saved");
      }

      const archivedDocumentId = payload.archived_document_id ?? null;
      setResolvedIds((current) => new Set(current).add(candidate.id));
      setConfirmation(null);
      setFeedback(
        decision === "keep_both"
          ? "Both documents were retained."
          : "The document was archived, not deleted, and removed from active views.",
      );
      onResolved({
        candidateId: candidate.id,
        archivedDocumentId,
        decision,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The duplicate decision could not be saved",
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  if (visibleCandidates.length === 0) {
    return feedback ? (
      <p role="status" className="text-sm text-emerald-700">
        {feedback}
      </p>
    ) : null;
  }

  return (
    <div className="space-y-3" aria-label="Duplicate document review">
      {visibleCandidates.map((candidate) => {
        const currentIsLeft = candidate.left_document_id === currentDocumentId;
        const currentDocument = currentIsLeft
          ? candidate.left_document
          : candidate.right_document;
        const otherDocument = currentIsLeft
          ? candidate.right_document
          : candidate.left_document;
        const archiveCurrentDecision: Exclude<DuplicateDecision, "keep_both"> =
          currentIsLeft ? "archive_left" : "archive_right";
        const archiveOtherDecision: Exclude<DuplicateDecision, "keep_both"> =
          currentIsLeft ? "archive_right" : "archive_left";
        const isBusy = busyCandidateId === candidate.id;
        const score = candidate.match_kind === "exact"
          ? "100%"
          : `${Math.round(candidate.similarity_score * 100)}%`;
        const reasonLabels = candidate.reason_codes
          .map(duplicateReasonLabel)
          .join(", ");

        return (
          <SurfaceCard key={candidate.id} padding="md" className="border-amber-200 bg-amber-50/60">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-[var(--eh-text-primary)]">
                    {duplicateMatchLabel(candidate.match_kind)}
                  </h2>
                  <StatusChip variant="warning">{score} match</StatusChip>
                </div>
                <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
                  Review these documents before choosing how to keep your medical history. Nothing is removed automatically.
                </p>
                {reasonLabels ? (
                  <p className="mt-2 text-xs text-[var(--eh-text-muted)]">
                    Evidence: {reasonLabels}
                  </p>
                ) : null}

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[{ label: "This document", document: currentDocument }, { label: "Possible match", document: otherDocument }].map(
                    ({ label, document }) => (
                      <div key={document.id} className="rounded-lg border border-amber-200 bg-white/80 p-3">
                        <p className="text-xs font-medium text-[var(--eh-text-muted)]">{label}</p>
                        <p className="mt-1 truncate text-sm font-medium text-[var(--eh-text-primary)]">
                          {document.original_filename}
                        </p>
                        <p className="mt-1 text-xs text-[var(--eh-text-secondary)]">
                          {document.observed_at ?? "Medical date unavailable"} · {DOCUMENT_TYPE_LABELS[document.document_type as keyof typeof DOCUMENT_TYPE_LABELS] ?? document.document_type}
                        </p>
                        {document.lab_name ? (
                          <p className="mt-1 truncate text-xs text-[var(--eh-text-muted)]">
                            {document.lab_name}
                          </p>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void resolveCandidate(candidate, "keep_both")}
                  >
                    <ShieldCheck className="size-4" aria-hidden />
                    {isBusy ? "Saving…" : "Keep both"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() =>
                      setConfirmation({
                        candidateId: candidate.id,
                        decision: archiveCurrentDecision,
                        documentName: currentDocument.original_filename,
                      })
                    }
                  >
                    Archive this document
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() =>
                      setConfirmation({
                        candidateId: candidate.id,
                        decision: archiveOtherDecision,
                        documentName: otherDocument.original_filename,
                      })
                    }
                  >
                    Archive possible match
                  </Button>
                </div>

                {confirmation && confirmation.candidateId === candidate.id ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3" role="alert">
                    <p className="text-sm text-[var(--eh-text-primary)]">
                      Archive <strong>{confirmation.documentName}</strong>? The file and audit history stay retained, but this document leaves active views.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void resolveCandidate(candidate, confirmation.decision)}
                      >
                        {isBusy ? "Archiving…" : "Confirm archive"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => setConfirmation(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </SurfaceCard>
        );
      })}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p role="status" className="text-sm text-emerald-700">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
