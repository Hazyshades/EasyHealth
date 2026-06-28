"use client";

import { Filter, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FloatingFilterValues = {
  keyword: string;
  date: string;
  documentType: string;
  provider: string;
  category: string;
  confidence: string;
  status: string;
};

export const EMPTY_FLOATING_FILTERS: FloatingFilterValues = {
  keyword: "",
  date: "",
  documentType: "all",
  provider: "",
  category: "all",
  confidence: "all",
  status: "all",
};

type FloatingFilterMenuProps = {
  values: FloatingFilterValues;
  onChange: (values: FloatingFilterValues) => void;
  onApply?: () => void;
  onClear?: () => void;
  activeCount?: number;
};

export function FloatingFilterMenu({
  values,
  onChange,
  onApply,
  onClear,
  activeCount = 0,
}: FloatingFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function patch(partial: Partial<FloatingFilterValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="outline"
        className="rounded-xl border-[var(--eh-border)] bg-white shadow-xs"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Filter className="size-4" aria-hidden />
        Advanced filters
        {activeCount > 0 && (
          <span className="ml-1 rounded-full bg-[var(--eh-brand)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Advanced filters"
          className={cn(
            "absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-[14px] border border-[var(--eh-border)] bg-white p-4 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)]",
            "animate-in fade-in slide-in-from-top-2 duration-200"
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--eh-text-primary)]">Filters</p>
            <button
              type="button"
              aria-label="Close filters"
              className="rounded-lg p-1 text-[var(--eh-text-muted)] transition-colors hover:bg-[var(--eh-canvas-bg)] hover:text-[var(--eh-text-primary)]"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-3">
            <FilterField label="Search keyword">
              <Input
                value={values.keyword}
                onChange={(e) => patch({ keyword: e.target.value })}
                placeholder="Filename, lab, biomarker…"
                className="rounded-lg"
              />
            </FilterField>
            <FilterField label="Date">
              <Input
                type="date"
                value={values.date}
                onChange={(e) => patch({ date: e.target.value })}
                className="rounded-lg"
              />
            </FilterField>
            <FilterField label="Document type">
              <Select value={values.documentType} onValueChange={(v) => patch({ documentType: v })}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="lab">Lab results</SelectItem>
                  <SelectItem value="imaging">Imaging</SelectItem>
                  <SelectItem value="consultation">Consultations</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Provider / Lab">
              <Input
                value={values.provider}
                onChange={(e) => patch({ provider: e.target.value })}
                placeholder="Lab or provider name"
                className="rounded-lg"
              />
            </FilterField>
            <FilterField label="Biomarker category">
              <Select value={values.category} onValueChange={(v) => patch({ category: v })}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="blood">Blood</SelectItem>
                  <SelectItem value="metabolic">Metabolic</SelectItem>
                  <SelectItem value="liver">Liver</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Confidence">
              <Select value={values.confidence} onValueChange={(v) => patch({ confidence: v })}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any confidence</SelectItem>
                  <SelectItem value="high">High (80%+)</SelectItem>
                  <SelectItem value="medium">Medium (50–79%)</SelectItem>
                  <SelectItem value="low">Low (&lt;50%)</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select value={values.status} onValueChange={(v) => patch({ status: v })}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              className="flex-1 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
              onClick={() => {
                onApply?.();
                setOpen(false);
              }}
            >
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                onClear?.();
                setOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[var(--eh-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}
