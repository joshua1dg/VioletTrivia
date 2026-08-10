import { PageHeader } from "@/components/admin/ui";
import { listTopicsWithUsage } from "@/lib/services/topics";

import { TopicsTable } from "./_ui/topics-table";

/**
 * Server Component read (PLAN §5.6 — reads have no loading state; the UI
 * service below exists only for the mutations). Full CRUD (D14): create,
 * rename, arrow-reorder and delete all live in <TopicsTable>, the one
 * client boundary on this screen.
 */
export default async function TopicsPage() {
  const rows = await listTopicsWithUsage();

  return (
    <>
      <PageHeader
        title="Topics"
        meta={`${rows.length} buckets · the shape of the situation, not the failure mode`}
      />
      <TopicsTable topics={rows} />
    </>
  );
}
