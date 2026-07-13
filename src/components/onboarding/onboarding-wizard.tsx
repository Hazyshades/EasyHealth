"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudUpload, FileHeart, Sparkles, X } from "lucide-react";
import type { WizardStepId } from "@/lib/onboarding/wizard-steps";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

type WizardStep = {
  id: WizardStepId;
  title: string;
  description: string;
  href: string;
  icon: typeof CloudUpload;
  complete: boolean;
};

type OnboardingWizardProps = {
  open: boolean;
  onSkip: () => Promise<void>;
  onDone: () => Promise<void>;
};

async function markStepVisited(stepId: WizardStepId) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wizard_step_visited: stepId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to save wizard progress");
  }
}

export function OnboardingWizard({ open, onSkip, onDone }: OnboardingWizardProps) {
  const router = useRouter();
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [navigatingStepId, setNavigatingStepId] = useState<WizardStepId | null>(null);

  const loadSteps = useCallback(async () => {
    const [profileData, documentsData, biomarkersData, reportsData] = await Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/documents").then((r) => r.json()),
      fetch("/api/biomarkers").then((r) => r.json()),
      fetch("/api/reports").then((r) => r.json()),
    ]);

    const visited = new Set<string>(
      (profileData.wizard_steps_visited as string[] | undefined) ??
        profileData.dashboard_preferences?.wizard_steps_visited ??
        []
    );

    const completedDocs =
      (documentsData.documents as Array<{ status: string }> | undefined)?.filter(
        (d) => d.status === "completed"
      ).length ?? 0;
    const observationCount =
      (biomarkersData.observations as unknown[] | undefined)?.length ?? 0;
    const reportCount = (reportsData.reports as unknown[] | undefined)?.length ?? 0;

    const isComplete = (id: WizardStepId, dataComplete: boolean) =>
      visited.has(id) || dataComplete;

    setSteps([
      {
        id: "upload",
        title: "Upload your first lab",
        description: "Photo, PDF, or image -AI extracts biomarkers automatically.",
        href: "/app/upload",
        icon: CloudUpload,
        complete: isComplete("upload", completedDocs > 0),
      },
      {
        id: "biomarkers",
        title: "View your biomarkers",
        description: "See extracted values in My Biomarkers and track changes.",
        href: "/app/biomarkers",
        icon: FileHeart,
        complete: isComplete("biomarkers", observationCount > 0),
      },
      {
        id: "report",
        title: "Generate a health report",
        description: "Create an educational summary you can share with a clinician.",
        href: "/app/reports/create",
        icon: Sparkles,
        complete: isComplete("report", reportCount > 0),
      },
    ]);
  }, []);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    loadSteps()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [open, loadSteps]);

  useEffect(() => {
    if (!open) return;

    const refresh = () => {
      void loadSteps();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });

    return () => {
      window.removeEventListener("focus", refresh);
    };
  }, [open, loadSteps]);

  async function handleGo(step: WizardStep) {
    setNavigatingStepId(step.id);
    setSteps((prev) =>
      prev.map((s) => (s.id === step.id ? { ...s, complete: true } : s))
    );

    try {
      await markStepVisited(step.id);
      router.push(step.href);
    } catch {
      await loadSteps();
    } finally {
      setNavigatingStepId(null);
    }
  }

  if (!open) return null;

  const completedCount = steps.filter((s) => s.complete).length;
  const activeIndex = steps.findIndex((s) => !s.complete);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <SurfaceCard padding="lg" className="relative w-full max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--eh-text-primary)]">Welcome!</h2>
            <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
              Get started with EasyHealth
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setActing(true);
              try {
                await onSkip();
              } finally {
                setActing(false);
              }
            }}
            disabled={acting}
            className="text-sm font-medium text-[var(--eh-brand)] hover:underline"
          >
            Skip
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--eh-canvas-bg)]">
            <div
              className="h-full rounded-full bg-[var(--eh-brand)] transition-all duration-300"
              style={{ width: `${(completedCount / 3) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-[var(--eh-text-secondary)]">
            {completedCount} / 3
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-sm text-[var(--eh-text-secondary)]">Loading steps…</p>
          ) : (
            steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex gap-4 rounded-xl border p-4 transition-colors",
                    index === activeIndex
                      ? "border-[var(--eh-brand)]/30 bg-[var(--eh-brand-soft)]/40"
                      : "border-[var(--eh-border)] bg-white"
                  )}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--eh-brand)] shadow-xs">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--eh-text-primary)]">{step.title}</p>
                      {step.complete ? (
                        <Check className="size-4 text-[var(--eh-brand)]" aria-label="Complete" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">{step.description}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 rounded-lg"
                      disabled={navigatingStepId === step.id}
                      onClick={() => void handleGo(step)}
                    >
                      {navigatingStepId === step.id ? "Opening…" : "Go"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={acting}
            onClick={async () => {
              setActing(true);
              try {
                await onSkip();
              } finally {
                setActing(false);
              }
            }}
          >
            Skip
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
            disabled={acting}
            onClick={async () => {
              setActing(true);
              try {
                await onDone();
              } finally {
                setActing(false);
              }
            }}
          >
            Done
          </Button>
        </div>

        <button
          type="button"
          onClick={async () => {
            setActing(true);
            try {
              await onSkip();
            } finally {
              setActing(false);
            }
          }}
          className="absolute right-4 top-4 rounded-lg p-1 text-[var(--eh-text-muted)] hover:bg-[var(--eh-canvas-bg)]"
          aria-label="Close wizard"
        >
          <X className="size-4" />
        </button>
      </SurfaceCard>
    </div>
  );
}
