"use client";

import { useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { AppIcon } from "@/lib/icon-types";
import type { AnimatedIconHandle } from "@/components/icons/types";

export function useAnimatedIconHover() {
  const iconRef = useRef<AnimatedIconHandle>(null);

  const onMouseEnter = useCallback(() => {
    iconRef.current?.startAnimation();
  }, []);

  const onMouseLeave = useCallback(() => {
    iconRef.current?.stopAnimation();
  }, []);

  return {
    iconRef,
    hoverProps: { onMouseEnter, onMouseLeave },
  };
}

type DashboardCardIconProps = {
  icon: AppIcon;
  iconRef: RefObject<AnimatedIconHandle | null>;
  size?: number;
  className?: string;
};

export function DashboardCardIcon({
  icon: Icon,
  iconRef,
  size = 24,
  className = "shrink-0 text-[var(--eh-brand)]",
}: DashboardCardIconProps) {
  return <Icon ref={iconRef} size={size} className={className} aria-hidden />;
}
