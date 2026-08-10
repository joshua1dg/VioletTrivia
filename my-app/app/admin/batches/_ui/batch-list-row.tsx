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
    <div className="grid grid-cols-[1fr_90px_100px_100px_140px_1fr] items-center gap-0 border-b border-line-3 px-6 py-3.5 transition-colors hover:bg-surface">
      <Link
        href={`/admin/batches/${batch.id}`}
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
    </div>
  );
}
