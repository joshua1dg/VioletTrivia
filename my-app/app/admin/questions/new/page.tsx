import { canCurateMaster, requireStaff } from "@/lib/auth";
import { listActivePrinciples } from "@/lib/services/principles";
import { listTopics } from "@/lib/services/topics";
import { QuestionEditor } from "./editor";

/**
 * Open to any staff (Wave 2) — the layout already gates on `requireStaff()`.
 * `requireStaff()` here is a second call to the same cache()-memoized
 * resolver the layout used, so it costs nothing extra; only the boolean
 * `canCurate` crosses into the client editor, never the `Staff` object.
 */
export default async function NewQuestionPage() {
  const [staff, topics, principles] = await Promise.all([
    requireStaff(),
    listTopics(),
    listActivePrinciples(),
  ]);

  return (
    <QuestionEditor
      mode="new"
      canCurate={canCurateMaster(staff)}
      topics={topics}
      principles={principles.map((p) => ({
        code: p.code,
        name: p.name,
        descriptor: p.shortDescriptor ?? undefined,
      }))}
    />
  );
}
