import { PageHeader, Placeholder } from "@/components/admin/ui";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" meta="Deferred" />
      <Placeholder title="Not modelled yet">
        Nothing in the schema represents a report. It&rsquo;s also partly
        answered already — closing a batch leaves its link open read-only, so
        &ldquo;go look at the answers&rdquo; works without a report existing at
        all. What&rsquo;s left is the grouped view: results by topic and by
        rubric code across a whole batch.
      </Placeholder>
    </>
  );
}
