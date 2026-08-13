"use client";

// Real "use client" — not just for ConfirmDelete's own hooks (it owns those
// regardless), but because this component closes over `question.id` in the
// `onConfirm` callback it hands to ConfirmDelete. That closure is a plain
// function, and React can only serialize a Server Action reference across
// the server→client boundary — a Server Component passing an inline
// closure into a Client Component prop throws at render ("Event handlers
// cannot be passed to Client Component props"). Every other screen that
// wires ConfirmDelete this way (app/admin/questions/new/editor.tsx,
// app/admin/topics/_ui/topics-table.tsx) does it from inside a "use client"
// component for the same reason — `question` crosses the boundary as a
// plain serializable prop instead, which is fine.

import Link from "next/link";

import { ConfirmDelete } from "@/components/feedback";
import type { QuestionSummary } from "@/lib/services/questions";

import { withdrawQuestion } from "../actions";
import { ReviewStatusChip } from "./review-status-chip";

/**
 * One row of the viewer's own submissions: proposed and denied always,
 * approved too for anyone who isn't a curator (getProposalsView already
 * filtered a curator's own direct-to-library work out — see its comment).
 * Denied rows surface the reviewer's note prominently since there are no
 * notifications; this row IS where the submitter finds out why.
 */
export function MineRow({ question }: { question: QuestionSummary }) {
  const canWithdraw = question.reviewStatus !== "approved";

  return (
    <div className="flex flex-col gap-2.5 border-b border-line-3 px-4 py-3.5 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-[13.5px] text-ink-3">
            {question.prompt}
          </span>
          <p className="truncate text-[12.5px] text-muted-3">
            {question.excerpt}
          </p>
          <ReviewStatusChip status={question.reviewStatus} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {question.reviewStatus === "approved" ? (
            <Link
              href={`/admin/questions/${question.id}/report`}
              className="rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface"
            >
              View report
            </Link>
          ) : (
            <Link
              href={`/admin/questions/${question.id}`}
              className="rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface"
            >
              Edit &amp; resubmit
            </Link>
          )}
          {canWithdraw && (
            <ConfirmDelete
              triggerLabel="Withdraw"
              title="Withdraw this proposal?"
              description="It's removed for good — resubmit from scratch if you change your mind."
              confirmLabel="Withdraw"
              onConfirm={() => withdrawQuestion(question.id)}
            />
          )}
        </div>
      </div>

      {question.reviewStatus === "denied" && question.reviewNote && (
        <div className="rounded-[8px] border border-bad-line bg-bad-tint px-3 py-2">
          <p className="text-[11px] tracking-[0.04em] text-bad-ink">
            WHY IT WAS DENIED
          </p>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-3">
            {question.reviewNote}
          </p>
        </div>
      )}
    </div>
  );
}
