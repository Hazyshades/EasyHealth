"use client";

import { forwardRef, useImperativeHandle } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const ClinicIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    {
      size = 24,
      color = "currentColor",
      strokeWidth = 2,
      className = "",
      ...props
    },
    ref,
  ) => {
    useImperativeHandle(
      ref,
      () => ({
        startAnimation() {},
        stopAnimation() {},
      }),
      [],
    );

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        <path d="M3 21h18" />
        <path d="M5 21V7.5a1 1 0 0 1 .6-.92l6-2.58a1 1 0 0 1 .8 0l6 2.58a1 1 0 0 1 .6.92V21" />
        <path d="M9 10h6" />
        <path d="M12 7v6" />
        <path d="M8 21v-4h8v4" />
      </svg>
    );
  },
);

ClinicIcon.displayName = "ClinicIcon";
export default ClinicIcon;
