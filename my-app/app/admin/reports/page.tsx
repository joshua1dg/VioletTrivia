import Link from "next/link";

import { PageHeader } from "@/components/admin/ui";
import { EmptyState } from "@/components/feedback";
import { listBatchReportSummaries } from "@/lib/services/reports";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
};

/**
 * /admin/reports (PLAN §8). Server Component read — no loading state, it
 * suspends (PLAN §5.6). Only batches that have at least one response show
 * up; a batch with none has nothing to report on yet.
 */
export default async function ReportsPage() {
  const batches = await listBatchReportSummaries();

  return (
    <>
      <PageHeader
        title="Reports"
        meta="Where the team is miscalibrated — by rubric code and by topic"
      />

      <div className="flex flex-col gap-4 p-6">
        {batches.length === 0 ? (
          <EmptyState title="No responses yet">
            Reports need a batch with at least one answer in it. Once one
            comes in — async or live — that batch shows up here, with a link
            through to its breakdown.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-line">
            <div className="grid grid-cols-[1fr_120px_140px] items-center gap-0 border-b border-line-2 bg-surface px-4 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
              <span>BATCH</span>
              <span>STATUS</span>
              <span>RESPONSES</span>
            </div>

            {batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/admin/batches/${batch.id}/report`}
                className="grid grid-cols-[1fr_120px_140px] items-center gap-0 border-b border-line-3 px-4 py-3 text-[13.5px] text-ink-3 transition-colors last:border-b-0 hover:bg-surface"
              >
                <span className="truncate">{batch.name}</span>
                <span className="text-[12.5px] text-muted-2">
                  {STATUS_LABEL[batch.status] ?? batch.status}
                </span>
                <span className="tabular-nums text-muted-2">
                  {batch.responseCount} response
                  {batch.responseCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
