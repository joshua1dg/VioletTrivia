"use client";

// Real "use client" — owns open/pending/error state via hooks, and fires the
// verdict actions imperatively via useTransition (no <form> in sight), same
// reasoning as ConfirmDelete: Deny needs to hold a note open before it
// submits, which useActionState's single-payload shape doesn't fit as
// cleanly as two explicit calls.

import Link from "next/link";
import { useState, useTransition } from "react";

import { ErrorNote, SubmitButton, toErrorLike, type ErrorLike } from "@/components/feedback";
import type { QuestionSummary } from "@/lib/services/questions";

import { approveQuestion, denyQuestion } from "../actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * One row of the pending pile. Curators may open the full question in the
 * editor (the link), or resolve it right here: Approve is one click,
 * flipping the question to `approved` + `live` in the same breath (the
 * service's doing, not this component's); Deny expands an inline note field
 * because the note IS the feedback channel — there are no notifications.
 *
 * `AppError("conflict")` (stale screen — someone else already resolved this
 * row) surfaces through the same ErrorNote as validation errors; the row
 * simply stays until the page revalidates and it disappears from the pile.
 */
export function QueueRow({ question }: { question: QuestionSummary }) {
  const [denyOpen, setDenyOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await approveQuestion(question.id);
        if (!result.ok) setError(result.message);
      } catch (e) {
        setError(toErrorLike(e));
      }
    });
  }

  function submitDenial() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await denyQuestion(question.id, note);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setDenyOpen(false);
        setNote("");
      } catch (e) {
        setError(toErrorLike(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5 border-b border-line-3 px-4 py-3.5 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/admin/questions/${question.id}`}
            className="truncate text-[13.5px] text-ink-3 hover:underline"
          >
            {question.prompt}
          </Link>
          <p className="truncate text-[12.5px] text-muted-3">
            {question.excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-3">
            <span>{question.templateLabel}</span>
            <span aria-hidden>·</span>
            <span>{question.authorLabel ?? "Unknown submitter"}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(question.updatedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SubmitButton type="button" onClick={approve} pending={pending}>
            Approve
          </SubmitButton>
          <button
            type="button"
            onClick={() => setDenyOpen((v) => !v)}
            disabled={pending}
            className="cursor-pointer rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            Deny
          </button>
        </div>
      </div>

      {denyOpen && (
        <div className="flex flex-col gap-2 rounded-[8px] border border-line bg-surface p-3">
          <label className="text-[11.5px] tracking-[0.04em] text-faint">
            WHY — the note is the only feedback the submitter gets
          </label>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Say what needs to change…"
            className="rounded-[7px] border border-line bg-white px-3 py-2 text-[13px] text-ink-3 outline-none"
          />
          <div className="flex items-center gap-2">
            <SubmitButton
              type="button"
              onClick={submitDenial}
              pending={pending}
              destructive
            >
              Submit denial
            </SubmitButton>
            <button
              type="button"
              onClick={() => {
                setDenyOpen(false);
                setNote("");
                setError(null);
              }}
              disabled={pending}
              className="cursor-pointer rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ErrorNote error={error} />
    </div>
  );
}
