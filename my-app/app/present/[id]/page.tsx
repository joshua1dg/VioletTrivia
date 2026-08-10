import * as batches from "@/lib/services/batches";
import * as questions from "@/lib/services/questions";
import * as sessions from "@/lib/services/sessions";

import { PresenterShell } from "./presenter-shell";

/**
 * Server Component: current question (keyless, `getForReviewer`) plus, only
 * on `revealed`, the tally (`sessions.getTally` — staff-gated, loads the key
 * once, server-side). `params` is async in Next 16.
 */
export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await sessions.getById(id);
  const [batch, questionIds] = await Promise.all([
    batches.getById(session.batchId),
    batches.getQuestionIds(session.batchId),
  ]);

  const question = session.currentQuestionId
    ? await questions.getForReviewer(session.currentQuestionId)
    : null;

  const tally =
    session.phase === "revealed" && session.currentQuestionId
      ? await sessions.getTally(session.id, session.currentQuestionId)
      : null;

  return (
    <PresenterShell
      sessionId={session.id}
      roomNumber={session.roomNumber}
      batchName={batch.name}
      totalQuestions={questionIds.length}
      initial={{
        phase: session.phase,
        currentQuestionId: session.currentQuestionId,
        currentPosition: session.currentPosition,
        responseCount: session.responseCount,
      }}
      question={question}
      tally={tally}
    />
  );
}
