import { PageHeader, PrimaryLink } from "@/components/admin/ui";
import { EmptyState, SkippedRowsBanner } from "@/components/feedback";
import { listQuestionSummaries } from "@/lib/services/questions";
import { listTopics } from "@/lib/services/topics";
import { QuestionLibrary } from "./library";

export default async function QuestionsPage() {
  const [{ rows: questions, skipped }, topics] = await Promise.all([
    listQuestionSummaries(),
    listTopics(),
  ]);

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
        <QuestionLibrary questions={questions} topics={topics} />
      )}
    </>
  );
}
