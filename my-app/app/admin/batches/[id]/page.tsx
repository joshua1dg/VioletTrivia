import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { canManageBatch, requireStaff } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import {
  getByIdWithCounts,
  getQuestionIds,
  listMyPodLinks,
} from "@/lib/services/batches";
import { listQuestionSummaries } from "@/lib/services/questions";
import { listTopics } from "@/lib/services/topics";

import { Composer } from "./_ui/composer";
import { ReadOnlyBatchView } from "./_ui/read-only-batch-view";

/**
 * The composer (PLAN §9 F3 / Screen 11): three columns — batch settings,
 * the question library with tick-boxes, and the ordered queue with arrow
 * reorder. `params` is a Promise in this Next version (checked against
 * `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`).
 *
 * Everyone may view this page (PODS.md decision 4); only `canManageBatch`
 * gets the composer. The UI branch below is a courtesy — `requireManage`
 * inside every mutation in `batches.service.ts` is the real boundary, so a
 * non-manager who somehow fired a Server Action would be rejected there
 * regardless of what this page renders.
 */
export default async function BatchComposerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await requireStaff();

  let batch;
  try {
    batch = await getByIdWithCounts(id);
  } catch (error) {
    if (isAppError(error) && error.kind === "not_found") notFound();
    throw error;
  }

  const canManage = canManageBatch(staff, batch);

  if (!canManage) {
    const [queue, library, myLinks] = await Promise.all([
      getQuestionIds(id),
      listQuestionSummaries(),
      staff.role === "pod_lead" ? listMyPodLinks() : Promise.resolve([]),
    ]);
    const questionsById = new Map(library.rows.map((q) => [q.id, q]));
    const myLink = myLinks.find((l) => l.batchId === id) ?? null;

    return (
      <>
        <PageHeader title={batch.name} meta={`Batch · /b/${batch.token}`} />
        <ReadOnlyBatchView
          batch={batch}
          queue={queue}
          questionsById={questionsById}
          isPodLead={staff.role === "pod_lead"}
          initialPodLinkToken={myLink?.token ?? null}
        />
      </>
    );
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
