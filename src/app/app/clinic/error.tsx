"use client";

import { ClinicianPreviewError } from "@/components/doctor-workspace/preview-error";

export default function Error({ reset }: { reset: () => void }) {
  return <ClinicianPreviewError title="Clinic" reset={reset} />;
}
