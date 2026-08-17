"use client";

import { forwardRef } from "react";
import type { SourceRegion } from "@/lib/documents/source-region";

export type SourceHighlightVariant = "preview" | "pinned";

/**
 * Decorative source geometry. The wrapper is positioned over an image-sized
 * page; each line rectangle is percentage-positioned so zoom and resize do not
 * change the source alignment. Scrolling belongs to DocumentSourcePane.
 */
export const SourceHighlightOverlay = forwardRef<
  HTMLDivElement,
  {
    region: SourceRegion;
    variant?: SourceHighlightVariant;
  }
>(function SourceHighlightOverlay({ region, variant = "pinned" }, ref) {
  const isPreview = variant === "preview";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {region.rects.map((rect, index) => (
        <div
          key={`${rect.x}:${rect.y}:${rect.w}:${rect.h}`}
          ref={index === 0 ? ref : undefined}
          className={`absolute rounded-[3px] motion-reduce:transition-none ${
            isPreview
              ? "border border-dashed border-[var(--eh-brand)] bg-[var(--eh-brand)]/10 shadow-[0_0_0_1px_rgba(15,118,110,0.28)] transition-opacity duration-100"
              : "border-2 border-solid border-[var(--eh-brand)] bg-[var(--eh-brand)]/20 shadow-[0_0_0_2px_rgba(15,118,110,0.24)] transition-all duration-200"
          }`}
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
            minWidth: "12px",
            minHeight: "8px",
          }}
        />
      ))}
    </div>
  );
});
