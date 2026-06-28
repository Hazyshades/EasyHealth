import { cn } from "@/lib/utils";

type SurfaceCardProps = React.ComponentProps<"div"> & {
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
};

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function SurfaceCard({
  className,
  padding = "md",
  hoverable = false,
  children,
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-[var(--eh-border)] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.08)]",
        paddingMap[padding],
        hoverable &&
          "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08),0_16px_32px_-12px_rgba(15,23,42,0.12)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
