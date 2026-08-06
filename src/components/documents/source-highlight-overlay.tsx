"use client";

import { forwardRef } from "react";
import type { SourceRegion } from "@/lib/documents/source-region";

/**
 * EH-118 source region highlight.
 *
 * The box is positioned in percentages of the page image, so it stays aligned
 * across zoom, responsive width, and the fixed-width preview raster. It must be
 * rendered inside a container that is exactly the size of the page image.
 *
 * This component is deliberately presentational and does not scroll anything.
 * Bringing the highlight into view is the owning pane's job: `scrollIntoView`
 * here would also scroll every scrollable ancestor and the window, and would
 * fight the review list, which already scrolls the selected row.
 */
export const SourceHighlightOverlay = forwardRef<HTMLDivElement, { region: SourceRegion }>(
  function SourceHighlightOverlay({ region }, ref) {
    return (
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          ref={ref}
          className="absolute rounded-[3px] border-2 border-[var(--eh-brand)] bg-[var(--eh-brand)]/20 transition-all duration-200 motion-reduce:transition-none"
          style={{
            left: `${region.x * 100}%`,
            top: `${region.y * 100}%`,
            width: `${region.w * 100}%`,
            height: `${region.h * 100}%`,
          }}
        />
      </div>
    );
  }
);
