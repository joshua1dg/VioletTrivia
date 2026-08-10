import "server-only";

import { AppError, isAppError } from "@/lib/errors";
import * as repo from "@/lib/repos/responses";
import type { SkippedRow } from "@/lib/repos/_shared";
import type { SubmitAnswerInput } from "@/lib/schemas/responses";
import * as batches from "@/lib/services/batches";
import * as participants from "@/lib/services/participants";
import * as questions from "@/lib/services/questions";
import { answerSchema } from "@/lib/templates/answers";

import { buildReveal, type Reveal } from "./reveal.util";

/**
 * THE ASYNC WRITE PATH — the vertical slice of PLAN §6.
 *
 * This file loads answer keys, because an async participant may read the key
 * for a question they have already answered. Its live counterpart lives in
 * `live-submit.service.ts` and imports nothing that could produce one. Two
 * functions in two files, rather than one function with an `if`: safe
 * because the capability is absent, not because we remembered to check
 * (§5.5).
 */

export type AsyncSubmitResult = {
  /** True on a duplicate. Expected — a refresh, a double-tap, a back button. */
  alreadyAnswered: boolean;
  reveal: Reveal;
};

export async function submitAsync(
  input: SubmitAnswerInput,
): Promise<AsyncSubmitResult> {
  const batch = await batches.getAccessByToken(input.batchToken);

  // A draft batch's link resolves to nothing at all, same as a bad token.
  if (!batch || !batch.visible) {
    throw new AppError("not_found", "That link doesn't lead anywhere.");
  }

  // 'inactive' and expired are READ-ONLY, not off: the answers stay
  // readable, only new submissions stop (README).
  if (!batch.canSubmit) {
    throw new AppError(
      "forbidden",
      "This set is closed. You can still read the answers you already gave.",
    );
  }

  // The draw is the async surface's authorization: no auth, a token for the
  // batch, and this for the question (§7.2).
  const draw = batches.drawQuestions(
    input.participantId,
    batch.id,
    batch.questionIds,
    batch.asyncSampleSize,
  );
  if (!draw.includes(input.questionId)) {
    throw new AppError("forbidden", "That question isn't part of your set.");
  }

  // Loaded BEFORE the insert, because validating the answer needs the
  // template. Harmless ordering on this path: the caller is about to be
  // handed the key in the reveal anyway — async participants read keys by
  // design. (The live path must never do this; its keyless equivalent is in
  // `live-submit.service.ts`.)
  const question = await questions.getWithKey(input.questionId);

  // Per-template completeness, the same schema the submit button gates on
  // (`lib/templates/answers`). The action-boundary schema only knows
  // `answer` is an object; without this an empty `{}` records fine, grades
  // 0, and tallies as nothing.
  if (!answerSchema[question.template].safeParse(input.answer).success) {
    throw new AppError(
      "validation",
      "That answer looks incomplete — nothing was recorded.",
    );
  }

  // Idempotent, and cheap insurance: a participant whose registration was
  // lost would otherwise hit a foreign-key error they can do nothing about.
  await participants.ensureParticipant(input.participantId, batch.id);

  let response;
  let alreadyAnswered = false;

  try {
    response = await repo.insert({
      questionId: input.questionId,
      participantId: input.participantId,
      batchId: batch.id,
      answer: input.answer,
      rationale: input.rationale ?? null,
    });
  } catch (error) {
    // `responses_dedupe` in Postgres is what actually wins the double-tap
    // race — app code cannot. The index is scoped per batch (2026-08-10),
    // so a conflict here can only mean THIS batch already has this answer:
    // the EXPECTED outcome of a refresh, resolved to the existing answer
    // and its reveal, not to a red error box (PLAN §5.8).
    if (!isAppError(error) || error.kind !== "conflict") throw error;

    alreadyAnswered = true;
    response = await findExisting(input.participantId, batch.id, input.questionId);
  }

  return {
    alreadyAnswered,
    reveal: buildReveal(question, response),
  };
}

/**
 * The async flow resumes on refresh: which of these questions has this
 * participant already answered, and what should they see for each?
 *
 * Returns reveals, because "already answered" on the async surface means
 * "you may read the key for it" — including once the batch is inactive.
 */
export async function listAnsweredReveals(
  participantId: string,
  questionIds: string[],
  /** Scopes the lookup: only answers given in THIS batch count. The same
   * question answered under another batch is asked afresh here —
   * `responses_dedupe` is per-batch (2026-08-10). */
  batchId: string,
): Promise<{ reveals: Reveal[]; skipped: SkippedRow[] }> {
  const answered = await repo.listAsyncForParticipant(
    participantId,
    batchId,
    questionIds,
  );
  if (answered.rows.length === 0) {
    return { reveals: [], skipped: answered.skipped };
  }

  const withKeys = await questions.listWithKey(
    answered.rows.map((row) => row.questionId),
  );
  const byId = new Map(withKeys.rows.map((q) => [q.id, q]));

  const reveals = answered.rows.flatMap((row) => {
    const question = byId.get(row.questionId);
    return question ? [buildReveal(question, row)] : [];
  });

  return {
    reveals,
    skipped: [...answered.skipped, ...withKeys.skipped],
  };
}

/** Which of these has been answered in this batch — no keys, for a progress
 * indicator. */
export async function listAnsweredQuestionIds(
  participantId: string,
  batchId: string,
  questionIds: string[],
): Promise<string[]> {
  const answered = await repo.listAsyncForParticipant(
    participantId,
    batchId,
    questionIds,
  );
  return answered.rows.map((row) => row.questionId);
}

async function findExisting(
  participantId: string,
  batchId: string,
  questionId: string,
) {
  const existing = await repo.listAsyncForParticipant(participantId, batchId, [
    questionId,
  ]);
  const row = existing.rows[0];
  if (!row) {
    // The unique index fired but the row is not readable — nothing sane is
    // left to render, and it is not the participant's problem to solve.
    throw new AppError(
      "unavailable",
      "You've already answered this one, but it couldn't be loaded. Refresh to try again.",
      { message: `dedupe conflict with no readable row for ${questionId}` },
    );
  }
  return row;
}
