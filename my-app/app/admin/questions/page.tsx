import { PageHeader, PrimaryLink } from "@/components/admin/ui";
import { EmptyState, SkippedRowsBanner } from "@/components/feedback";
import { listQuestionSummaries } from "@/lib/services/questions";
import { listTopics } from "@/lib/services/topics";
import { QuestionLibrary } from "./library";

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const [{ rows: questions, skipped }, topics, params] = await Promise.all([
    listQuestionSummaries(),
    listTopics(),
    searchParams,
  ]);

  // `?topic=<slug>` — the topics screen links here per topic. Resolved to an
  // id server-side; an unknown slug just means no preselected filter.
  const initialTopicId =
    topics.find((t) => t.slug === params.topic)?.id ?? null;

  const live = questions.filter((q) => q.status === "live").length;

  return (
    <>
      <PageHeader
        title="Questions"
        meta={`${questions.length} total · ${live} live`}
        actions={<PrimaryLink href="/admin/questions/new">New question</PrimaryLink>}
      />

      {skipped.length > 0 && (
        <div className="px-6 pt-3.5">
          <SkippedRowsBanner skipped={skipped} />
        </div>
      )}

      {questions.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No questions yet"
            action={<PrimaryLink href="/admin/questions/new">New question</PrimaryLink>}
          >
            Author one to seed the library — every downstream screen (batches,
            reports) reads from here.
          </EmptyState>
        </div>
      ) : (
        /* Keyed by the preselected topic so a navigation that changes the
           param remounts the (client-state) filter rather than being
           ignored by an already-mounted library. */
        <QuestionLibrary
          key={initialTopicId ?? "all"}
          questions={questions}
          topics={topics}
          initialTopicId={initialTopicId}
        />
      )}
    </>
  );
}
