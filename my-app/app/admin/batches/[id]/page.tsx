import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { isAppError } from "@/lib/errors";
import { getByIdWithCounts, getQuestionIds } from "@/lib/services/batches";
import { listQuestionSummaries } from "@/lib/services/questions";
import { listTopics } from "@/lib/services/topics";

import { Composer } from "./_ui/composer";

/**
 * The composer (PLAN §9 F3 / Screen 11): three columns — batch settings,
 * the question library with tick-boxes, and the ordered queue with arrow
 * reorder. `params` is a Promise in this Next version (checked against
 * `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`).
 */
export default async function BatchComposerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let batch;
  try {
    batch = await getByIdWithCounts(id);
  } catch (error) {
    if (isAppError(error) && error.kind === "not_found") notFound();
    throw error;
  }

  const [queue, library, topics] = await Promise.all([
    getQuestionIds(id),
    listQuestionSummaries(),
    listTopics(),
  ]);

  return (
    <>
      <PageHeader
        title={batch.name}
        meta={`Batch composer · /b/${batch.token}`}
      />

      {library.skipped.length > 0 && (
        <div className="px-6 pt-4">
          <SkippedRowsBanner skipped={library.skipped} />
        </div>
      )}

      <Composer
        batch={batch}
        initialQueue={queue}
        library={library.rows}
        topics={topics}
      />
    </>
  );
}
