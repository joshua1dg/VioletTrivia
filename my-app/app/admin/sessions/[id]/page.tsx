import { PageHeader } from "@/components/admin/ui";
import * as batches from "@/lib/services/batches";
import * as questions from "@/lib/services/questions";
import * as sessions from "@/lib/services/sessions";
import { formatRoomNumber } from "@/lib/services/sessions";
import { registry } from "@/lib/templates/registry";

import { HostControls } from "./_ui/host-controls";

/** `params` is async in Next 16 — `node_modules/next/dist/docs/01-app`. */
export default async function SessionHostPage({
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

  const currentQuestion = session.currentQuestionId
    ? await questions.getForReviewer(session.currentQuestionId)
    : null;

  return (
    <>
      <PageHeader
        title={`Room ${formatRoomNumber(session.roomNumber)}`}
        meta={batch.name}
      />
      <HostControls
        sessionId={session.id}
        roomNumber={session.roomNumber}
        totalQuestions={questionIds.length}
        current={{
          phase: session.phase,
          currentQuestionId: session.currentQuestionId,
          currentPosition: session.currentPosition,
          responseCount: session.responseCount,
        }}
        question={
          currentQuestion
            ? {
                prompt: currentQuestion.prompt,
                templateLabel: registry[currentQuestion.template].label,
              }
            : null
        }
      />
    </>
  );
}
