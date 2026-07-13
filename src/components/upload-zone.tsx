"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/health-systems";

type UploadZoneProps = {
  documentType?: DocumentType;
  redirectTo?: string;
};

const UPLOAD_HINTS: Record<
  Extract<
    DocumentType,
    | "lab_result"
    | "instrumental_report"
    | "consultation_note"
    | "discharge_summary"
    | "prescription"
    | "referral"
  >,
  { dropLabel: string; helper: string }
> = {
  lab_result: {
    dropLabel: "Drop a lab PDF or image here",
    helper: "Free · OCR + biomarker extraction",
  },
  instrumental_report: {
    dropLabel: "Drop an imaging or instrumental report here",
    helper: "Free · Structured findings extraction",
  },
  consultation_note: {
    dropLabel: "Drop a consultation note or visit record here",
    helper: "Free · Clinical note extraction",
  },
  discharge_summary: {
    dropLabel: "Drop a hospital discharge summary here",
    helper: "Free · Discharge summary extraction",
  },
  prescription: {
    dropLabel: "Drop a prescription or medication list here",
    helper: "Free · Prescription extraction",
  },
  referral: {
    dropLabel: "Drop a referral letter here",
    helper: "Free · Referral extraction",
  },
};

function buildFormData(file: File, documentType: DocumentType) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  return formData;
}

export function UploadZone({
  documentType = "lab_result",
  redirectTo = "/app/documents",
}: UploadZoneProps) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadableType = documentType === "dicom" ? "lab_result" : documentType;
  const hints =
    UPLOAD_HINTS[uploadableType as keyof typeof UPLOAD_HINTS] ?? UPLOAD_HINTS.lab_result;
  const inputId = `upload-${uploadableType}`;

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("Uploading…");

      try {
        const formData = buildFormData(file, uploadableType);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = (await res.json().catch(() => ({}))) as {
          documentId?: string;
          error?: string;
          message?: string;
        };

        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Upload failed");
        }

        setStatus("Document queued for processing");
        const target = data.documentId ? `/app/documents/${data.documentId}` : redirectTo;
        setTimeout(() => router.push(target), 800);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        setStatus(null);
      }
    },
    [uploadableType, router, redirectTo]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragging ? "border-teal-500 bg-teal-50" : "border-muted-foreground/30"
        }`}
      >
        <p className="mb-2 text-center font-medium">{hints.dropLabel}</p>
        <p className="mb-1 text-center text-sm text-muted-foreground">{hints.helper}</p>
        <p className="mb-4 text-center text-xs text-muted-foreground">
          {DOCUMENT_TYPE_LABELS[uploadableType]}
        </p>
        <input
          id={inputId}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        <Button type="button" asChild className="rounded-xl">
          <label htmlFor={inputId} className="cursor-pointer">
            Choose file
          </label>
        </Button>
      </div>

      {status ? <p className="text-sm text-teal-700">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-muted-foreground">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
