"use client";

import { Suspense, use } from "react";
import { DocumentViewer } from "@/components/documents/document-viewer";
import { ReviewWorkspaceSkeleton } from "@/components/documents/review/review-workspace-skeleton";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function DocumentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <Suspense fallback={<ReviewWorkspaceSkeleton />}>
      <DocumentViewer documentId={id} />
    </Suspense>
  );
}
