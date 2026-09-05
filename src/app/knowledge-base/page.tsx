import { permanentRedirect } from "next/navigation";
import { KNOWLEDGE_BASE_ROUTE } from "@/lib/knowledge-base";

export default function KnowledgeBaseIndexRedirect() {
  permanentRedirect(KNOWLEDGE_BASE_ROUTE);
}
