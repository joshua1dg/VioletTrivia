import { getForEditor } from "@/lib/services/questions";
import { listActivePrinciples } from "@/lib/services/principles";
import { listTopics } from "@/lib/services/topics";
import { QuestionEditor } from "../new/editor";

/**
 * Edit route, reusing the `new` editor (PLAN §9 F1 task 4). `params` is a
 * Promise in this Next version (`node_modules/next/dist/docs/01-app` — every
 * dynamic-segment page example awaits it).
 *
 * `getForEditor` is a single-item read: a row saved under an older content
 * shape throws rather than soft-failing, and that throw is left to propagate
 * to `app/error.tsx` on purpose (PLAN §5.7 — "silently rendering half a
 * question is worse than an error").
 */
export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [question, topics, principles] = await Promise.all([
    getForEditor(id),
    listTopics(),
    listActivePrinciples(),
  ]);

  return (
    <QuestionEditor
      mode="edit"
      id={id}
      topics={topics}
      principles={principles.map((p) => ({
        code: p.code,
        name: p.name,
        descriptor: p.shortDescriptor ?? undefined,
      }))}
      initial={question}
    />
  );
}
