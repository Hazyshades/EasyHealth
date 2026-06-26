"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/lib/health-systems";

type Document = {
  id: string;
  original_filename: string;
  status: "processing" | "completed" | "failed";
  document_type: DocumentType;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  error_message: string | null;
};

const TABS: { id: DocumentType | "dicom"; label: string }[] = [
  { id: "lab", label: "Lab results" },
  { id: "imaging", label: "Imaging reports" },
  { id: "consultation", label: "Consultations" },
  { id: "dicom", label: "DICOM" },
];

function statusVariant(status: Document["status"]) {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<DocumentType | "dicom">("lab");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocuments = useCallback(() => {
    setLoading(true);
    const url = `/api/documents?type=${activeTab}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents ?? []))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "dicom") {
      setDocuments([]);
      setLoading(false);
      return;
    }
    loadDocuments();
  }, [activeTab, loadDocuments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            Upload and browse your medical records
          </p>
        </div>
        {activeTab === "lab" && (
          <Button asChild>
            <Link href="/app/upload?type=lab">Upload your lab</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              activeTab === tab.id
                ? "bg-teal-100 font-medium text-teal-900"
                : "text-muted-foreground hover:bg-slate-100"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dicom" ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center">
          <h2 className="font-semibold">DICOM viewer coming soon</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            DICOM upload and imaging viewer are not available in this MVP.
          </p>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No {TABS.find((t) => t.id === activeTab)?.label.toLowerCase()} yet.
          </p>
          {activeTab === "lab" && (
            <Button asChild className="mt-4" variant="secondary">
              <Link href="/app/upload?type=lab">Upload your lab</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium">{doc.original_filename}</p>
                <p className="text-sm text-muted-foreground">
                  {doc.lab_name ?? "Unknown lab"}
                  {doc.observed_at ? ` · ${doc.observed_at}` : ""}
                </p>
                {doc.status === "failed" && doc.error_message && (
                  <p className="mt-1 text-sm text-red-600">{doc.error_message}</p>
                )}
              </div>
              <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
