import { PageHeader, PrimaryButton } from "@/components/admin/ui";
import { questions, topics } from "@/lib/admin/fixtures";
import { QuestionLibrary } from "./library";

export default function QuestionsPage() {
  const live = questions.filter((q) => q.status === "live").length;

  return (
    <>
      <PageHeader
        title="Questions"
        meta={`${questions.length} total · ${live} live`}
        actions={<PrimaryButton>New question</PrimaryButton>}
      />
      <QuestionLibrary questions={questions} topics={topics} />
    </>
  );
}
