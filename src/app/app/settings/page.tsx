import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader subtitle="Manage your EasyHealth preferences" compact />

      <SurfaceCard className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">AI Settings</p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            Choose whether EasyHealth uses ChatGPT, DeepSeek, or Owl Alpha for
          document extraction and reports.
          </p>
        </div>
        <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/settings/ai">Open AI Settings</Link>
        </Button>
      </SurfaceCard>
    </div>
  );
}
