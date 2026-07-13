"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type OnboardingSuccessBannerProps = {
  onDismiss: () => Promise<void>;
  dismissing?: boolean;
};

export function OnboardingSuccessBanner({ onDismiss, dismissing }: OnboardingSuccessBannerProps) {
  return (
    <SurfaceCard
      padding="lg"
      className="mb-6 flex flex-col gap-4 border-[var(--eh-brand)]/20 bg-[var(--eh-brand-soft)]/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <CheckCircle2 className="size-6 shrink-0 text-[var(--eh-brand)]" aria-hidden />
        <div>
          <p className="font-semibold text-[var(--eh-text-primary)]">You&apos;re all set!</p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            You&apos;ve configured the basics. Your home page is ready -upload labs, track
            biomarkers, and generate reports when you need them.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 rounded-xl border-[var(--eh-border)] bg-white"
        disabled={dismissing}
        onClick={() => void onDismiss()}
      >
        Got it
      </Button>
    </SurfaceCard>
  );
}
