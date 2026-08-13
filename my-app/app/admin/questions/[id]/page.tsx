import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/ui";
import { canCurateMaster, requireStaff } from "@/lib/auth";
import { asAppError, isAppError } from "@/lib/errors";
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
 *
 * Wave 2: `getForEditor` also throws `AppError("forbidden")` for a
 * non-curator opening someone else's question, or their own once it's
 * approved. Caught here rather than left to propagate — same pattern as
 * `app/admin/staff/page.tsx` — so a stale link renders a plain access note
 * (200) instead of the generic error boundary.
 *
 * `?submitError=1` (2026-08-13): the `new` page's "Save & submit for
 * review" chains a save into `submitQuestionForReview` client-side. If the
 * save succeeds but the submit fails, the row already exists — the client
 * lands here (never back on the `new` form, which would create a second
 * row on a retry) rather than losing the error on navigation.
 */
export default async function EditQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitError?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const staff = await requireStaff();

  let question;
  try {
    question = await getForEditor(id);
  } catch (error) {
    // A deleted/withdrawn question's URL (a stale proposals row, a shared
    // link) is a 404, not a crash — withdrawal makes this path routine.
    if (isAppError(error) && error.kind === "not_found") notFound();
    if (isAppError(error) && error.kind === "forbidden") {
      return (
        <>
          <PageHeader title="Edit question" />
          <p className="max-w-[60ch] p-6 text-[13.5px] leading-[1.6] text-muted-2">
            {asAppError(error).userMessage}
          </p>
        </>
      );
    }
    throw error;
  }

  const [topics, principles] = await Promise.all([
    listTopics(),
    listActivePrinciples(),
  ]);

  return (
    <QuestionEditor
      mode="edit"
      id={id}
      canCurate={canCurateMaster(staff)}
      topics={topics}
      principles={principles.map((p) => ({
        code: p.code,
        name: p.name,
        descriptor: p.shortDescriptor ?? undefined,
      }))}
      initial={question}
      initialSubmitError={sp.submitError === "1"}
    />
  );
}
