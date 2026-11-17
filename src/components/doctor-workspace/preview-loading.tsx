import { Skeleton } from "@/components/ui/skeleton";

export function ClinicianPreviewLoading({
  title,
}: Readonly<{ title: string }>) {
  return (
    <div className="space-y-6 pb-8" aria-label={`Loading ${title}`}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-full max-w-[34rem]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <Skeleton className="h-[300px] rounded-[16px]" />
        <Skeleton className="h-[300px] rounded-[16px]" />
      </div>
    </div>
  );
}
