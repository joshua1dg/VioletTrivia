import "server-only";

import { serviceClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/database.types";
import { answer as answerSchema } from "@/lib/templates/common";
import type { Answer } from "@/lib/templates/types";

import { collect, parseJsonb, unwrap, type ListResult } from "./_shared";

/**
 * Aggregate reads for /admin/reports (PLAN §8, Wave 3/F6).
 *
 * The orchestrator carved this out as its own repo file specifically so this
 * agent's reads don't need to reopen `lib/repos/responses.ts` (Wave 2/B1,
 * read-only here) or `lib/repos/batches.ts` (Wave 3/F3, read-only here) —
 * `getById`/`listQuestionIds` from `lib/services/batches` cover what this
 * folder needs from those tables. Everything below is a batch-level
 * aggregate, a response pull scoped to a batch, or a junction read.
 *
 * NO business logic, NO grading here — that's what
 * `lib/services/reports/*.util.ts` does, as pure functions over the rows
 * this file returns (PLAN §8: "the repo fetches; the utils group and
 * count").
 */

export type BatchStatus = Database["public"]["Enums"]["batch_status"];

export type BatchWithResponseCountRow = {
  id: string;
  name: string;
  status: BatchStatus;
  responseCount: number;
};

const BATCH_COLUMNS = "id, name, status";

/**
 * Every batch's response count, spanning BOTH channels (orchestrator
 * resolution to this agent's rule-11 flag: the §8 sketch's "17 participants"
 * is a live-room headcount elsewhere in the plan, so live responses are in
 * scope for a batch report too).
 *
 * A response is either async (`batch_id` set directly) or live
 * (`live_session_id` set, `batch_id` null — `submitLive` never sets
 * `batchId`, per `live-submit.service.ts`). There is no single-query
 * PostgREST embed that follows `batches -> live_sessions -> responses` for
 * an aggregate count, so this fetches the three tables' relevant columns in
 * bulk and merges in JS — three queries total for the whole list, not one
 * per batch.
 */
export async function listBatchesWithResponseCounts(): Promise<
  BatchWithResponseCountRow[]
> {
  const [batchRows, sessionRows, responseRows] = await Promise.all([
    unwrap(
      await serviceClient()
        .from("batches")
        .select(BATCH_COLUMNS)
        .order("created_at", { ascending: false }),
    ),
    unwrap(await serviceClient().from("live_sessions").select("id, batch_id")),
    unwrap(
      await serviceClient()
        .from("responses")
        .select("id, batch_id, live_session_id, participant_id, question_id"),
    ),
  ]);

  const batchIdBySession = new Map(
    sessionRows.map((session) => [session.id, session.batch_id]),
  );

  // batchId -> distinct (participant, question) pairs. Counting PAIRS, not
  // response rows, keeps this screen's number consistent with the detail
  // report, which dedupes one person's repeat answers to the same question
  // (async + several live sessions are all legitimate separate rows) down
  // to their first.
  const answerPairsByBatch = new Map<string, Set<string>>();

  const credit = (batchId: string | null, pair: string) => {
    if (!batchId) return;
    const set = answerPairsByBatch.get(batchId) ?? new Set<string>();
    set.add(pair);
    answerPairsByBatch.set(batchId, set);
  };

  for (const response of responseRows) {
    const pair = `${response.participant_id}:${response.question_id}`;
    credit(response.batch_id, pair); // async
    if (response.live_session_id) {
      credit(batchIdBySession.get(response.live_session_id) ?? null, pair); // live
    }
  }

  return batchRows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    responseCount: answerPairsByBatch.get(row.id)?.size ?? 0,
  }));
}

/**
 * Live-session ids run off this batch. `live_sessions.batch_id` is what
 * links a room back to a batch (F5's `lib/repos/sessions.ts` /
 * `lib/services/sessions/**`, both untouched here).
 *
 * A CONTAINED EXCEPTION, same shape as `lib/auth`'s direct `staff` read: this
 * repo needs exactly one column off one table for one filter, and reaching
 * into F5's owned files for that would be a bigger cross-cutting dependency
 * than reading `live_sessions` directly, here, narrowly. Kept to one table,
 * one column, no business logic.
 */
