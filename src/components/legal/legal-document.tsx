import { readFile } from "fs/promises";
import path from "path";
import ReactMarkdown from "react-markdown";

type LegalDocumentProps = {
  markdown: string;
};

export function LegalDocument({ markdown }: LegalDocumentProps) {
  return (
    <article className="legal-document mx-auto max-w-3xl px-4 py-12 text-[var(--eh-text-primary)] [&_h1]:mb-6 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-[var(--eh-text-secondary)] [&_strong]:font-semibold [&_strong]:text-[var(--eh-text-primary)] [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-[var(--eh-brand)] [&_a]:underline">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </article>
  );
}

export async function loadLegalMarkdown(filename: "privacy.md" | "terms.md" | "cookies.md") {
  const filePath = path.join(process.cwd(), "content", "legal", filename);
  return readFile(filePath, "utf-8");
}
