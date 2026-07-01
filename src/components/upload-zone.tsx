"use client";



import { useCallback, useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { useWallet } from "@/components/wallet-provider";

import {

  ensureGatewayFunded,

  isPaidRequestFailedError,

  payForResource,

  retryWithEntitlement,

} from "@/lib/payments/gateway-client";

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
    helper: "Pay $0.01 USDC per upload · OCR + biomarker extraction",
  },
  instrumental_report: {
    dropLabel: "Drop an imaging or instrumental report here",
    helper: "Pay $0.01 USDC per upload · Structured findings extraction",
  },
  consultation_note: {
    dropLabel: "Drop a consultation note or visit record here",
    helper: "Pay $0.01 USDC per upload · Clinical note extraction",
  },
  discharge_summary: {
    dropLabel: "Drop a hospital discharge summary here",
    helper: "Pay $0.01 USDC per upload · Discharge summary extraction",
  },
  prescription: {
    dropLabel: "Drop a prescription or medication list here",
    helper: "Pay $0.01 USDC per upload · Prescription extraction",
  },
  referral: {
    dropLabel: "Drop a referral letter here",
    helper: "Pay $0.01 USDC per upload · Referral extraction",
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

  const { fundGatewayWallet } = useWallet();

  const [dragging, setDragging] = useState(false);

  const [status, setStatus] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [entitlementId, setEntitlementId] = useState<string | null>(null);

  const [retrying, setRetrying] = useState(false);



  const uploadableType =

    documentType === "dicom" ? "lab_result" : documentType;

  const hints =

    UPLOAD_HINTS[uploadableType as keyof typeof UPLOAD_HINTS] ?? UPLOAD_HINTS.lab_result;

  const inputId = `upload-${uploadableType}`;



  const completeUpload = useCallback(

    (formattedAmount: string, documentId?: string) => {

      setStatus(`Paid ${formattedAmount} USDC — document queued for processing`);

      setEntitlementId(null);

      setPendingFile(null);

      const target = documentId ? `/app/documents/${documentId}` : redirectTo;

      setTimeout(() => router.push(target), 1500);

    },

    [router, redirectTo]

  );



  const uploadFile = useCallback(

    async (file: File, options?: { entitlementId?: string; autoRetry?: boolean }) => {

      setError(null);

      setPendingFile(file);

      setRetrying(!!options?.entitlementId);



      try {

        const formData = buildFormData(file, uploadableType);



        if (options?.entitlementId) {

          setStatus("Retrying upload without additional charge…");

          const result = await retryWithEntitlement<{ documentId?: string }>(

            `${window.location.origin}/api/upload`,

            options.entitlementId,

            { method: "POST", body: formData }

          );

          completeUpload(result.formattedAmount, result.data.documentId);

          return;

        }



        setStatus("Preparing Arc Gateway payment ($0.01 USDC)…");

        setStatus("Checking Gateway balance…");

        await ensureGatewayFunded("0.02", fundGatewayWallet);



        setStatus("Paying and uploading…");

        const result = await payForResource(`${window.location.origin}/api/upload`, {

          method: "POST",

          body: formData,

        });



        const payload = result.data as { documentId?: string };

        completeUpload(result.formattedAmount, payload.documentId);

      } catch (e) {

        if (

          options?.autoRetry !== false &&

          isPaidRequestFailedError(e) &&

          e.entitlementId &&

          e.retryWithoutPayment

        ) {

          await uploadFile(file, { entitlementId: e.entitlementId, autoRetry: false });

          return;

        }



        if (isPaidRequestFailedError(e) && e.entitlementId && e.retryWithoutPayment) {

          setEntitlementId(e.entitlementId);

        } else {

          setEntitlementId(null);

        }



        setError(e instanceof Error ? e.message : "Upload failed");

        setStatus(null);

      } finally {

        setRetrying(false);

      }

    },

    [uploadableType, fundGatewayWallet, completeUpload]

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

            if (file) uploadFile(file);

          }}

        />

        <Button variant="secondary" type="button" onClick={() => document.getElementById(inputId)?.click()}>

          Choose file

        </Button>

      </div>



      {status && <p className="text-sm text-teal-700">{status}</p>}

      {error && (

        <div className="space-y-2">

          <p className="text-sm text-red-600">{error}</p>

          {entitlementId && pendingFile && (

            <Button

              type="button"

              variant="outline"

              disabled={retrying}

              onClick={() => uploadFile(pendingFile, { entitlementId })}

            >

              {retrying ? "Retrying…" : "Retry upload (no extra charge)"}

            </Button>

          )}

        </div>

      )}

      <p className="text-xs text-muted-foreground">{MEDICAL_DISCLAIMER}</p>

    </div>

  );

}

