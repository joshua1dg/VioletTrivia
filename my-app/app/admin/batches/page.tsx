import { PageHeader } from "@/components/admin/ui";
import { canManageBatch, requireStaff } from "@/lib/auth";
import { listBatches, listMyPodLinks } from "@/lib/services/batches";

import { BatchListRow } from "./_ui/batch-list-row";
import { NewBatchButton } from "./_ui/new-batch-button";

/**
 * Full read for every tier (PODS.md decision 4 — "the app looks the same at
 * every tier"). What differs per viewer is computed here, where the caller
 * is known, and passed down as plain booleans/strings: `canManage` per row
 * (Edit button) and `myPodLinkToken` per row (pod-link column) — the row
 * component itself stays a pure function of its props.
 */
export default async function BatchesPage() {
  const staff = await requireStaff();
  const [rows, myLinks] = await Promise.all([listBatches(), listMyPodLinks()]);
  const myLinkByBatch = new Map(myLinks.map((l) => [l.batchId, l.token]));

  // Own batches first for a pod lead — one list, not a section split
  // (PODS.md Wave 1: "not separate page sections"). Stable sort preserves
  // the underlying newest-first order within each half.
  const ordered =
    staff.role === "pod_lead"
      ? [...rows].sort(
          (a, b) =>
            Number(b.ownerId === staff.userId) - Number(a.ownerId === staff.userId),
        )
      : rows;

  const activeCount = rows.filter((b) => b.status === "active").length;

  return (
    <>
      <PageHeader
        title="Batches"
        meta={`${rows.length} total · ${activeCount} active`}
        actions={<NewBatchButton />}
      />

      <div className="flex flex-col">
        <div className="grid grid-cols-[1fr_130px_80px_90px_90px_110px_1fr_56px] gap-0 border-b border-line-2 px-6 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
          <span>NAME</span>
          <span>OWNER</span>
          <span>STATUS</span>
          <span>QUESTIONS</span>
          <span>RESPONSES</span>
          <span>ASYNC POOL</span>
          <span>LINKS</span>
          <span />
        </div>

        {ordered.map((batch) => (
          <BatchListRow
            key={batch.id}
            batch={batch}
            canManage={canManageBatch(staff, batch)}
            myPodLinkToken={myLinkByBatch.get(batch.id) ?? null}
          />
        ))}

        {rows.length === 0 && (
          <p className="px-6 py-10 text-[13.5px] text-muted-3">
            No batches yet — create one to start composing a queue.
          </p>
        )}
      </div>
    </>
  );
}
