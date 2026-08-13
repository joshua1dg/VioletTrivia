import type { ReviewStatus } from "@/lib/services/questions";

// No "use client" — presentational, no hooks, same reasoning as
// components/admin/ui.tsx's StatusPill (which carries the LIFECYCLE status;
// this is the separate review-verdict dimension the Proposals tab owns).

const TONE: Record<ReviewStatus, string> = {
  // Private work-in-progress (2026-08-13) — neutral/grey, deliberately NOT
  // violet: violet means "in the queue, waiting on a reviewer," which a
  // draft explicitly isn't yet. Same neutral pairing ErrorNote's "neutral"
  // tone uses (components/feedback/error-note.tsx).
  draft: "border-line bg-surface text-muted-2",
  proposed: "border-violet-line bg-violet-tint-2 text-violet-ink",
  approved: "border-ok-line bg-ok-tint text-ok-ink",
  denied: "border-bad-line bg-bad-tint text-bad-ink",
};

const LABEL: Record<ReviewStatus, string> = {
  draft: "Draft",
  proposed: "Pending review",
  approved: "Approved",
  denied: "Denied",
};

export function ReviewStatusChip({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-[6px] border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${TONE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
