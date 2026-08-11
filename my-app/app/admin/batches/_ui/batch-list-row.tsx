import Link from "next/link";

import type { BatchWithCounts } from "@/lib/services/batches";

import { CopyLinkButton } from "./copy-link-button";

// No "use client" — presentational except for the one interactive leaf
// (CopyLinkButton), same reasoning as `app/admin/questions/library.tsx`'s
// row shape: only the piece that owns state needs the boundary.

const STATUS_TONE: Record<BatchWithCounts["status"], string> = {
  active: "text-violet-ink",
  draft: "text-muted-3",
  inactive: "text-faint",
};

export function BatchListRow({ batch }: { batch: BatchWithCounts }) {
  return (
    <div className="grid grid-cols-[1fr_90px_100px_100px_140px_1fr_56px] items-center gap-0 border-b border-line-3 px-6 py-3.5 transition-colors hover:bg-surface">
      {/* The name goes to the batch's REPORT — inside the batches section,
          same shape as every other entity; the composer is behind the
          explicit Edit button (2026-08-11: "clicking into it is looking at
          the statistics"). */}
      <Link
        href={`/admin/batches/${batch.id}/report`}
        className="truncate pr-4 text-[13.5px] text-ink-3 hover:underline"
      >
        {batch.name}
      </Link>
      <span className={`text-[12.5px] capitalize ${STATUS_TONE[batch.status]}`}>
        {batch.status}
      </span>
      <span className="text-[12.5px] text-muted-2 tabular-nums">
        {batch.questionCount}
      </span>
      <span className="text-[12.5px] text-muted-2 tabular-nums">
        {batch.responseCount}
      </span>
      <span className="text-[12.5px]">
        {batch.isActiveAsync ? (
          <span className="text-violet-ink">● active pool</span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </span>
      <CopyLinkButton token={batch.token} />
      <Link
        href={`/admin/batches/${batch.id}`}
        className="justify-self-end rounded-[6px] border border-line px-2 py-1 text-[12px] text-ink-4 transition-colors hover:bg-white"
      >
        Edit
      </Link>
    </div>
  );
}
