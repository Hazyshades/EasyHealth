"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";
import { type ReviewRowSourceLocation } from "@/lib/documents/observation-review-workspace";
import { sourceRegionCanRender } from "@/lib/documents/source-region";
import { SourceHighlightOverlay } from "@/components/documents/source-highlight-overlay";

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
  /** Source location of the explicitly selected row, if any. */
  pinnedSource: ReviewRowSourceLocation | null;
  /** Ephemeral exact same-page source preview, if any. */
  previewSource: ReviewRowSourceLocation | null;
};

/**
 * Left pane of the review workspace. Pinned provenance owns preview scrolling;
 * hover/focus preview is decorative and never navigates or scrolls.
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
  pinnedSource,
  previewSource,
}: DocumentSourcePaneProps) {
  const [zoom, setZoom] = useState(1);
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pinnedHighlightRef = useRef<HTMLDivElement | null>(null);
  const isImage = mimeType?.startsWith("image/") ?? false;
  const isPdf = mimeType === "application/pdf";
  const showPagePreviews = pageCount > 0 && Boolean(pageUrl);

  const pinnedRegion =
    pinnedSource &&
    sourceRegionCanRender(pinnedSource.region, currentPage)
      ? pinnedSource.region
      : null;
  const previewRegion =
    previewSource &&
    sourceRegionCanRender(previewSource.region, currentPage)
      ? previewSource.region
      : null;
  const pinnedKey = pinnedRegion
    ? `${pinnedRegion.page}:${pinnedRegion.rects.map((rect) => `${rect.x}:${rect.y}:${rect.w}:${rect.h}`).join("|")}`
    : null;

  useEffect(() => {
    setImageReady(false);
    setImageError(false);
  }, [pageUrl]);

  /** Only an explicit pin may scroll the source preview. */
  useEffect(() => {
    if (!pinnedKey || !imageReady || imageError) return;
    const scroller = scrollerRef.current;
    const box = pinnedHighlightRef.current;
    if (!scroller || !box) return;
    const view = scroller.getBoundingClientRect();
    const target = box.getBoundingClientRect();
    scroller.scrollTo({
      top: Math.max(
        0,
        scroller.scrollTop +
          (target.top - view.top) -
          (view.height - target.height) / 2,
      ),
      left: Math.max(
        0,
        scroller.scrollLeft +
          (target.left - view.left) -
          (view.width - target.width) / 2,
      ),
      behavior: "smooth",
    });
  }, [pinnedKey, imageReady, imageError, zoom]);

  function retryPage() {
    setImageError(false);
    onRetryPage();
  }

  return (
    <SurfaceCard
      padding="sm"
      className={`flex min-w-0 flex-col lg:h-full ${isPdf ? "min-h-[720px]" : "min-h-[480px]"}`}
    >
      {(showPagePreviews || !isPdf) && (
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
            <Button variant="outline" size="sm" onClick={retryPage}>
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
          <div ref={scrollerRef} className="h-full overflow-auto">
            {imageError ? (
              <div
                role="alert"
                className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
              >
                <p className="text-sm text-red-600">
                  This page preview could not be loaded.
                </p>
                <Button variant="outline" size="sm" onClick={retryPage}>
                  Retry page preview
                </Button>
              </div>
            ) : (
              <div
                className="mx-auto w-fit max-w-full transition-transform"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                }}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pageUrl!}
                    alt={`Page ${currentPage} of ${filename}`}
                    className="block max-w-full"
                    onLoad={() => setImageReady(true)}
                    onError={() => {
                      setImageReady(false);
                      setImageError(true);
                    }}
                  />
                  {imageReady && pinnedRegion ? (
                    <SourceHighlightOverlay
                      ref={pinnedHighlightRef}
                      region={pinnedRegion}
                      variant="pinned"
                    />
                  ) : null}
                  {imageReady && previewRegion ? (
                    <SourceHighlightOverlay
                      region={previewRegion}
                      variant="preview"
                    />
                  ) : null}
                </div>
              </div>
            )}
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

      {pinnedSource ? (
        <div
          aria-live="polite"
          className="mt-3 shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs text-[var(--eh-text-secondary)]"
        >
          <p className="font-medium text-[var(--eh-text-primary)]">
            {pinnedSource.label}
          </p>
          {pinnedSource.snippet ? (
            <p className="mt-1 max-w-[65ch]">“{pinnedSource.snippet}”</p>
          ) : null}
          {pinnedSource.precision === "document" ? (
            <p className="mt-1 text-[var(--eh-text-muted)]">
              This result is linked to the document but not to a specific page.
            </p>
          ) : !showPagePreviews && isPdf ? (
            <p className="mt-1 text-[var(--eh-text-muted)]">
              Page previews are unavailable for this file, so the embedded PDF
              does not jump to the page automatically.
            </p>
          ) : pinnedSource.precision === "region" ? (
            <p className="mt-1 text-[var(--eh-text-muted)]">
              The exact source region is highlighted on the page.
            </p>
          ) : (
            <p className="mt-1 text-[var(--eh-text-muted)]">
              The exact region could not be located, so the whole page is shown.
            </p>
          )}
        </div>
      ) : null}
    </SurfaceCard>
  );
}
