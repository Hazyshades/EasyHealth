import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "@/components/icons/types";

export type AppIcon = ForwardRefExoticComponent<
  AnimatedIconProps & RefAttributes<AnimatedIconHandle>
>;
