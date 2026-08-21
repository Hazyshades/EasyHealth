"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyMeasurementOverride,
  type BaseMeasurement,
  type MeasurementOverride,
  type MeasurementValueKindKey,
} from "@/lib/documents/observation-measurement-correction";

const VALUE_KINDS: readonly MeasurementValueKindKey[] = [
  "numeric",
  "qualitative",
  "ordinal",
  "text",
];

export type ObservationCorrectionDraft = {
  value: string;
  valueText: string;
  valueKind: MeasurementValueKindKey;
  ordinal: string;
  unit: string;
  refLow: string;
  refHigh: string;
  observedAt: string;
  reason: string;
};

export type CorrectionError = {
  message: string;
  field?: string;
  code?: string;
};

export type CorrectionSaveRequest = {
  measurementOverride: MeasurementOverride;
  correctionReason: string;
  expectedActiveRevisionId: string | null;
  acknowledgeDefinitionLoss: boolean;
};

export type CorrectionUndoRequest = {
  revertToRevisionId: string;
  correctionReason: string;
  expectedActiveRevisionId: string | null;
};

export type CorrectionSaveResult =
  | { ok: true }
  | { ok: false; error: CorrectionError };

function asDraft(
  base: BaseMeasurement,
  activeOverride: MeasurementOverride | null,
): ObservationCorrectionDraft {
  const measurement = applyMeasurementOverride(base, activeOverride);
  return {
    value: measurement.value == null ? "" : String(measurement.value),
    valueText: measurement.valueText ?? "",
    valueKind: measurement.valueKind,
    ordinal: measurement.ordinal == null ? "" : String(measurement.ordinal),
    unit: measurement.unit ?? "",
    refLow: measurement.refLow == null ? "" : String(measurement.refLow),
    refHigh: measurement.refHigh == null ? "" : String(measurement.refHigh),
    observedAt: measurement.observedAt ?? "",
    reason: "",
  };
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildAbsoluteOverride(
  base: BaseMeasurement,
  draft: ObservationCorrectionDraft,
): MeasurementOverride {
  const candidate: Record<string, unknown> = {};
  const value = parseNumber(draft.value);
  const ordinal = parseNumber(draft.ordinal);
  const refLow = parseNumber(draft.refLow);
  const refHigh = parseNumber(draft.refHigh);

  if (value !== base.value) candidate.value = value;
  if (
    draft.valueText !== (base.valueText ?? "") ||
    (draft.valueKind !== base.valueKind && draft.valueKind !== "numeric")
  ) {
    candidate.value_text = draft.valueText.trim() || null;
  }
  if (draft.valueKind !== base.valueKind) {
    candidate.value_kind = draft.valueKind;
    if (draft.valueKind === "numeric" && !("value" in candidate)) {
      candidate.value = value;
    } else if (draft.valueKind !== "numeric") {
      candidate.value = null;
    }
  }
  if (draft.unit.trim() !== (base.unit ?? "").trim()) candidate.unit = draft.unit.trim();
  if (refLow !== base.refLow) candidate.ref_low = refLow;
  if (refHigh !== base.refHigh) candidate.ref_high = refHigh;
  const observedAt = draft.observedAt.trim() || null;
  if (observedAt !== base.observedAt) candidate.observed_at = observedAt;

  return candidate as MeasurementOverride;
}

export function ObservationCorrectionForm({
  base,
  activeOverride,
  activeRevisionId,
  disabled,
  draft,
  onDraftChange,
  onSave,
  previousRevision,
  onUndo,
}: {
  base: BaseMeasurement;
  activeOverride: MeasurementOverride | null;
  activeRevisionId?: string | null;
  disabled?: boolean;
  draft?: ObservationCorrectionDraft;
  onDraftChange?: (draft: ObservationCorrectionDraft) => void;
  onSave: (request: CorrectionSaveRequest) => Promise<CorrectionSaveResult>;
  previousRevision?: {
    id: string;
    createdAt: string;
    measurementOverride: MeasurementOverride | null;
  } | null;
  onUndo?: (request: CorrectionUndoRequest) => Promise<CorrectionSaveResult>;
}) {
  const initialDraft = useMemo(
    () => asDraft(base, activeOverride),
    [base, activeOverride],
  );
  const [localDraft, setLocalDraft] = useState<ObservationCorrectionDraft>(
    initialDraft,
  );
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<CorrectionError | null>(null);
  const [acknowledgeDefinitionLoss, setAcknowledgeDefinitionLoss] = useState(false);
  const [undoReason, setUndoReason] = useState("");
  const signature = JSON.stringify({ base, activeOverride });
  const [lastSignature, setLastSignature] = useState(signature);
  const currentDraft = draft ?? localDraft;
  const controlsDisabled = disabled || saving || undoing;

  useEffect(() => {
    if (!draft && lastSignature !== signature) {
      setLocalDraft(initialDraft);
      setError(null);
      setAcknowledgeDefinitionLoss(false);
      setUndoReason("");
      setLastSignature(signature);
    }
  }, [draft, initialDraft, lastSignature, signature]);

  function update(field: keyof ObservationCorrectionDraft, value: string) {
    const nextDraft = { ...currentDraft, [field]: value };
    if (!draft) setLocalDraft(nextDraft);
    onDraftChange?.(nextDraft);
    setError(null);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const result = await onSave({
        measurementOverride: buildAbsoluteOverride(base, currentDraft),
        correctionReason: currentDraft.reason,
        expectedActiveRevisionId: activeRevisionId ?? null,
        acknowledgeDefinitionLoss,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAcknowledgeDefinitionLoss(false);
      setUndoReason("");
      setLocalDraft((current) => ({ ...current, reason: "" }));
    } catch (caught) {
      setError({
        message:
          caught instanceof Error
            ? caught.message
            : "The correction could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    if (!previousRevision || !onUndo) return;
    const correctionReason = undoReason.trim();
    if (!correctionReason) {
      setError({
        message: "Explain why this correction is being reverted.",
        field: "correction_reason",
        code: "correction_reason_required",
      });
      return;
    }
    setUndoing(true);
    setError(null);
    try {
      const result = await onUndo({
        revertToRevisionId: previousRevision.id,
        correctionReason,
        expectedActiveRevisionId: activeRevisionId ?? null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUndoReason("");
    } catch (caught) {
      setError({
        message:
          caught instanceof Error
            ? caught.message
            : "The correction could not be reverted.",
      });
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--eh-text-muted)]">
        Correct reported measurement
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-[var(--eh-text-secondary)]">
          Value
          <Input
            type="number"
            value={currentDraft.value}
            onChange={(event) => update("value", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            disabled={controlsDisabled}
          />
        </label>
        <label className="text-xs text-[var(--eh-text-secondary)]">
          Value kind
          <select
            value={currentDraft.valueKind}
            onChange={(event) => update("valueKind", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            disabled={controlsDisabled}
          >
            {VALUE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-xs text-[var(--eh-text-secondary)]">
          Printed text
          <Input
            type="text"
            value={currentDraft.valueText}
            onChange={(event) => update("valueText", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            disabled={controlsDisabled}
          />
        </label>
        <label className="text-xs text-[var(--eh-text-secondary)]">
          Unit
          <Input
            type="text"
            value={currentDraft.unit}
            onChange={(event) => update("unit", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            disabled={controlsDisabled}
          />
        </label>
        <label className="text-xs text-[var(--eh-text-secondary)]">
          Date
          <Input
            type="date"
            value={currentDraft.observedAt}
            onChange={(event) => update("observedAt", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            disabled={controlsDisabled}
          />
        </label>
        <label className="text-xs text-[var(--eh-text-secondary)]">
          Reference low
          <Input
            type="number"
            value={currentDraft.refLow}
            onChange={(event) => update("refLow", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            disabled={controlsDisabled}
          />
        </label>
        <label className="text-xs text-[var(--eh-text-secondary)]">
          Reference high
          <Input
            type="number"
            value={currentDraft.refHigh}
            onChange={(event) => update("refHigh", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            disabled={controlsDisabled}
          />
        </label>
      </div>
      {error?.code === "unit_dimension_conflict" ? (
        <label className="mt-2 flex items-start gap-2 text-xs text-[var(--eh-text-secondary)]">
          <input
            type="checkbox"
            checked={acknowledgeDefinitionLoss}
            onChange={(event) => setAcknowledgeDefinitionLoss(event.target.checked)}
            disabled={controlsDisabled}
            className="mt-0.5"
          />
          <span>
            I understand that this unit may leave the current measurement mapping
            unresolved.
          </span>
        </label>
      ) : null}
      <label className="mt-2 block text-xs text-[var(--eh-text-secondary)]">
        Reason for correction
        <Textarea
          value={currentDraft.reason}
          onChange={(event) => update("reason", event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
          placeholder="Explain what the report actually says"
          disabled={controlsDisabled}
        />
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error.field ? `${error.field}: ` : ""}
          {error.message}
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="mt-2"
        disabled={controlsDisabled}
        onClick={() => void submit()}
      >
        {saving ? "Saving…" : "Save correction"}
      </Button>
      {previousRevision && onUndo ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-[var(--eh-text-secondary)]">
            An earlier saved revision is available. Restoring it creates a new
            append-only revision.
          </p>
          <Textarea
            value={undoReason}
            onChange={(event) => {
              setUndoReason(event.target.value);
              setError(null);
            }}
            rows={2}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            placeholder="Explain why this correction is being reverted"
            aria-label="Reason for reverting the correction"
            disabled={controlsDisabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={controlsDisabled || !undoReason.trim()}
            onClick={() => void undo()}
          >
            {undoing ? "Restoring…" : "Undo correction"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
