"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { ReviewRowSourceLocation } from "@/lib/documents/observation-review-workspace";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

export type DocumentSourcePaneProps = {
  filename: string;
  processingStatus: string;
  mimeType: string | null;
  pageUrl: string | null;
  originalUrl: string | null;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageLoading: boolean;
  pageError: string | null;
  onRetryPage: () => void;
  /** Source location of the row the reviewer selected, if any. */
  activeSource: ReviewRowSourceLocation | null;
};

/**
 * Left pane of the EH-117 workspace. Renders the pre-rasterized page preview
 * with page navigation and zoom, and echoes the selected row's source
 * provenance underneath.
 *
 * EH-118 is not implemented, so no bounding-box overlay is drawn: provenance
 * degrades to page + snippet, and to a document-level notice when the
 * extraction did not record a page.
 */
export function DocumentSourcePane({
  filename,
  processingStatus,
  mimeType,
  pageUrl,
  originalUrl,
  pageCount,
  currentPage,
  onPageChange,
  pageLoading,
  pageError,
  onRetryPage,
  activeSource,
}: DocumentSourcePaneProps) {
  const [zoom, setZoom] = useState(1);
  const isImage = mimeType?.startsWith("image/") ?? false;
  const isPdf = mimeType === "application/pdf";
  const showPagePreviews = pageCount > 0 && Boolean(pageUrl);

  return (
    <SurfaceCard
      padding="sm"
      className={`flex min-w-0 flex-col lg:h-full ${isPdf ? "min-h-[720px]" : "min-h-[480px]"}`}
    >
      {!isPdf && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {pageCount > 0 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
                  disabled={currentPage <= 1}
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span
                  aria-live="polite"
                  className="px-2 text-sm text-[var(--eh-text-secondary)]"
                >
                  Page {currentPage} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
                  disabled={currentPage >= pageCount}
                  onClick={() =>
                    onPageChange(Math.min(pageCount, currentPage + 1))
                  }
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              aria-label="Zoom out"
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-12 text-center text-xs text-[var(--eh-text-muted)]">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              aria-label="Zoom in"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <div
        className={`flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 ${isPdf ? "min-h-[680px]" : "min-h-[400px]"}`}
      >
        {pageError ? (
          <div
            role="alert"
            className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
          >
            <p className="text-sm text-red-600">{pageError}</p>
            <Button variant="outline" size="sm" onClick={onRetryPage}>
              Retry page preview
            </Button>
          </div>
        ) : pageLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex h-full flex-col gap-2 p-2"
          >
            <span className="sr-only">Loading page {currentPage}</span>
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : showPagePreviews ? (
          <div className="h-full overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pageUrl!}
              alt={`Page ${currentPage} of ${filename}`}
              className="mx-auto block max-w-full object-contain transition-transform"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
              }}
            />
          </div>
        ) : isImage && originalUrl ? (
          <div className="h-full overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalUrl}
              alt={filename}
              className="mx-auto block max-w-full object-contain"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
              }}
            />
          </div>
        ) : isPdf && originalUrl ? (
          <iframe
            src={originalUrl}
            title={filename}
            className="h-full w-full rounded-lg border-0 bg-white"
          />
        ) : processingStatus === "processing" ? (
          <p className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--eh-text-secondary)]">
            Generating preview…
          </p>
        ) : (
          <p className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--eh-text-secondary)]">
            Preview not available. Use Download original.
          </p>
        )}
      </div>

      {activeSource ? (
        <div
          aria-live="polite"
          className="mt-3 shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs text-[var(--eh-text-secondary)]"
        >
          <p className="font-medium text-[var(--eh-text-primary)]">
            {activeSource.label}
          </p>
          {activeSource.snippet ? (
            <p className="mt-1 max-w-[65ch]">“{activeSource.snippet}”</p>
          ) : null}
          {activeSource.precision === "document" ? (
            <p className="mt-1 text-[var(--eh-text-muted)]">
              This result is linked to the document but not to a specific page.
            </p>
          ) : isPdf ? (
            <p className="mt-1 text-[var(--eh-text-muted)]">
              Page previews are unavailable for this file, so the embedded PDF
              does not jump to the page automatically.
            </p>
          ) : null}
        </div>
      ) : null}
    </SurfaceCard>
  );
}
