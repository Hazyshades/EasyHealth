"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { depositToGateway, payForResource } from "@/lib/payments/gateway-client";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

export function UploadZone() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("Preparing Arc Gateway payment ($0.01 USDC)…");

      try {
        await depositToGateway("0.05").catch(() => {
          /* may already have balance */
        });

        setStatus("Paying and uploading…");
        const formData = new FormData();
        formData.append("file", file);

        const result = await payForResource(`${window.location.origin}/api/upload`, {
          method: "POST",
          body: formData,
        });

        setStatus(`Paid ${result.formattedAmount} USDC - processing complete`);
        setTimeout(() => router.push("/app"), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        setStatus(null);
      }
    },
    [router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
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
        <p className="mb-2 text-center font-medium">Drop a lab PDF or image here</p>
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Pay $0.01 USDC on Arc Network per upload · OCR + biomarker extraction
        </p>
        <input
          id="lab-upload"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
        <Button variant="secondary" type="button" onClick={() => document.getElementById("lab-upload")?.click()}>
          Choose file
        </Button>
      </div>

      {status && <p className="text-sm text-teal-700">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
