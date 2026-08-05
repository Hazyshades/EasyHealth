import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";

/**
 * EH-117 initial loading state. Both panes keep their final geometry so the
 * workspace does not jump when the bootstrap response arrives.
 */
export function ReviewWorkspaceSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">Loading document review workspace</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch">
        <SurfaceCard padding="sm" className="min-h-[480px]">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </SurfaceCard>
        <SurfaceCard padding="sm" className="space-y-3">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="space-y-2 rounded-xl border border-slate-200 p-3"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </SurfaceCard>
      </div>
    </div>
  );
}
