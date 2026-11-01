"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Check, FileText, Info, ThumbsDown, ThumbsUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import type {
  AssistantFeedbackCategory,
  AssistantResponse,
} from "@/lib/assistant/contract";

type AccessState = "loading" | "ready" | "blocked" | "error";
type FeedbackRating = "positive" | "negative";

type AccessResponse = {
  enabled?: boolean;
  reason?: string;
  limitation_code?: string | null;
  error?: string;
};

type AssistantResponseBody = AssistantResponse & { error?: string; code?: string };

const SUGGESTIONS = [
  "What is in my latest lab result?",
  "Show recorded changes in my health documents.",
  "What does a reference range mean?",
];

const LIMITATION_LABELS: Record<string, string> = {
  NO_PERSONAL_EVIDENCE: "No eligible personal evidence was found.",
  UNSUPPORTED_CLAIM: "Some claims were removed because they lacked a source.",
  UNSAFE_REQUEST: "This request needs a qualified healthcare professional.",
  MEDICATION_SAFETY: "Medication and dose decisions stay with a clinician.",
  GENERAL_INFORMATION: "General information only. It is not a personal assessment.",
  SEMANTIC_RETRIEVAL_UNAVAILABLE: "Narrative document search is temporarily unavailable.",
  SOURCE_UNAVAILABLE: "A source was unavailable and was not used.",
  QUOTA_EXCEEDED: "The beta request limit has been reached.",
  PROVIDER_UNAVAILABLE: "The assistant provider is temporarily unavailable.",
  BETA_ACCESS_REQUIRED: "Assistant access is limited to invited beta participants.",
  CONSENT_REQUIRED: "Current profile details and consent are required before using the assistant.",
};

const FEEDBACK_CATEGORIES: ReadonlyArray<{
  value: AssistantFeedbackCategory;
  label: string;
}> = [
  { value: "answer_quality", label: "Answer quality" },
  { value: "missing_evidence", label: "Missing evidence" },
  { value: "safety", label: "Safety" },
  { value: "latency", label: "Slow response" },
  { value: "other", label: "Other" },
];

function limitationLabel(code: string): string {
  return LIMITATION_LABELS[code] ?? "The assistant returned a limited answer.";
}

function AssistantIntro() {
  return (
    <SurfaceCard padding="lg" className="border-[var(--eh-brand-soft)] bg-[var(--eh-brand-soft)]/35">
      <div className="flex gap-3">
        <Info className="mt-0.5 size-5 shrink-0 text-[var(--eh-brand)]" aria-hidden />
        <div>
          <h2 className="font-semibold text-[var(--eh-text-primary)]">Before you ask</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
            <li>Answers may use active, processed records linked to this profile.</li>
            <li>Personal statements must include a source link or the assistant will limit the answer.</li>
            <li>This assistant does not diagnose, prescribe, or decide medication changes.</li>
          </ul>
          <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
            For beta feedback, use the controls under an answer. Contact the support channel listed in your beta invite.
          </p>
        </div>
      </div>
    </SurfaceCard>
  );
}

