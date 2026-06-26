import { UploadZone } from "@/components/upload-zone";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload lab results</h1>
        <p className="text-muted-foreground">
          PDF or image · $0.01 USDC per parse on Arc Network
        </p>
      </div>
      <UploadZone />
    </div>
  );
}
