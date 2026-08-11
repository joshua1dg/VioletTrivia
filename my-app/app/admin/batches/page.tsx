import { PageHeader } from "@/components/admin/ui";
import { listBatches } from "@/lib/services/batches";

import { BatchListRow } from "./_ui/batch-list-row";
import { NewBatchButton } from "./_ui/new-batch-button";

export default async function BatchesPage() {
  const rows = await listBatches();
  const activeCount = rows.filter((b) => b.status === "active").length;

  return (
    <>
      <PageHeader
        title="Batches"
        meta={`${rows.length} total · ${activeCount} active`}
        actions={<NewBatchButton />}
      />

      <div className="flex flex-col">
        <div className="grid grid-cols-[1fr_90px_100px_100px_140px_1fr_56px] gap-0 border-b border-line-2 px-6 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
          <span>NAME</span>
          <span>STATUS</span>
          <span>QUESTIONS</span>
          <span>RESPONSES</span>
          <span>ASYNC POOL</span>
          <span>LINK</span>
          <span />
        </div>

        {rows.map((batch) => (
          <BatchListRow key={batch.id} batch={batch} />
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
