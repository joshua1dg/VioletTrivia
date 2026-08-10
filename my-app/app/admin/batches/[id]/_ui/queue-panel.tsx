"use client";

// "use client" — the same reasoning as question-library-panel.tsx: this is
// the controlled arrow-reorder leaf, not the state owner (composer.tsx is).

import { ErrorNote, SubmitButton, type ErrorLike } from "@/components/feedback";
import type { QuestionSummary } from "@/lib/services/questions";

/**
 * The right column: the batch's ordered queue. Reorders with arrows, not
 * drag — matching T2's rank-variants template, and the design's own
 * rationale for it (README trap: "the review list is keyed by position, not
 * by id"). `dirty` only changes the button's caption; it never disables the
 * save (an unchanged save is a harmless no-op, not worth blocking).
 */
export function QueuePanel({
  queue,
  questionsById,
  dirty,
  pending,
  error,
  onMove,
  onRemove,
  onSave,
  activeWarning,
}: {
  queue: string[];
  questionsById: Map<string, QuestionSummary>;
  dirty: boolean;
  pending: boolean;
  error: ErrorLike | null;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onSave: () => void;
  activeWarning: boolean;
}) {
  return (
    <div className="flex w-96 shrink-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line-2 px-5 py-3">
        <span className="text-[11.5px] tracking-[0.04em] text-faint">
          QUEUE · {queue.length}
        </span>
        <SubmitButton type="button" onClick={onSave} pending={pending}>
          {dirty ? "Save queue" : "Saved"}
        </SubmitButton>
      </div>

      {/*
       * Persistent note, not a blocking modal — the brief is explicit that
       * editing an active batch's queue should warn visibly, not stop the
       * user. It's the README/PLAN §5.15 caveat: the async draw is a pure
       * function of the batch's CURRENT question list, so this write
       * reshuffles every participant's set the instant it saves.
       */}
      {activeWarning && (
        <p className="border-b border-warn-line bg-warn-tint px-5 py-2.5 text-[12px] leading-[1.5] text-warn-ink">
          This batch is the active async pool. Saving this queue reshuffles
          every participant&rsquo;s draw — anyone mid-way through can come
          back to a different set next time they load the link.
        </p>
      )}

      <ErrorNote error={error} />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {queue.map((id, index) => {
          const q = questionsById.get(id);
          return (
            <div
              key={id}
              className="flex items-center gap-2 border-b border-line-3 px-5 py-2.5"
            >
              <span className="w-5 shrink-0 text-[12px] tabular-nums text-muted-3">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-3">
                {q ? q.excerpt || q.prompt : "(question no longer exists)"}
              </span>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
                aria-label="Move up"
                className="cursor-pointer rounded-[5px] px-1.5 py-0.5 text-[12px] text-muted-2 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === queue.length - 1}
                onClick={() => onMove(index, 1)}
                aria-label="Move down"
                className="cursor-pointer rounded-[5px] px-1.5 py-0.5 text-[12px] text-muted-2 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onRemove(id)}
                aria-label="Remove from queue"
                className="cursor-pointer rounded-[5px] px-1.5 py-0.5 text-[12px] text-bad-ink transition-colors hover:bg-bad-tint"
              >
                ✕
              </button>
            </div>
          );
        })}

        {queue.length === 0 && (
          <p className="px-5 py-10 text-[13px] text-muted-3">
            Tick questions in the library to build the queue.
          </p>
        )}
      </div>
    </div>
  );
}
