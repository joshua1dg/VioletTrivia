import { PageHeader, PrimaryLink } from "@/components/admin/ui";
import { questions, topics } from "@/lib/admin/fixtures";
import { QuestionLibrary } from "./library";

export default function QuestionsPage() {
  const live = questions.filter((q) => q.status === "live").length;

  return (
    <>
      <PageHeader
        title="Questions"
        meta={`${questions.length} total · ${live} live`}
        actions={<PrimaryLink href="/admin/questions/new">New question</PrimaryLink>}
      />
      <QuestionLibrary questions={questions} topics={topics} />
    </>
  );
}
