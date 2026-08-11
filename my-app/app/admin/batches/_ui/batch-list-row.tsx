import Link from "next/link";

import type { BatchListItem } from "@/lib/services/batches";

import { CopyLinkButton } from "./copy-link-button";
import { PodLinkButton } from "./pod-link-button";

// No "use client" — presentational except for two interactive leaves
// (CopyLinkButton, PodLinkButton), same reasoning as
// `app/admin/questions/library.tsx`'s row shape: only the piece that owns
// state needs the boundary.

const STATUS_TONE: Record<BatchListItem["status"], string> = {
  active: "text-violet-ink",
  draft: "text-muted-3",
  inactive: "text-faint",
};

/**
 * `canManage` and `myPodLinkToken` are computed by the page, not here — the
 * page is where the signed-in staff member is known (PODS.md Wave 1: "the
 * page knows the caller via getStaff()/requireStaff"). This row stays a
 * pure function of its props, same as before.
 */
export function BatchListRow({
  batch,
  canManage,
  myPodLinkToken,
}: {
  batch: BatchListItem;
  canManage: boolean;
  myPodLinkToken: string | null;
}) {
  const isMaster = batch.ownerLabel === null;

  return (
    <div className="grid grid-cols-[1fr_130px_80px_90px_90px_110px_1fr_56px] items-center gap-0 border-b border-line-3 px-6 py-3.5 transition-colors hover:bg-surface">
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
      <span
        className={`truncate pr-2 text-[12.5px] ${
          isMaster ? "text-violet-ink" : "text-muted-2"
        }`}
      >
        {isMaster ? "Master" : batch.ownerLabel}
      </span>
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
      <div className="flex items-center gap-2 pr-2">
        <CopyLinkButton token={batch.token} />
        {isMaster && (
          <PodLinkButton batchId={batch.id} initialToken={myPodLinkToken} />
        )}
      </div>
      {canManage ? (
        <Link
          href={`/admin/batches/${batch.id}`}
          className="justify-self-end rounded-[6px] border border-line px-2 py-1 text-[12px] text-ink-4 transition-colors hover:bg-white"
        >
          Edit
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
