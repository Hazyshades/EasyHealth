"use client";

import { useEffect, useState } from "react";
import { DocumentViewer } from "@/components/documents/document-viewer";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function DocumentDetailPage({ params }: PageProps) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  if (!id) {
    return <p className="text-sm text-[var(--eh-text-secondary)]">Loading document…</p>;
  }

  return <DocumentViewer documentId={id} />;
}
