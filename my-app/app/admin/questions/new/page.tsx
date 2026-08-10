import { listActivePrinciples } from "@/lib/services/principles";
import { listTopics } from "@/lib/services/topics";
import { QuestionEditor } from "./editor";

export default async function NewQuestionPage() {
  const [topics, principles] = await Promise.all([
    listTopics(),
    listActivePrinciples(),
  ]);

  return (
    <QuestionEditor
      mode="new"
      topics={topics}
      principles={principles.map((p) => ({
        code: p.code,
        name: p.name,
        descriptor: p.shortDescriptor ?? undefined,
      }))}
    />
  );
}
