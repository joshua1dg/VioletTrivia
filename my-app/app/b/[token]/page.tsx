import { notFound } from "next/navigation";

import { SkippedRowsBanner } from "@/components/feedback";
import { readParticipantId } from "@/lib/participant/server";
import { drawQuestions, getAccessByToken } from "@/lib/services/batches";
import { listForReviewer } from "@/lib/services/questions";
import { listAnsweredReveals } from "@/lib/services/responses";

import { Bootstrap } from "./bootstrap";
import { Flow } from "./flow";
import type { FlowStep } from "./_ui/use-async-flow";

/**
 * `/b/[token]` — the async reviewer entry point (PLAN §7, §9 F4).
 *
 * `params` is async in Next 16 (README/PLAN §1) — `const { token } = await
 * params`. Route:
 *
 *   no batch, or `draft`         → notFound() — a draft link resolves to
 *                                   nothing at all, same as `submitAsync`
 *                                   treats it (responses.service.ts).
 *   no `violet_pid` cookie       → the tiny client bootstrap, which
 *                                   establishes identity and calls
 *                                   router.refresh() (PLAN §5.14).
 *   cookie present               → compute the deterministic draw, load the
 *                                   drawn questions KEYLESS (`listForReviewer`
 *                                   — rule 8, never `listWithKey` here) plus
 *                                   any reveals already on record, and hand
 *                                   the ordered steps to the client flow.
 */
export default async function AsyncBatchPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const access = await getAccessByToken(token);
  // 'draft' (visible: false) resolves to nothing at all — same treatment
  // `submitAsync` gives an unknown token (PLAN §5.10/§7, batches.service.ts).
  if (!access || !access.visible) notFound();

  const participantId = await readParticipantId();
  if (!participantId) return <Bootstrap batchToken={token} />;

  const draw = drawQuestions(
    participantId,
    access.id,
    access.questionIds,
    access.asyncSampleSize,
  );

  // "Already answered" comes back as REVEALS on the async surface — an
  // answered question means "you may read the key for it", including once
  // the batch has gone inactive (responses.service.ts). Everything else is
  // read via `listForReviewer`, which never selects `answer_key` (rule 8).
  const [answered, unanswered] = await Promise.all([
    listAnsweredReveals(participantId, draw),
    listForReviewer(draw),
  ]);

  const revealsById = new Map(
    answered.reveals.map((r) => [r.questionId, r] as const),
  );
  const questionsById = new Map(
    unanswered.rows
      .filter((q) => !revealsById.has(q.id))
      .map((q) => [q.id, q] as const),
  );

  const steps: FlowStep[] = draw.flatMap((id): FlowStep[] => {
    const reveal = revealsById.get(id);
    if (reveal) return [{ kind: "reveal", reveal }];
    const question = questionsById.get(id);
    if (question) return [{ kind: "question", question }];
    // Dropped by a soft-fail elsewhere (bad jsonb row, §5.7) — skip rather
    // than crash the whole set over one bad question.
    return [];
  });

  const skipped = [...answered.skipped, ...unanswered.skipped];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-3 px-4 py-5 @3xl:py-10">
      {skipped.length > 0 && <SkippedRowsBanner skipped={skipped} />}
      <div className="min-h-0 flex-1">
        <Flow
          participantId={participantId}
          batchToken={token}
          batchName={access.name}
          canSubmit={access.canSubmit}
          steps={steps}
        />
      </div>
    </main>
  );
}
