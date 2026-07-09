"use client";

import { use } from "react";
import { DocumentViewer } from "@/components/documents/document-viewer";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function DocumentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return <DocumentViewer documentId={id} />;
}
