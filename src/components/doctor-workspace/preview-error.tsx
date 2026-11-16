"use client";

import { Button } from "@/components/ui/button";

export function ClinicianPreviewError({
  title,
  reset,
}: Readonly<{
  title: string;
  reset: () => void;
}>) {
  return (
    <div className="flex min-h-[360px] items-center justify-center py-8">
      <div
        role="alert"
        className="w-full max-w-xl rounded-[16px] border border-red-200 bg-red-50 p-6 text-center sm:p-8"
      >
        <h1 className="text-xl font-semibold text-red-950">
          {title} is unavailable
        </h1>
        <p className="mx-auto mt-2 max-w-[48ch] text-sm leading-6 text-red-900">
          We could not load this preview. No patient data was changed.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          className="mt-6 border-red-300 bg-white text-red-950 hover:bg-red-100"
        >
          Try loading again
        </Button>
      </div>
    </div>
  );
}
