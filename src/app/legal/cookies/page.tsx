import Link from "next/link";
import { LegalDocument, loadLegalMarkdown } from "@/components/legal/legal-document";

export default async function CookiePolicyPage() {
  const markdown = await loadLegalMarkdown("cookies.md");

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--eh-border)] px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[var(--eh-brand)]">
            ← EasyHealth
          </Link>
        </div>
      </header>
      <LegalDocument markdown={markdown} />
    </div>
  );
}
