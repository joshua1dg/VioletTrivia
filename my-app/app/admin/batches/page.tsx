import { PageHeader, Placeholder } from "@/components/admin/ui";

export default function BatchesPage() {
  return (
    <>
      <PageHeader title="Batches" meta="Next pass" />
      <Placeholder title="Screen 11 — pick what runs, and where">
        Three columns: the batch list, the question library with tick-boxes,
        and the selected batch&rsquo;s ordered queue. Two things change from
        the design — async and live stop being a radio, since a batch can be
        the active async pool and have sessions running off it at the same
        time; and the queue reorders with arrows rather than drag handles, to
        match the ranking template.
      </Placeholder>
    </>
  );
}
