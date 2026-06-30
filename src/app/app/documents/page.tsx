"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { FilterChip } from "@/components/ui/filter-chip";
import { SearchInput } from "@/components/ui/search-input";
import { StatusChip } from "@/components/ui/status-chip";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  FloatingFilterMenu,
  EMPTY_FLOATING_FILTERS,
  type FloatingFilterValues,
} from "@/components/ui/floating-filter-menu";
import { Button } from "@/components/ui/button";
import type { DocumentType } from "@/lib/health-systems";

type Document = {
  id: string;
  original_filename: string;
  status: "processing" | "completed" | "failed";
  processing_status: string;
  document_type: DocumentType;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  error_message: string | null;
  has_thumbnail: boolean;
  is_legacy: boolean;
};

const TABS: { id: DocumentType | "dicom"; label: string }[] = [
  { id: "lab", label: "Lab results" },
  { id: "imaging", label: "Imaging" },
  { id: "consultation", label: "Consultations" },
  { id: "dicom", label: "DICOM" },
];

function displayStatus(doc: Document): string {
  return doc.processing_status || doc.status;
}

function statusVariant(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "completed" || status === "ready") return "success";
  if (status === "failed") return "error";
  if (status === "needs_review") return "warning";
  return "warning";
}

function DocumentThumb({ documentId, hasThumbnail }: { documentId: string; hasThumbnail: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasThumbnail) return;
    fetch(`/api/documents/${documentId}/thumbnail`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUrl(data?.url ?? null))
      .catch(() => undefined);
  }, [documentId, hasThumbnail]);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="size-10 rounded-lg object-cover" />
    );
  }

  return (
    <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
      <FileText className="size-5" aria-hidden />
    </div>
  );
}

function countActiveFilters(filters: FloatingFilterValues, search: string): number {
  let count = search.trim() ? 1 : 0;
  if (filters.keyword.trim()) count++;
  if (filters.date) count++;
  if (filters.documentType !== "all") count++;
  if (filters.provider.trim()) count++;
  if (filters.category !== "all") count++;
  if (filters.confidence !== "all") count++;
  if (filters.status !== "all") count++;
  return count;
}

function applyClientFilters(docs: Document[], search: string, filters: FloatingFilterValues) {
  const q = (search || filters.keyword).trim().toLowerCase();
  return docs.filter((doc) => {
    const status = displayStatus(doc);
    if (filters.status !== "all" && status !== filters.status && doc.status !== filters.status) {
      return false;
    }
    if (filters.documentType !== "all" && doc.document_type !== filters.documentType) return false;
    if (filters.date && doc.observed_at && !doc.observed_at.startsWith(filters.date)) return false;
    if (filters.provider.trim()) {
      const provider = (doc.lab_name ?? "").toLowerCase();
      if (!provider.includes(filters.provider.trim().toLowerCase())) return false;
    }
    if (q) {
      const haystack = [doc.original_filename, doc.lab_name ?? "", doc.document_type]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<DocumentType | "dicom">("lab");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FloatingFilterValues>(EMPTY_FLOATING_FILTERS);

  const loadDocuments = useCallback(() => {
    setLoading(true);
    fetch(`/api/documents?type=${activeTab}`)
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

  useEffect(() => {
    const hasProcessing = documents.some((d) => displayStatus(d) === "processing");
    if (!hasProcessing) return;
    const timer = setInterval(loadDocuments, 10000);
    return () => clearInterval(timer);
  }, [documents, loadDocuments]);

  const filteredDocuments = useMemo(
    () => applyClientFilters(documents, search, filters),
    [documents, search, filters]
  );

  const activeFilterCount = countActiveFilters(filters, search);

  function clearFilters() {
    setSearch("");
    setFilters(EMPTY_FLOATING_FILTERS);
  }

  return (
    <div>
      <PageHeader
        subtitle="Upload and browse your medical records"
        actions={
          activeTab === "lab" ? (
            <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
              <Link href="/app/upload?type=lab">
                <Upload className="size-4" aria-hidden />
                Upload document
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search documents"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FloatingFilterMenu
            values={filters}
            onChange={setFilters}
            activeCount={activeFilterCount}
            onClear={clearFilters}
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <FilterChip
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </FilterChip>
        ))}
      </div>

      {activeTab === "dicom" ? (
        <SurfaceCard padding="lg" className="border-dashed text-center">
          <h2 className="font-semibold text-[var(--eh-text-primary)]">DICOM viewer coming soon</h2>
          <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
            DICOM upload and imaging viewer are not available in this MVP.
          </p>
        </SurfaceCard>
      ) : loading ? (
        <p className="text-sm text-[var(--eh-text-secondary)]">Loading documents…</p>
      ) : filteredDocuments.length === 0 ? (
        <SurfaceCard padding="lg" className="text-center">
          <p className="text-sm text-[var(--eh-text-secondary)]">
            {documents.length === 0
              ? `No ${TABS.find((t) => t.id === activeTab)?.label.toLowerCase()} yet.`
              : "No documents match your filters."}
          </p>
          {documents.length === 0 && activeTab === "lab" ? (
            <Button asChild className="mt-4 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
              <Link href="/app/upload?type=lab">Upload your lab</Link>
            </Button>
          ) : (
            <Button variant="outline" className="mt-4 rounded-xl" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </SurfaceCard>
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-14">
                    <span className="sr-only">Preview</span>
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Document</DataTableHeaderCell>
                  <DataTableHeaderCell>Type</DataTableHeaderCell>
                  <DataTableHeaderCell>Date</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Provider</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filteredDocuments.map((doc) => (
                  <DataTableRow key={doc.id} className="cursor-pointer hover:bg-slate-50">
                    <DataTableCell>
                      <Link href={`/app/documents/${doc.id}`} className="block">
                        <DocumentThumb documentId={doc.id} hasThumbnail={doc.has_thumbnail} />
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="font-medium">
                      <Link href={`/app/documents/${doc.id}`} className="hover:text-[var(--eh-brand)]">
                        {doc.original_filename}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusChip variant="neutral">{doc.document_type}</StatusChip>
                    </DataTableCell>
                    <DataTableCell className="text-[var(--eh-text-secondary)]">
                      {doc.observed_at ?? "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusChip variant={statusVariant(displayStatus(doc))}>
                        {displayStatus(doc)}
                      </StatusChip>
                    </DataTableCell>
                    <DataTableCell className="text-[var(--eh-text-secondary)]">
                      {doc.lab_name ?? "Unknown lab"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>

          <ul className="space-y-3 md:hidden">
            {filteredDocuments.map((doc) => (
              <li key={doc.id}>
                <Link href={`/app/documents/${doc.id}`}>
                  <SurfaceCard padding="sm" className="transition hover:border-[var(--eh-brand)]">
                    <div className="flex items-start gap-3">
                      <DocumentThumb documentId={doc.id} hasThumbnail={doc.has_thumbnail} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--eh-text-primary)]">
                          {doc.original_filename}
                        </p>
                        <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                          {doc.lab_name ?? "Unknown lab"}
                          {doc.observed_at ? ` · ${doc.observed_at}` : ""}
                        </p>
                        {(doc.status === "failed" || displayStatus(doc) === "failed") &&
                          doc.error_message && (
                            <p className="mt-2 text-xs text-red-600">{doc.error_message}</p>
                          )}
                      </div>
                      <StatusChip variant={statusVariant(displayStatus(doc))}>
                        {displayStatus(doc)}
                      </StatusChip>
                    </div>
                  </SurfaceCard>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
