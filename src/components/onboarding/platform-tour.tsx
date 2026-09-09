"use client";

import { useEffect, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";
import { PLATFORM_TOUR_TARGETS } from "@/lib/onboarding/platform-tour";
import "./platform-tour.module.css";

type PlatformTourProps = {
  open: boolean;
  onDismiss: () => Promise<void>;
  onComplete: () => Promise<void>;
};

type TerminalAction = "dismissed" | "completed";

function hasVisibleTarget(selector: string): boolean {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  return (
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    element.getClientRects().length > 0
  );
}

function targetStep(
  selector: string,
  title: string,
  description: string,
): DriveStep | null {
  if (!hasVisibleTarget(selector)) return null;
  return {
    element: selector,
    popover: { title, description },
  };
}

function buildPlatformTourSteps(): DriveStep[] | null {
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const navigationSelector = isMobile
    ? PLATFORM_TOUR_TARGETS.mobileNavigation
    : PLATFORM_TOUR_TARGETS.desktopNavigation;
  const biomarkersSelector = isMobile
    ? PLATFORM_TOUR_TARGETS.mobileBiomarkers
    : PLATFORM_TOUR_TARGETS.desktopBiomarkers;

  if (!hasVisibleTarget(navigationSelector)) return null;

  const steps: Array<DriveStep | null> = [
    {
      popover: {
        title: "Your EasyHealth workspace",
        description:
          "This quick tour shows where to upload health records, review your profile, and find educational reports.",
      },
    },
    {
      element: navigationSelector,
      popover: {
        title: "Move around your workspace",
        description:
          "Use the main navigation to return to the dashboard or open your health profile and records.",
      },
    },
    targetStep(
      PLATFORM_TOUR_TARGETS.addDocument,
      "Add a health document",
      "Upload a lab result or another supported document to build your personal health record.",
    ),
    targetStep(
      PLATFORM_TOUR_TARGETS.reports,
      "Generate educational reports",
      "Reports turn your verified health data into educational summaries for your next review.",
    ),
    targetStep(
      biomarkersSelector,
      "Explore biomarkers",
      "Open Biomarkers to inspect extracted values and follow changes over time.",
    ),
    targetStep(
      PLATFORM_TOUR_TARGETS.healthProfile,
      "Review your Health Profile",
      "Your profile brings verified health information together so you can review the current picture.",
    ),
    targetStep(
      PLATFORM_TOUR_TARGETS.accountMenu,
      "Manage your account",
      "Use the account menu to open settings, update your profile, or sign out.",
    ),
  ];

  return steps.filter((step): step is DriveStep => step !== null);
}

export function PlatformTour({ open, onDismiss, onComplete }: PlatformTourProps) {
  const driverRef = useRef<Driver | null>(null);
  const terminalRef = useRef<TerminalAction | null>(null);
  const destroyRequestedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    onCompleteRef.current = onComplete;
  }, [onDismiss, onComplete]);

  useEffect(() => {
    if (!open || driverRef.current) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const steps = buildPlatformTourSteps();
      if (!steps?.length) return;

      terminalRef.current = null;
      destroyRequestedRef.current = false;

      const persistTerminal = (action: TerminalAction) => {
        const callback = action === "completed" ? onCompleteRef.current : onDismissRef.current;
        void callback().catch((error) => {
          console.error("[onboarding] platform tour persistence failed:", error);
        });
      };

      const requestTerminal = (action: TerminalAction, instance: Driver) => {
        if (terminalRef.current) return;
        terminalRef.current = action;
        destroyRequestedRef.current = true;
        instance.destroy();
        persistTerminal(action);
      };

      const instance = driver({
        steps,
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        duration: 220,
        overlayColor: "#0f172a",
        overlayOpacity: 0.52,
        smoothScroll: true,
        allowClose: true,
        allowScroll: true,
        overlayClickBehavior: "close",
        stagePadding: 8,
        stageRadius: 12,
        allowKeyboardControl: true,
        skipMissingElement: true,
        waitForElement: 750,
        popoverClass: "eh-platform-tour-popover",
        showButtons: ["previous", "next", "close"],
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish tour",
        onPopoverRender: (popover, options) => {
          if (popover.footerButtons.querySelector("[data-tour-skip]")) return;
          const skipButton = document.createElement("button");
          skipButton.type = "button";
          skipButton.className = "driver-popover-footer-btn eh-platform-tour-skip-btn";
          skipButton.dataset.tourSkip = "true";
          skipButton.textContent = "Skip";
          skipButton.setAttribute("aria-label", "Skip tour");
          skipButton.addEventListener("click", () => {
            options.driver.destroy();
          });
          popover.footerButtons.prepend(skipButton);
        },
        onCloseClick: (_element, _step, options) => {
          requestTerminal("dismissed", options.driver);
        },
        onDoneClick: (_element, _step, options) => {
          requestTerminal("completed", options.driver);
        },
        onDestroyStarted: (_element, _step, options) => {
          if (!terminalRef.current) {
            terminalRef.current = "dismissed";
            persistTerminal("dismissed");
          }
          if (!destroyRequestedRef.current) {
            destroyRequestedRef.current = true;
            options.driver.destroy();
          }
        },
        onDestroyed: () => {
          driverRef.current = null;
        },
      });

      driverRef.current = instance;
      instance.drive();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const instance = driverRef.current;
      if (!instance) return;
      if (!terminalRef.current) {
        terminalRef.current = "dismissed";
        void onDismissRef.current().catch((error) => {
          console.error("[onboarding] platform tour cleanup failed:", error);
        });
      }
      destroyRequestedRef.current = true;
      instance.destroy();
      driverRef.current = null;
    };
  }, [open]);

  return null;
}
