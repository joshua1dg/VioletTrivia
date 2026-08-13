// No "use client" — presentational except for the two interactive leaves
// (CopyLinkButton, PodLinkButton), same reasoning as the list row.

import type { BatchWithCounts } from "@/lib/services/batches";
import type { QuestionSummary } from "@/lib/services/questions";

import { CopyLinkButton } from "../../_ui/copy-link-button";
import { PodLinkButton } from "../../_ui/pod-link-button";

const STATUS_TONE: Record<BatchWithCounts["status"], string> = {
  active: "text-violet-ink",
  draft: "text-muted-3",
  inactive: "text-faint",
};

/**
 * What a non-manager sees instead of the composer (PODS.md Wave 1): the
 * batch is real and worth looking at — read access is full at every tier —
 * but nothing here writes anything. The Server Actions are the actual
 * boundary (`batches.service.ts`'s `requireManage`); this screen is a
 * courtesy so the missing edit controls don't read as a bug.
 */
export function ReadOnlyBatchView({
  batch,
  queue,
  questionsById,
  isPodLead,
  initialPodLinkToken,
}: {
  batch: BatchWithCounts;
  queue: string[];
  questionsById: Map<string, QuestionSummary>;
  isPodLead: boolean;
  initialPodLinkToken: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div className="rounded-[10px] border border-line-2 bg-surface p-4">
        <p className="text-[13px] leading-[1.6] text-muted-2">
          Master batch — curated by DOLs. You can see everything
          here, but only a DOL or admin can change it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <span className={`text-[13px] capitalize ${STATUS_TONE[batch.status]}`}>
          {batch.status}
        </span>
        <span className="text-[12.5px] text-muted-3">
          {batch.questionCount} question{batch.questionCount === 1 ? "" : "s"} ·{" "}
          {batch.responseCount} response{batch.responseCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CopyLinkButton token={batch.token} />
        {isPodLead && (
          <PodLinkButton batchId={batch.id} initialToken={initialPodLinkToken} />
        )}
      </div>

      <div className="flex flex-col">
        <div className="border-b border-line-2 pb-2 text-[11.5px] tracking-[0.04em] text-faint">
          QUEUE · {queue.length}
        </div>
        <ol className="flex flex-col">
          {queue.map((id, index) => {
            const q = questionsById.get(id);
            return (
              <li
                key={id}
                className="flex items-center gap-3 border-b border-line-3 py-2.5"
              >
                <span className="w-5 shrink-0 text-[12px] tabular-nums text-muted-3">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-3">
                  {q ? q.excerpt || q.prompt : "(question no longer exists)"}
                </span>
              </li>
            );
          })}

          {queue.length === 0 && (
            <li className="py-10 text-[13px] text-muted-3">
              This batch has no questions queued yet.
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
