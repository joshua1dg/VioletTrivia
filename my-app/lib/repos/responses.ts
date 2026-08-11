import "server-only";

import { serviceClient } from "@/lib/db/server";
import { answer as answerSchema } from "@/lib/templates/common";
import type { Answer } from "@/lib/templates/types";

import {
  collect,
  mapPostgrestError,
  parseJsonb,
  unwrap,
  type ListResult,
} from "./_shared";

/**
 * `responses.answer` is untyped jsonb, so it is ALWAYS parsed on the way out
 * (PLAN §5.7) — with the shared `answer` schema from lib/templates/common,
 * the same module both entrances validate against.
 */

export type ResponseRow = {
  id: string;
  questionId: string;
  participantId: string;
  batchId: string | null;
  liveSessionId: string | null;
  /** The pod link the answer came through, if any (PODS.md Wave 1). */
  batchLinkId: string | null;
  answer: Answer;
  rationale: string | null;
  createdAt: string;
};

const COLUMNS =
  "id, question_id, participant_id, batch_id, live_session_id, batch_link_id, answer, rationale, created_at";

export type ResponseInsert = {
  questionId: string;
  participantId: string;
  batchId?: string | null;
  liveSessionId?: string | null;
  batchLinkId?: string | null;
  answer: Answer;
  rationale?: string | null;
};

/**
 * The one write. `responses_dedupe` (question + participant + context,
 * where a context is one async batch or one live session) is what actually
 * wins the double-tap race — app code cannot, and the migration says so.
 * 23505 therefore is not a failure: it is the expected outcome of a
 * refresh, and both submit paths translate it into "already answered"
 * rather than a red box (PLAN §5.8).
 *
 * `live_sessions.response_count` is bumped by the `responses_bump_live_count`
 * trigger, not from here — PostgREST cannot express `count = count + 1`.
 */
export async function insert(input: ResponseInsert): Promise<ResponseRow> {
  const result = await serviceClient()
    .from("responses")
    .insert({
      question_id: input.questionId,
      participant_id: input.participantId,
      batch_id: input.batchId ?? null,
      live_session_id: input.liveSessionId ?? null,
      batch_link_id: input.batchLinkId ?? null,
      answer: input.answer,
      rationale: input.rationale ?? null,
    })
    .select(COLUMNS)
    .single();

  if (result.error) {
    throw mapPostgrestError(result.error, {
      conflict: "You've already answered this one.",
      validation: "That answer isn't shaped like an answer.",
    });
  }

  return mapResponse(unwrap(result));
}

/**
 * The async resume path: which of these questions has this participant
 * already answered IN THIS BATCH?
 *
 * Scoped by batch, matching `responses_dedupe` (re-scoped 2026-08-10): the
 * same question in another batch is asked afresh there — repetition is
 * reinforcement, not noise — so an answer given elsewhere neither shows
 * here nor blocks the insert.
 */
export async function listAsyncForParticipant(
  participantId: string,
  batchId: string,
  questionIds: string[],
): Promise<ListResult<ResponseRow>> {
  if (questionIds.length === 0) return { rows: [], skipped: [] };

  const rows = unwrap(
    await serviceClient()
      .from("responses")
      .select(COLUMNS)
      .eq("participant_id", participantId)
      .eq("batch_id", batchId)
      .in("question_id", questionIds)
      .is("live_session_id", null),
  );

  return collect(rows, (r) => r.id, mapResponse);
}

/** Everything answered for a set of questions — tallies and reports. */
export async function listForQuestions(
  questionIds: string[],
  context: { batchId?: string; liveSessionId?: string } = {},
): Promise<ListResult<ResponseRow>> {
  if (questionIds.length === 0) return { rows: [], skipped: [] };

  let query = serviceClient()
    .from("responses")
    .select(COLUMNS)
    .in("question_id", questionIds);

  if (context.batchId) query = query.eq("batch_id", context.batchId);
  if (context.liveSessionId)
    query = query.eq("live_session_id", context.liveSessionId);

  const rows = unwrap(await query);
  return collect(rows, (r) => r.id, mapResponse);
}

type RawResponse = {
  id: string;
  question_id: string;
  participant_id: string;
  batch_id: string | null;
  live_session_id: string | null;
  batch_link_id: string | null;
  answer: unknown;
  rationale: string | null;
  created_at: string;
};

function mapResponse(row: RawResponse): ResponseRow {
  return {
    id: row.id,
    questionId: row.question_id,
    participantId: row.participant_id,
    batchId: row.batch_id,
    liveSessionId: row.live_session_id,
    batchLinkId: row.batch_link_id,
    answer: parseJsonb(answerSchema, row.answer, {
      id: row.id,
      column: "answer",
    }),
    rationale: row.rationale,
    createdAt: row.created_at,
  };
}
