import Link from "next/link";
import { UploadZone } from "@/components/upload-zone";
import {
  DOCUMENT_TYPE_LABELS,
  isUploadableDocumentType,
  normalizeDocumentType,
  type DocumentType,
} from "@/lib/health-systems";

type UploadPageProps = {
  searchParams: Promise<{ type?: string }>;
};

const UPLOAD_COPY: Record<
  Extract<
    DocumentType,
    | "lab_result"
    | "instrumental_report"
    | "consultation_note"
    | "discharge_summary"
    | "prescription"
    | "referral"
  >,
  { title: string; subtitle: string }
> = {
  lab_result: {
    title: "Upload lab results",
    subtitle: "Blood tests, urinalysis, pathology, and other lab reports · $0.01 USDC per parse",
  },
  instrumental_report: {
    title: "Upload imaging study",
    subtitle: "Ultrasound, X-ray, CT, MRI, ECG, EEG, and other instrumental reports · $0.01 USDC",
  },
  consultation_note: {
    title: "Upload consultation",
    subtitle: "Specialist visit notes, exam records, and clinical consultations · $0.01 USDC",
  },
  discharge_summary: {
    title: "Upload discharge summary",
    subtitle: "Hospital discharge summaries with course of care and medications · $0.01 USDC",
  },
  prescription: {
    title: "Upload prescription",
    subtitle: "Medication prescriptions and prescription lists · $0.01 USDC",
  },
  referral: {
    title: "Upload referral",
    subtitle: "Referral letters to specialists · $0.01 USDC",
  },
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const params = await searchParams;
  const rawType = params.type ?? "lab_result";
  const normalized = normalizeDocumentType(rawType);
  const documentType = (
    normalized && isUploadableDocumentType(normalized) ? normalized : "lab_result"
  ) as keyof typeof UPLOAD_COPY;
  const copy = UPLOAD_COPY[documentType];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.subtitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Document type: {DOCUMENT_TYPE_LABELS[documentType]}
        </p>
        <p className="mt-2 text-sm">
          <Link href="/app/documents" className="text-teal-700 hover:underline">
            Back to Documents
          </Link>
        </p>
      </div>
      <UploadZone documentType={documentType} redirectTo="/app/documents" />
    </div>
  );
}
