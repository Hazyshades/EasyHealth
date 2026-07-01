"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/health-systems";

type TypeMismatchBannerProps = {
  selectedType: DocumentType;
  suggestedType: DocumentType;
  reason: string | null;
  reprocessing: boolean;
  onReprocessAsSuggested: () => void;
  onDismiss: () => void;
};

export function TypeMismatchBanner({
  selectedType,
  suggestedType,
  reason,
  reprocessing,
  onReprocessAsSuggested,
  onDismiss,
}: TypeMismatchBannerProps) {
  const selectedLabel = DOCUMENT_TYPE_LABELS[selectedType] ?? selectedType;
  const suggestedLabel = DOCUMENT_TYPE_LABELS[suggestedType] ?? suggestedType;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="font-medium text-amber-900">
            This looks like a {suggestedLabel.toLowerCase()}, not a {selectedLabel.toLowerCase()}
          </p>
          {reason ? (
            <p className="mt-1 text-sm text-amber-800">{reason}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <Button
          size="sm"
          className="rounded-lg bg-amber-700 hover:bg-amber-800"
          disabled={reprocessing}
          onClick={onReprocessAsSuggested}
        >
          {reprocessing ? "Reprocessing…" : `Reprocess as ${suggestedLabel.toLowerCase()}`}
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
