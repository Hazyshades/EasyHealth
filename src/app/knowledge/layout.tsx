import { KnowledgeHeader } from "@/components/knowledge-base/knowledge-header";

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="eh-knowledge">
      <KnowledgeHeader />
      <main>{children}</main>
    </div>
  );
}
