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
        "rounded-[16px] border border-[var(--eh-border)] bg-white",
        paddingMap[padding],
        hoverable &&
          "transition-colors duration-200 ease-out hover:border-[var(--eh-text-muted)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