export async function listLiveSessionIdsForBatch(
  batchId: string,
): Promise<string[]> {
  const rows = unwrap(
    await serviceClient().from("live_sessions").select("id").eq("batch_id", batchId),
  );
  return rows.map((row) => row.id);
}

/* ------------------------------------------------------------------ *
 * Responses, scoped to one batch
 * ------------------------------------------------------------------ */

export type ReportResponseRow = {
  id: string;
  questionId: string;
  participantId: string;
  answer: Answer;
  createdAt: string;
};

const RESPONSE_COLUMNS = "id, question_id, participant_id, answer, created_at";

/**
 * Every response recorded against this batch, async AND live: `batch_id =
 * this batch` OR `live_session_id` is one of this batch's sessions. Two
 * queries merged rather than a single `.or()` across a subquery — PostgREST's
 * `.or()` takes a literal filter string, not a nested select, so the session
 * ids are resolved first and then interpolated into an `in.(...)` list.
 *
 * `responses.answer` is untyped jsonb, so it is always parsed on the way out
 * (PLAN §5.7/D11), with the same `answer` schema both submit paths validate
 * against. A list read soft-fails: one unparseable row is skipped and
 * logged, not fatal to the report.
 */
export async function listResponsesForBatch(
  batchId: string,
): Promise<ListResult<ReportResponseRow>> {
  const sessionIds = await listLiveSessionIdsForBatch(batchId);

  // Oldest first: the service dedupes repeat answers (same participant, same
  // question, across channels/sessions) down to the FIRST one, so the order
  // here is what makes "first" mean first.
  const query = serviceClient()
    .from("responses")
    .select(RESPONSE_COLUMNS)
    .order("created_at", { ascending: true });

  const rows = unwrap(
    await (sessionIds.length > 0
      ? query.or(
          `batch_id.eq.${batchId},live_session_id.in.(${sessionIds.join(",")})`,
        )
      : query.eq("batch_id", batchId)),
  );

  // Defensive de-dupe by response id before parsing — `batch_id` is only
  // ever set on an async response and `live_session_id` only on a live one
  // (never both), so the OR above shouldn't be able to return the same row
  // twice, but a merge must never double-count regardless of why.
  const seen = new Set<string>();
  const deduped = rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  return collect(deduped, (r) => r.id, mapResponse);
}

function mapResponse(row: {
  id: string;
  question_id: string;
  participant_id: string;
  answer: unknown;
  created_at: string;
}): ReportResponseRow {
  return {
    id: row.id,
    questionId: row.question_id,
    participantId: row.participant_id,
    answer: parseJsonb(answerSchema, row.answer, {
      id: row.id,
      column: "answer",
    }),
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ *
 * Junction reads — the queryable relations the migration built for
 * exactly this (PLAN §8).
 * ------------------------------------------------------------------ */

export type PrincipleLinkRow = {
  questionId: string;
  code: string;
  name: string;
};

/** Which rubric codes each of these questions is tagged with, via `question_principles`. */
export async function listPrincipleLinksForQuestions(
  questionIds: string[],
): Promise<PrincipleLinkRow[]> {
  if (questionIds.length === 0) return [];

  const rows = unwrap(
    await serviceClient()
      .from("question_principles")
      .select("question_id, principles(code, name)")
      .in("question_id", questionIds),
  );

  return rows.flatMap((r) =>
    r.principles
      ? [{ questionId: r.question_id, code: r.principles.code, name: r.principles.name }]
      : [],
  );
}

export type TopicLinkRow = {
  questionId: string;
  slug: string;
  label: string;
};

/** Which topics each of these questions is tagged with, via `question_topics`. */
export async function listTopicLinksForQuestions(
  questionIds: string[],
): Promise<TopicLinkRow[]> {
  if (questionIds.length === 0) return [];

  const rows = unwrap(
    await serviceClient()
      .from("question_topics")
      .select("question_id, topics(slug, label)")
      .in("question_id", questionIds),
  );

  return rows.flatMap((r) =>
    r.topics
      ? [{ questionId: r.question_id, slug: r.topics.slug, label: r.topics.label }]
      : [],
  );
}
