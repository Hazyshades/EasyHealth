"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Document = {
  id: string;
  status: string;
};

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents ?? []))
      .finally(() => setLoading(false));
  }, []);

  const completed = documents.filter((d) => d.status === "completed").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Your personal health record at a glance
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : completed === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold">No lab records yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload your first lab to extract biomarkers and build your health profile.
          </p>
          <Button asChild className="mt-4">
            <Link href="/app/upload">Upload your lab - $0.01</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">Completed records</p>
            <p className="mt-1 text-3xl font-bold">{completed}</p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">Quick links</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/app/profile" className="text-teal-700 hover:underline">
                View Health Profile
              </Link>
              <Link href="/app/biomarkers" className="text-teal-700 hover:underline">
                View Biomarkers
              </Link>
              <Link href="/app/documents" className="text-teal-700 hover:underline">
                Browse Documents
              </Link>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">Reports</p>
            <Button asChild variant="secondary" className="mt-3 w-full">
              <Link href="/app/summary">Doctor summary - $0.05</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
