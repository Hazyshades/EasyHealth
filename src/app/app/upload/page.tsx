import Link from "next/link";
import { UploadZone } from "@/components/upload-zone";

type UploadPageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const params = await searchParams;
  const documentType = params.type === "lab" ? "lab" : "lab";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload lab results</h1>
        <p className="text-muted-foreground">
          PDF or image · $0.01 USDC per parse 
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