function AnswerCard({
  answer,
  onFeedback,
  feedbackState,
}: {
  answer: AssistantResponse;
  onFeedback: (rating: FeedbackRating, category?: AssistantFeedbackCategory) => Promise<void>;
  feedbackState: { rating: FeedbackRating | null; category: AssistantFeedbackCategory | null; sending: boolean; sent: boolean; error: string | null };
}) {
  const [pendingCategory, setPendingCategory] = useState<AssistantFeedbackCategory | null>(feedbackState.category);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  async function submitFeedback() {
    if (!pendingCategory) return;
    await onFeedback("negative", pendingCategory);
    setFeedbackMessage("Feedback received");
  }

  return (
    <SurfaceCard padding="lg" className="space-y-5" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--eh-brand)]">Assistant answer</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--eh-text-primary)]">Evidence first</h2>
        </div>
        <StatusChip variant="neutral">{answer.mode.replaceAll("_", " ")}</StatusChip>
      </div>

      <p className="whitespace-pre-wrap text-[15px] leading-7 text-[var(--eh-text-primary)]">{answer.answer}</p>

      {answer.limitations.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Limits for this answer</p>
          <ul className="mt-2 space-y-1.5">
            {answer.limitations.map((code) => (
              <li key={code}>{limitationLabel(code)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-[var(--eh-text-primary)]">Sources</h3>
          <span className="text-sm text-[var(--eh-text-muted)]">{answer.citations.length} linked</span>
        </div>
        {answer.citations.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {answer.citations.map((citation) => (
              <li key={citation.source_id}>
                {citation.href ? (
                  <Link
                    href={citation.href}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--eh-border)] px-3 py-2 text-sm text-[var(--eh-brand)] transition-colors hover:border-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{citation.label}</span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                  </Link>
                ) : (
                  <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--eh-border)] px-3 py-2 text-sm text-[var(--eh-text-secondary)]">
                    <FileText className="size-4 shrink-0" aria-hidden />
                    <span>{citation.label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--eh-text-muted)]">No source was linked to this answer.</p>
        )}
      </div>

      <div className="border-t border-[var(--eh-border)] pt-4">
        <p className="text-sm font-medium text-[var(--eh-text-primary)]">Was this answer useful?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={feedbackState.rating === "positive" ? "default" : "outline"}
            className="min-h-11 rounded-xl"
            disabled={feedbackState.sending || feedbackState.sent}
            onClick={() => void onFeedback("positive")}
          >
            <ThumbsUp className="size-4" aria-hidden />
            Yes
          </Button>
          <Button
            type="button"
            variant={feedbackState.rating === "negative" ? "default" : "outline"}
            className="min-h-11 rounded-xl"
            disabled={feedbackState.sending || feedbackState.sent}
            onClick={() => setPendingCategory("answer_quality")}
          >
            <ThumbsDown className="size-4" aria-hidden />
            Not yet
          </Button>
        </div>
        {pendingCategory && feedbackState.rating !== "positive" && !feedbackState.sent ? (
          <div className="mt-3 space-y-3 rounded-xl bg-[var(--eh-surface-muted)] p-3">
            <label className="block text-sm font-medium text-[var(--eh-text-primary)]" htmlFor="assistant-feedback-category">
              What should we review?
            </label>
            <select
              id="assistant-feedback-category"
              value={pendingCategory}
              onChange={(event) => setPendingCategory(event.target.value as AssistantFeedbackCategory)}
              className="min-h-11 w-full rounded-xl border border-[var(--eh-border)] bg-white px-3 text-sm text-[var(--eh-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
            >
              {FEEDBACK_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <Button type="button" className="min-h-11 rounded-xl" disabled={feedbackState.sending} onClick={() => void submitFeedback()}>
              {feedbackState.sending ? "Sending" : "Send feedback"}
            </Button>
          </div>
        ) : null}
        {feedbackState.sent || feedbackMessage ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700">
            <Check className="size-4" aria-hidden />
            Feedback received.
          </p>
        ) : null}
        {feedbackState.error ? <p className="mt-2 text-sm text-red-700">{feedbackState.error}</p> : null}
      </div>

      <p className="text-xs leading-5 text-[var(--eh-text-muted)]">{answer.safety.disclaimer}</p>
    </SurfaceCard>
  );
}

export default function AssistantPage() {
  const [accessState, setAccessState] = useState<AccessState>("loading");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<{
    rating: FeedbackRating | null;
    category: AssistantFeedbackCategory | null;
    sending: boolean;
    sent: boolean;
    error: string | null;
  }>({ rating: null, category: null, sending: false, sent: false, error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/assistant", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as AccessResponse;
        if (!active) return;
        if (response.ok && body.enabled) setAccessState("ready");
        else if (response.status === 403 || body.limitation_code === "BETA_ACCESS_REQUIRED") setAccessState("blocked");
        else setAccessState("error");
      })
      .catch(() => {
        if (active) setAccessState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitQuestion(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading || accessState !== "ready") return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setFeedbackState({ rating: null, category: null, sending: false, sent: false, error: null });
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = (await response.json().catch(() => ({}))) as AssistantResponseBody;
      if (!response.ok) {
        if (response.status === 403) setAccessState("blocked");
        throw new Error(
          response.status === 429
            ? "The beta request limit has been reached. Try again after the reset time shown by support."
            : body.error ?? "The assistant could not answer this question.",
        );
      }
      setAnswer(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not answer this question.");
    } finally {
      setLoading(false);
    }
  }

  async function showSyntheticExample() {
    setQuestion("How are sources shown in an assistant answer?");
    setLoading(true);
    setError(null);
    setAnswer(null);
    setFeedbackState({ rating: null, category: null, sending: false, sent: false, error: null });
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "How are sources shown in an assistant answer?", synthetic_example: true }),
      });
      const body = (await response.json().catch(() => ({}))) as AssistantResponseBody;
      if (!response.ok) throw new Error(body.error ?? "The example is unavailable.");
      setAnswer(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The example is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(rating: FeedbackRating, category?: AssistantFeedbackCategory) {
    if (!answer || feedbackState.sending || feedbackState.sent) return;
    setFeedbackState((current) => ({ ...current, rating, category: category ?? null, sending: true, error: null }));
    try {
      const response = await fetch("/api/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: answer.request_id, rating, category: category ?? null }),
      });
      if (!response.ok) throw new Error("Feedback could not be recorded.");
      setFeedbackState((current) => ({ ...current, sending: false, sent: true }));
    } catch (feedbackError) {
      setFeedbackState((current) => ({
        ...current,
        sending: false,
        error: feedbackError instanceof Error ? feedbackError.message : "Feedback could not be recorded.",
      }));
    }
  }

  function chooseSuggestion(value: string) {
    setQuestion(value);
    window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus());
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Ask about your records"
        subtitle="Review grounded summaries with visible sources."
      />

      {accessState === "loading" ? (
        <div className="space-y-4" role="status" aria-label="Loading assistant">
          <Skeleton className="h-36 w-full rounded-[16px]" />
          <Skeleton className="h-56 w-full rounded-[16px]" />
        </div>
      ) : accessState === "blocked" ? (
        <SurfaceCard padding="lg" className="space-y-4">
          <StatusChip variant="neutral">Closed beta</StatusChip>
          <h2 className="text-xl font-semibold text-[var(--eh-text-primary)]">Assistant access is not enabled</h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--eh-text-secondary)]">
            This surface is available only to invited beta participants with current profile details and consent. Contact the support channel listed in your beta invite if you need access help.
          </p>
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/app/profile">Review profile details</Link>
          </Button>
        </SurfaceCard>
      ) : accessState === "error" ? (
        <SurfaceCard padding="lg" className="space-y-3">
          <h2 className="text-xl font-semibold text-[var(--eh-text-primary)]">Assistant access could not be checked</h2>
          <p className="text-sm text-[var(--eh-text-secondary)]">Try again later or contact the support channel listed in your beta invite.</p>
          <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </SurfaceCard>
      ) : (
        <>
          <AssistantIntro />
          <SurfaceCard padding="lg">
            <form ref={formRef} onSubmit={submitQuestion} className="space-y-4">
              <div>
                <label htmlFor="assistant-question" className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  What would you like to review?
                </label>
                <textarea
                  id="assistant-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      formRef.current?.requestSubmit();
                    }
                  }}
                  placeholder="For example: What was recorded in my latest lab result?"
                  maxLength={2_000}
                  rows={5}
                  className="mt-2 block min-h-32 w-full resize-y rounded-xl border border-[var(--eh-border)] bg-white px-4 py-3 text-[15px] leading-6 text-[var(--eh-text-primary)] placeholder:text-[var(--eh-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                  aria-describedby="assistant-question-help"
                />
                <p id="assistant-question-help" className="mt-2 text-xs text-[var(--eh-text-muted)]">
                  Ctrl+Enter or Command+Enter submits. Do not include urgent symptoms or requests to change medication.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" className="min-h-11 rounded-xl" disabled={loading || !question.trim()}>
                  {loading ? "Reviewing records" : "Ask assistant"}
                </Button>
                <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={loading} onClick={() => void showSyntheticExample()}>
                  View synthetic example
                </Button>
              </div>
            </form>
            <div className="mt-5 border-t border-[var(--eh-border)] pt-4">
              <p className="text-sm font-medium text-[var(--eh-text-primary)]">Try a focused question</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="min-h-11 rounded-full border border-[var(--eh-border)] px-3 text-left text-sm text-[var(--eh-text-secondary)] transition-colors hover:border-[var(--eh-brand)] hover:text-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                    onClick={() => chooseSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </SurfaceCard>

          {error ? (
            <SurfaceCard padding="md" className="border-red-200 bg-red-50" role="alert">
              <p className="text-sm text-red-800">{error}</p>
            </SurfaceCard>
          ) : null}

          {loading ? (
            <SurfaceCard padding="lg" className="space-y-4" role="status" aria-label="Generating assistant answer">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-16 w-full" />
            </SurfaceCard>
          ) : null}

          {answer ? (
            <AnswerCard
              key={answer.request_id}
              answer={answer}
              onFeedback={sendFeedback}
              feedbackState={feedbackState}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
